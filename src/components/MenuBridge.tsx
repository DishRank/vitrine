/**
 * Menu / restaurant bridge partagé — rendu MENU-FIRST.
 *
 * Deux routes le consomment :
 *  • `/restaurant/<id>`  → `allowAppRedirect = true`  (partages resto + anciens
 *    QR). C'est une cible app-link (AASA + intent Android revendiquent
 *    `/restaurant*`) : app installée → l'OS ouvre la fiche in-app AVANT cette
 *    page. Sinon web, avec pont deep-link discret.
 *  • `/menu/<id>`        → `allowAppRedirect = false` (QR de table actuel).
 *    Chemin volontairement HORS app-links → l'OS n'intercepte jamais et on
 *    n'auto-redirige pas : le client voit TOUJOURS le menu numérique sur le web.
 *
 * Rendu :
 *  1. Menu saisi → le MENU NUMÉRIQUE complet (multilingue via Accept-Language).
 *  2. Pas de menu → carte d'installation/découverte (fallback).
 *  Le scan est logué CÔTÉ SERVEUR ici dans les deux cas.
 *
 * Anti double comptage : quand un pont deep-link est rendu (allowAppRedirect),
 * il réécrit `src=qr` → `src=qr_app` avant d'ouvrir le scheme custom — l'app ne
 * logue que `src === 'qr'`, donc un scan = UN log, jamais deux.
 *
 * SEO : bridge volontairement noindex. Le JSON-LD Menu vit sur la page
 * indexable [locale]/[city]/r/[slug].
 *
 * Vit hors `[locale]` pour garder l'URL du QR propre — `proxy.ts` whiteliste
 * les deux chemins et propage le nonce CSP du script inline.
 */
import { Metadata } from 'next';
import Image from 'next/image';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { after } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { APP_STORE_URL, PLAY_STORE_URL } from '@/lib/downloadLinks';
import RateDish from '@/components/RateDish';
import MenuControls from '@/components/MenuControls';
import {
  fetchMenuTree,
  gateMenuTranslations,
  fetchMenuRatings,
  ratingKey,
  resolveMenuTheme,
  isRestaurantPremium,
  detectPlatformFromUA,
  logQrScanServer,
  logMenuViewServer,
  pickLocale,
  loc,
  menuLocales,
  MENU_UI,
  MENU_LOCALES,
  type MenuTree,
  type MenuItem,
  type MenuSection,
  type MenuLocale,
  type DishRating,
  type ResolvedMenuTheme,
  type StorePlatform,
} from '@/lib/menu';

interface VenueInfo {
  name: string;
  city: string | null;
  description: string | null;
  photo_url: string | null;
  subscription_tier: string | null;
  subscription_expires_at: string | null;
  menu_theme: unknown;
}

// Restaurant ids are UUIDs. Reject anything else so a hostile path can't bend
// the query (and so we 404 fast on garbage instead of hitting the DB).
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Server-side fetch with the service-role key (never shipped to the client).
// We only read public-safe display columns of the venue's listing.
async function fetchVenue(id: string): Promise<VenueInfo | null> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!UUID_RE.test(id)) return null;

  try {
    const supabase = createClient(url, key);
    const { data } = await supabase
      .from('restaurants')
      .select(
        'name, city, description, photo_url, subscription_tier, subscription_expires_at, menu_theme'
      )
      .eq('id', id)
      .maybeSingle();
    return (data as VenueInfo | null) ?? null;
  } catch {
    return null;
  }
}

interface MenuBridgeProps {
  id: string;
  src?: string;
  /** true (route /restaurant) : on tente le hand-off vers l'app (redirect
   *  scheme custom pour les restos sans menu ; l'universal link ouvre déjà
   *  l'app en amont). false (route /menu) : jamais de redirect — le menu web
   *  est toujours affiché. */
  allowAppRedirect: boolean;
  /** Langue forcée via ?lang=xx (bouton du menu) ; sinon Accept-Language. */
  lang?: string;
}

export async function buildMenuMetadata(id: string): Promise<Metadata> {
  const venue = await fetchVenue(id);
  const name = venue?.name?.trim();
  // Titre neutre : la page sert le menu s'il existe, sinon la fiche — ne jamais
  // promettre un « menu » qui pourrait ne pas exister (resto sans menu numérique).
  const title = name ? `${name} · DishRank` : 'Découvrir sur DishRank';
  const description = name
    ? `Découvre ${name}${venue?.city ? ` à ${venue.city}` : ''} et ses plats notés par la communauté sur DishRank.`
    : 'Note les plats, pas les restos. Découvre les meilleurs plats près de chez toi.';
  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      images: [
        { url: venue?.photo_url || 'https://dishrank.fr/img/play_store_feature_graphic.webp' },
      ],
    },
  };
}

// ── Rendu d'un item / d'une formule (styles inline, page autonome) ──────────

// Le look « carte de restaurant » est piloté par un THÈME (premium) résolu par
// requête (resolveMenuTheme). Défaut = ivoire chaud. Le violet DishRank n'est
// jamais thémé : réservé à la petite mention app.
const BRAND = '#6C5CE7';
// Polices d'affichage (nom resto, titres de section) — 100 % système, CSP-safe.
const SERIF =
  "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, 'Times New Roman', serif";
const MODERN =
  "'Avenir Next', 'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, sans-serif";
const SANS =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

function displayFont(theme: ResolvedMenuTheme): string {
  return theme.font === 'serif' ? SERIF : MODERN;
}

function priceStr(n: number): string {
  return `${Number.isInteger(n) ? n : n.toFixed(2).replace('.', ',')} €`;
}

// Glyphes store — mêmes tracés SVG que components/DownloadButtons.tsx du site.
function AppleIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.38-1.09-.5-2.09-.55-3.24 0-1.44.72-2.2.48-3.08-.38C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.78 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.1zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}
function PlayIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M3 20.5V3.5c0-.59.34-1.11.84-1.35L13.69 12l-9.85 9.85c-.5-.25-.84-.76-.84-1.35zM16.81 15.12L6.05 21.34l8.49-8.49 2.27 2.27zM20.16 10.81c.35.27.58.72.58 1.19 0 .47-.23.91-.57 1.18l-2.29 1.32-2.5-2.5 2.5-2.5 2.28 1.31zM6.05 2.66l10.76 6.22-2.27 2.27L6.05 2.66z" />
    </svg>
  );
}

// Pastilles « badge store » (noires, glyphe + libellé) — lisibles sur clair
// comme sur sombre (une hairline claire les détache sur fond sombre). Adaptées
// à la plateforme : iPhone → App Store seul, Android → Google Play seul,
// desktop/inconnu → les deux.
function StoreBadges({
  theme,
  ui,
  platform,
}: {
  theme: ResolvedMenuTheme;
  ui: { appStore: string; playStore: string };
  platform: StorePlatform;
}) {
  const pill: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    background: '#111111',
    color: '#FFFFFF',
    padding: '11px 20px',
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 600,
    textDecoration: 'none',
    border: `1px solid ${theme.dark ? 'rgba(255,255,255,0.16)' : 'transparent'}`,
  };
  const showApple = platform !== 'android';
  const showPlay = platform !== 'ios';
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 10,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {showApple ? (
        <a href={APP_STORE_URL} style={pill}>
          <AppleIcon size={17} />
          {ui.appStore}
        </a>
      ) : null}
      {showPlay ? (
        <a href={PLAY_STORE_URL} style={pill}>
          <PlayIcon size={16} />
          {ui.playStore}
        </a>
      ) : null}
    </div>
  );
}

/** Petit ★ note discret (accent), affiché seulement si le plat a des avis. */
function RatingMark({
  rating,
  word,
  theme,
}: {
  rating: DishRating;
  word: string;
  theme: ResolvedMenuTheme;
}) {
  return (
    <span
      style={{ whiteSpace: 'nowrap', fontSize: 12.5, fontWeight: 700, color: theme.accent }}
      title={`${rating.avg} · ${rating.count} ${word}`}
    >
      ★ {rating.avg.toFixed(1)}
      <span style={{ color: theme.sub, fontWeight: 500 }}> · {rating.count}</span>
    </span>
  );
}

function ItemRow({
  item,
  locale,
  itemById,
  rating,
  theme,
  restaurantId,
}: {
  item: MenuItem;
  locale: MenuLocale;
  itemById: Map<string, MenuItem>;
  rating?: DishRating | null;
  theme: ResolvedMenuTheme;
  restaurantId: string;
}) {
  const ui = MENU_UI[locale];
  // « Noter ce plat » → deep-link app avec resto + plat pré-remplis. NOM
  // CANONIQUE (fr) dans le param — c'est la clé des avis et du trigger 092.
  // src=qr_app (PAS qr) : le scan est déjà compté ; l'app pose l'attribution
  // sans reloguer, et le pont /restaurant ne recompte pas non plus.
  const rateHref = `/restaurant/${restaurantId}?src=qr_app&dish=${encodeURIComponent(item.name)}`;
  const name = loc(item.name, item.i18n, locale, 'name') ?? item.name;
  const desc = loc(item.description, item.i18n, locale, 'description');
  const services = item.availability?.services ?? [];
  const serviceNote =
    services.length === 1 ? (services[0] === 'lunch' ? ui.lunchOnly : ui.dinnerOnly) : null;
  const showPrice = item.kind === 'item' && item.variants.length === 0 && item.price != null;
  const thumb = theme.photos && item.photo_url ? item.photo_url : null;
  // Texte de recherche (langue courante) : nom + description + libellés
  // régimes/allergènes → alimente le filtre live de la barre d'outils.
  const searchText = [
    name,
    desc ?? '',
    ...item.diet_tags.map((d) => ui.diets[d] ?? d),
    ...item.allergens.map((a) => ui.allergens[a] ?? a),
  ]
    .join(' ')
    .toLowerCase()
    // insensible aux accents (crème ↔ creme, bœuf ↔ boeuf) — le client
    // normalise la requête de la même façon.
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

  const body = (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
        <h3
          style={{
            flex: 1,
            minWidth: 0,
            margin: 0,
            fontFamily: SANS,
            fontSize: 16,
            fontWeight: 600,
            color: theme.text,
            lineHeight: 1.3,
          }}
        >
          {name}
          {item.is_signature ? (
            <span
              style={{
                marginLeft: 8,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 0.8,
                textTransform: 'uppercase',
                color: theme.accent,
                whiteSpace: 'nowrap',
              }}
            >
              ✦ {ui.signature}
            </span>
          ) : null}
          {!item.is_available ? (
            <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: '#C0604E' }}>
              · {ui.soldOut}
            </span>
          ) : null}
        </h3>
        {showPrice ? (
          <span style={{ fontSize: 15.5, fontWeight: 700, color: theme.text, whiteSpace: 'nowrap' }}>
            {priceStr(item.price as number)}
          </span>
        ) : null}
      </div>

      {/* Note communautaire + action « ☆ Noter » — discrètes, sur une même
          ligne. Le bouton ouvre la FEUILLE DE NOTATION WEB (sans compte,
          session anonyme) directement sur la page ; un lien « Ouvrir dans
          l'app » y propose l'expérience complète (deep-link pré-rempli). */}
      <div
        style={{
          marginTop: 5,
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        {rating ? <RatingMark rating={rating} word={ui.reviewsWord} theme={theme} /> : <span />}
        <RateDish
          restaurantId={restaurantId}
          dishName={item.name}
          displayName={name}
          theme={{
            accent: theme.accent,
            text: theme.text,
            sub: theme.sub,
            card: theme.card,
            line: theme.line,
            dark: theme.dark,
          }}
          labels={{
            action: ui.rateAction,
            publish: ui.ratePublish,
            commentPh: ui.rateCommentPh,
            thanks: ui.rateThanks,
            anonHint: ui.rateAnonHint,
            already: ui.rateAlready,
            error: ui.rateError,
            openApp: ui.openApp,
          }}
          appHref={rateHref}
        />
      </div>

      {desc ? (
        <p style={{ margin: '5px 0 0', color: theme.sub, fontSize: 13.5, lineHeight: 1.5 }}>{desc}</p>
      ) : null}

      {item.variants.length > 0 ? (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {item.variants.map((v) => (
            <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}>
              <span style={{ color: theme.sub }}>
                {locale !== 'fr' && v.i18n?.[locale]?.label ? v.i18n[locale].label : v.label}
              </span>
              <span style={{ color: theme.text, fontWeight: 700 }}>{priceStr(v.price)}</span>
            </div>
          ))}
        </div>
      ) : null}

      {item.options.length > 0 ? (
        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {item.options.map((o) => (
            <p key={o.id} style={{ margin: 0, fontSize: 12.5, color: theme.sub, lineHeight: 1.5 }}>
              <span style={{ fontWeight: 700, color: theme.text }}>
                {locale !== 'fr' && o.i18n?.[locale]?.name ? o.i18n[locale].name : o.name}
                {o.required ? ` (${ui.required})` : ''} :
              </span>{' '}
              {o.choices
                .map((ch) =>
                  ch.price_delta ? `${ch.label} (+${priceStr(ch.price_delta)})` : ch.label
                )
                .join(' · ')}
            </p>
          ))}
        </div>
      ) : null}

      {item.kind === 'formula' && item.formula_config ? (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {item.formula_config.prices.map((p, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <span style={{ color: theme.text, fontWeight: 600 }}>{p.label}</span>
                <span style={{ color: theme.text, fontWeight: 800 }}>{priceStr(p.price)}</span>
              </div>
            ))}
          </div>
          {item.formula_config.slots.map((slot, i) => {
            const names = (slot.source.item_ids ?? [])
              .map((iid) => itemById.get(iid))
              .filter(Boolean)
              .map((it) => loc(it!.name, it!.i18n, locale, 'name') ?? it!.name);
            const supplements = (slot.supplements ?? [])
              .map((sup) => {
                const it = itemById.get(sup.item_id);
                if (!it) return null;
                return `${loc(it.name, it.i18n, locale, 'name') ?? it.name} +${priceStr(sup.price_delta)}`;
              })
              .filter(Boolean);
            return (
              <p key={i} style={{ margin: '6px 0 0', fontSize: 12.5, color: theme.sub, lineHeight: 1.5 }}>
                <span style={{ fontWeight: 700, color: theme.text }}>{slot.name}</span>
                {names.length > 0 ? ` — ${ui.choiceOf} : ${names.join(' · ')}` : ''}
                {supplements.length > 0 ? ` (${ui.supplement} ${supplements.join(', ')})` : ''}
              </p>
            );
          })}
        </div>
      ) : null}

      {(item.allergens.length > 0 || item.diet_tags.length > 0 || serviceNote) && (
        <p style={{ margin: '8px 0 0', fontSize: 11, color: theme.sub, letterSpacing: 0.2 }}>
          {item.diet_tags.map((d) => MENU_UI[locale].diets[d] ?? d).join(' · ')}
          {item.diet_tags.length > 0 && (item.allergens.length > 0 || serviceNote) ? ' — ' : ''}
          {item.allergens.length > 0
            ? `${MENU_UI[locale].allergensTitle} : ${item.allergens
                .map((a) => MENU_UI[locale].allergens[a] ?? a)
                .join(', ')}`
            : ''}
          {serviceNote ? `${item.allergens.length > 0 ? ' — ' : ''}${serviceNote}` : ''}
        </p>
      )}
    </>
  );

  return (
    <div
      data-mi=""
      data-s={searchText}
      data-sig={item.is_signature ? '1' : '0'}
      data-diet={item.diet_tags.join(' ')}
      style={{
        padding: '14px 0',
        borderBottom: `1px solid ${theme.line}`,
        opacity: item.is_available ? 1 : 0.5,
      }}
    >
      {thumb ? (
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumb}
            alt={name}
            style={{ width: 72, height: 72, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>{body}</div>
        </div>
      ) : (
        body
      )}
    </div>
  );
}

function SectionBlock({
  section,
  locale,
  itemById,
  ratings,
  theme,
  restaurantId,
  depth = 0,
}: {
  section: MenuSection;
  locale: MenuLocale;
  itemById: Map<string, MenuItem>;
  restaurantId: string;
  ratings: Record<string, DishRating>;
  theme: ResolvedMenuTheme;
  depth?: number;
}) {
  const name = loc(section.name, section.i18n, locale, 'name') ?? section.name;
  const desc = loc(section.description, section.i18n, locale, 'description');
  const display = displayFont(theme);
  if (section.items.length === 0 && section.children.every((child) => child.items.length === 0))
    return null;
  return (
    <section data-ms="" style={{ marginTop: depth === 0 ? 40 : 24 }}>
      {depth === 0 ? (
        <div style={{ textAlign: 'center', marginBottom: 4 }}>
          <h2
            style={{
              fontFamily: display,
              fontSize: 23,
              fontWeight: 600,
              margin: 0,
              color: theme.text,
              letterSpacing: 0.3,
            }}
          >
            {name}
          </h2>
          <div
            style={{
              width: 44,
              height: 2,
              background: theme.accent,
              opacity: 0.8,
              margin: '10px auto 0',
              borderRadius: 2,
            }}
          />
        </div>
      ) : (
        <h3
          style={{ fontFamily: display, fontSize: 17, fontWeight: 600, margin: '0 0 2px', color: theme.text }}
        >
          {name}
        </h3>
      )}
      {desc ? (
        <p
          style={{
            margin: '0 0 4px',
            color: theme.sub,
            fontSize: 13,
            fontStyle: 'italic',
            textAlign: depth === 0 ? 'center' : 'left',
            lineHeight: 1.5,
          }}
        >
          {desc}
        </p>
      ) : null}
      <div>
        {section.items.map((item) => (
          <ItemRow
            key={item.id}
            item={item}
            locale={locale}
            itemById={itemById}
            rating={ratings[ratingKey(item.name)] ?? null}
            theme={theme}
            restaurantId={restaurantId}
          />
        ))}
      </div>
      {section.children.map((child) => (
        <SectionBlock
          key={child.id}
          section={child}
          locale={locale}
          itemById={itemById}
          ratings={ratings}
          theme={theme}
          restaurantId={restaurantId}
          depth={1}
        />
      ))}
    </section>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function MenuBridge({ id, src, allowAppRedirect, lang }: MenuBridgeProps) {
  // Reject malformed ids early (anything that wouldn't ever match a row).
  if (!UUID_RE.test(id)) notFound();

  const hdrs = await headers();
  // Langue : ?lang=xx (bouton du menu) prioritaire, sinon Accept-Language.
  const forcedLang =
    lang && (MENU_LOCALES as readonly string[]).includes(lang) ? (lang as MenuLocale) : null;
  const locale = forcedLang ?? pickLocale(hdrs.get('accept-language'));
  const ui = MENU_UI[locale];

  const [venue, menusRaw, ratings] = await Promise.all([
    fetchVenue(id),
    fetchMenuTree(id),
    fetchMenuRatings(id),
  ]);
  const name = venue?.name?.trim() || null;
  const city = venue?.city?.trim() || null;
  const description = venue?.description?.trim() || null;
  const cover = venue?.photo_url || null;

  // Thème d'apparence : appliqué UNIQUEMENT si le resto est premium (sinon
  // défaut ivoire) → dégradation propre à l'expiration, sans trigger DB.
  const isPremium = isRestaurantPremium(venue?.subscription_tier, venue?.subscription_expires_at);
  const theme = resolveMenuTheme(venue?.menu_theme, isPremium);

  // Traduction du menu = PREMIUM (v2 §2.1) : feuilles i18n vidées au rendu
  // pour un resto free/expiré — le contenu retombe en français, les libellés
  // MENU_UI restent dans la langue du visiteur.
  const menus = gateMenuTranslations(menusRaw, isPremium);
  const hasMenu = menus.length > 0;
  const display = displayFont(theme);

  // Plateforme (SSR via User-Agent) : n'affiche que le bouton store pertinent.
  const platform = detectPlatformFromUA(hdrs.get('user-agent'));

  // Logs serveur, hors chemin critique (after = après l'envoi de la réponse).
  // Le scan web est l'event d'autorité pour le pont ; l'app ne logue que les
  // ouvertures par universal link (src=qr intact), jamais celles du pont
  // (réécrites en src=qr_app par le script ci-dessous) → pas de double compte.
  if (venue) {
    const srcValue = src === 'qr' ? 'qr' : null;
    after(async () => {
      if (srcValue) await logQrScanServer(id, srcValue);
      if (hasMenu) await logMenuViewServer(id, srcValue ?? 'web');
    });
  }

  // CSP nonce injected by proxy.ts — applied to the inline script below so it's
  // allowed by the strict CSP. Same pattern as /join.
  const nonce = hdrs.get('x-nonce') || undefined;

  const itemById = new Map<string, MenuItem>();
  for (const m of menus)
    for (const s of m.sections) {
      for (const it of s.items) itemById.set(it.id, it);
      for (const child of s.children) for (const it of child.items) itemById.set(it.id, it);
    }

  // Filtres du menu (calculés côté serveur, langue courante) : régimes présents
  // + présence d'un plat signature. Langues proposées par le sélecteur = les 5
  // (le contenu retombe en fr si non traduit, les libellés se localisent).
  const dietSet = new Set<string>();
  let hasSignature = false;
  for (const it of itemById.values()) {
    it.diet_tags.forEach((d) => dietSet.add(d));
    if (it.is_signature) hasSignature = true;
  }
  const dietFilters = [...dietSet].map((slug) => ({ slug, label: ui.diets[slug] ?? slug }));
  // Langues du sélecteur = uniquement celles réellement traduites (fr + i18n).
  const offeredLocales = menuLocales(menus);

  return (
    <html lang={locale}>
      <head>
        <link rel="icon" type="image/webp" href="/img/icon.webp" />
      </head>
      <body
        style={{
          fontFamily: SANS,
          background: theme.bg,
          color: theme.text,
          minHeight: '100vh',
          margin: 0,
          padding: hasMenu ? '0 0 48px' : 24,
          display: hasMenu ? 'block' : 'flex',
          alignItems: hasMenu ? undefined : 'center',
          justifyContent: hasMenu ? undefined : 'center',
          textAlign: hasMenu ? undefined : 'center',
        }}
      >
        {hasMenu ? (
          // ── MENU-FIRST : le menu numérique complet ────────────────────────
          <div style={{ maxWidth: 560, margin: '0 auto', padding: '0 20px' }}>
            {/* Hero : photo + nom (light theming du resto) */}
            {cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cover}
                alt={name || 'DishRank'}
                style={{
                  width: 'calc(100% + 40px)',
                  margin: '0 -20px',
                  height: 190,
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
            ) : null}
            <header style={{ paddingTop: cover ? 22 : 36, textAlign: 'center' }}>
              {/* Logo du resto (premium) — chevauche la photo de couverture. */}
              {theme.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={theme.logoUrl}
                  alt={name || 'Logo'}
                  style={{
                    width: 68,
                    height: 68,
                    objectFit: 'contain',
                    display: 'block',
                    margin: cover ? '-54px auto 10px' : '0 auto 10px',
                    borderRadius: 14,
                    background: theme.card,
                    padding: 6,
                    boxShadow: '0 2px 10px rgba(0,0,0,0.12)',
                  }}
                />
              ) : null}
              <h1
                style={{
                  fontFamily: display,
                  fontSize: 30,
                  fontWeight: 600,
                  margin: 0,
                  color: theme.text,
                  letterSpacing: 0.3,
                  lineHeight: 1.15,
                }}
              >
                {name}
              </h1>
              {city ? (
                <p
                  style={{
                    color: theme.accent,
                    fontSize: 12,
                    fontWeight: 600,
                    letterSpacing: 2.2,
                    textTransform: 'uppercase',
                    margin: '9px 0 0',
                  }}
                >
                  {city}
                </p>
              ) : null}
              {description ? (
                <p
                  style={{
                    color: theme.sub,
                    fontSize: 14,
                    margin: '12px auto 0',
                    lineHeight: 1.6,
                    maxWidth: 440,
                    fontStyle: 'italic',
                  }}
                >
                  {description}
                </p>
              ) : null}
              {/* petit ornement (accent) — pas de bouton app en tête */}
              <div
                style={{ color: theme.accent, fontSize: 15, letterSpacing: 6, marginTop: 14, opacity: 0.6 }}
              >
                ❦
              </div>
            </header>

            {/* Barre d'outils (recherche / filtres / langue) enrobant le menu :
                le contenu reste rendu côté serveur, la barre le filtre côté client. */}
            <MenuControls
              locale={locale}
              locales={offeredLocales}
              dietFilters={dietFilters}
              hasSignature={hasSignature}
              ui={{
                search: ui.searchPlaceholder,
                all: ui.filterAll,
                signature: ui.filterSignature,
                noResults: ui.noResults,
              }}
              theme={{
                bg: theme.bg,
                card: theme.card,
                text: theme.text,
                sub: theme.sub,
                line: theme.line,
                accent: theme.accent,
                dark: theme.dark,
              }}
            >
              {menus.map((menu: MenuTree) => (
                <div key={menu.id} data-menu="">
                  {menus.length > 1 ? (
                    <p
                      style={{
                        textAlign: 'center',
                        fontSize: 12,
                        fontWeight: 700,
                        color: theme.accent,
                        textTransform: 'uppercase',
                        letterSpacing: 3,
                        margin: '44px 0 0',
                      }}
                    >
                      {loc(menu.name, menu.i18n, locale, 'name') ?? menu.name}
                    </p>
                  ) : null}
                  {menu.sections.map((section) => (
                    <SectionBlock
                      key={section.id}
                      section={section}
                      locale={locale}
                      itemById={itemById}
                      ratings={ratings}
                      theme={theme}
                      restaurantId={id}
                    />
                  ))}
                </div>
              ))}
            </MenuControls>

            {/* Pied : allusion app DISCRÈTE — une invitation douce + petits liens
                store en texte, jamais un mur de boutons. C'est une carte de resto. */}
            <footer style={{ marginTop: 52 }}>
              <div style={{ borderTop: `1px solid ${theme.line}`, paddingTop: 28, textAlign: 'center' }}>
                <p style={{ fontSize: 14.5, color: theme.text, margin: 0, fontWeight: 600 }}>
                  <span style={{ color: theme.accent }}>★</span> {ui.likedTitle}{' '}
                  <span style={{ color: theme.dark ? '#A29BFE' : BRAND }}>{ui.rateInvite}</span>
                </p>
                <div style={{ marginTop: 14 }}>
                  <StoreBadges theme={theme} ui={ui} platform={platform} />
                </div>
                <p style={{ color: theme.sub, fontSize: 11, marginTop: 18, opacity: 0.75 }}>
                  {ui.poweredBy}
                </p>
              </div>
            </footer>
          </div>
        ) : (
          // ── Fallback sans menu : carte d'installation (comportement historique)
          <div style={{ maxWidth: 420, width: '100%' }}>
            {cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cover}
                alt={name || 'DishRank'}
                style={{
                  width: '100%',
                  maxWidth: 320,
                  height: 180,
                  objectFit: 'cover',
                  borderRadius: 18,
                  marginBottom: 20,
                }}
              />
            ) : (
              <Image
                src="/img/icon.webp"
                alt="DishRank"
                width={64}
                height={64}
                style={{ borderRadius: 16, marginBottom: 20 }}
              />
            )}

            {name ? (
              <>
                <h1 style={{ fontSize: 24, fontWeight: 800, margin: '0 0 6px' }}>{name}</h1>
                {city ? (
                  <p style={{ color: theme.accent, fontSize: 14, fontWeight: 700, margin: '0 0 14px' }}>
                    {city}
                  </p>
                ) : null}
                <p style={{ color: theme.sub, fontSize: 15, marginBottom: 28, lineHeight: 1.5 }}>
                  {description ||
                    `Découvre les plats notés${city ? ` à ${city}` : ''} et donne ton avis sur DishRank.`}
                </p>
              </>
            ) : (
              <>
                <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>
                  Découvre ce lieu sur DishRank
                </h1>
                <p style={{ color: theme.sub, fontSize: 15, marginBottom: 28, lineHeight: 1.5 }}>
                  Note les plats, pas les restos. Installe l&apos;app pour découvrir les meilleurs
                  plats près de chez toi.
                </p>
              </>
            )}

            <StoreBadges theme={theme} ui={ui} platform={platform} />

            <p style={{ color: theme.sub, fontSize: 13, marginTop: 20 }}>
              {ui.orVisit}{' '}
              <a href="/" style={{ color: theme.accent, textDecoration: 'none' }}>
                dishrank.fr
              </a>
            </p>
          </div>
        )}

        {/* Pont deep-link — UNIQUEMENT sur la route /restaurant (allowAppRedirect).
            App installée → le scheme custom ouvre la fiche in-app. IMPORTANT :
            src=qr est réécrit en src=qr_app pour que l'app NE relogue PAS un
            scan déjà compté côté serveur par cette page. Sans menu, on tente
            l'ouverture immédiatement ; avec menu, le client lit d'abord.
            La route /menu passe allowAppRedirect=false → aucun script, le menu
            web reste affiché sans jamais rediriger. */}
        {allowAppRedirect ? (
          <script
            nonce={nonce}
            suppressHydrationWarning
            dangerouslySetInnerHTML={{
              __html: `
              (function () {
                var id = ${JSON.stringify(id)};
                var hasMenu = ${JSON.stringify(hasMenu)};
                // « Noter ce plat » depuis le menu web : ?dish= est une
                // intention EXPLICITE d'ouvrir l'app (composer pré-rempli) —
                // on tente le deep-link même quand le menu est affiché.
                var dishMatch = (window.location.search || '').match(/[?&]dish=([^&]*)/);
                var hasDish = !!dishMatch;
                if (!id || (hasMenu && !hasDish)) return;
                // One-shot guard: the Android intent fallback URL points back
                // to this same page, which would re-fire the script in a loop
                // if the app isn't installed. Mark sessionStorage and skip.
                // Clé par plat : un tap « noter » sur un AUTRE plat retente.
                try {
                  var key = 'dishrank-deeplink:restaurant:' + id + (hasDish ? ':dish:' + dishMatch[1] : '');
                  if (sessionStorage.getItem(key)) return;
                  sessionStorage.setItem(key, '1');
                } catch (e) {}
                var ua = navigator.userAgent || '';
                var isAndroid = /Android/i.test(ua);
                var isIOS = /iPhone|iPad|iPod/i.test(ua);
                // Le scan a déjà été compté serveur-side sur CETTE page :
                // src=qr devient src=qr_app pour que l'app ne le relogue pas.
                var search = (window.location.search || '').replace(/([?&])src=qr(?!_)/, '$1src=qr_app');
                var here = window.location.href;
                if (isAndroid) {
                  window.location.href =
                    'intent://restaurant/' + encodeURIComponent(id) + search +
                    '#Intent;scheme=dishrank;' +
                    'S.browser_fallback_url=' + encodeURIComponent(here) +
                    ';end';
                  return;
                }
                if (isIOS) {
                  try { window.location.href = 'dishrank://restaurant/' + encodeURIComponent(id) + search; } catch (e) {}
                  return;
                }
                // Desktop stays on the install card.
              })();
            `,
            }}
          />
        ) : null}
      </body>
    </html>
  );
}
