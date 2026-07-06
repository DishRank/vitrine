/**
 * Restaurant deep-link bridge / QR landing — devenue MENU-FIRST.
 *
 * Atteinte quand un client scanne le QR de table (imprimé depuis le cockpit
 * owner) — le QR encode `https://dishrank.fr/restaurant/<id>?src=qr`.
 *
 * Comportement :
 *  1. App installée + App Links vérifiés → l'OS intercepte l'universal link
 *     AVANT cette page et ouvre la fiche in-app (qui logue le scan anonyme).
 *  2. Sinon le navigateur charge cette page : le MENU NUMÉRIQUE complet du
 *     resto (multilingue via Accept-Language), avec un pont deep-link discret
 *     vers l'app. Le scan est logué CÔTÉ SERVEUR ici.
 *  3. Pas de menu saisi → carte d'installation classique (fallback).
 *
 * Anti double comptage : le script de pont réécrit `src=qr` → `src=qr_app`
 * avant d'ouvrir le scheme custom — l'app ne logue que `src === 'qr'`, donc
 * un scan = UN log (web ici, OU app via universal link), jamais deux.
 *
 * SEO : page volontairement noindex (bridge). Le JSON-LD Menu ira sur la page
 * indexable [locale]/[city]/r/[slug] quand le menu y sera rendu.
 *
 * Vit hors `[locale]` pour garder l'URL du QR propre — `proxy.ts` whiteliste
 * le chemin et propage le nonce CSP du script inline.
 */
import { Metadata } from 'next';
import Image from 'next/image';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { after } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { APP_STORE_URL, PLAY_STORE_URL } from '@/lib/downloadLinks';
import {
  fetchMenuTree,
  logQrScanServer,
  logMenuViewServer,
  pickLocale,
  loc,
  MENU_UI,
  type MenuTree,
  type MenuItem,
  type MenuSection,
  type MenuLocale,
} from '@/lib/menu';

interface VenueInfo {
  name: string;
  city: string | null;
  description: string | null;
  photo_url: string | null;
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
      .select('name, city, description, photo_url')
      .eq('id', id)
      .maybeSingle();
    return (data as VenueInfo | null) ?? null;
  } catch {
    return null;
  }
}

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ src?: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const venue = await fetchVenue(id);
  const name = venue?.name?.trim();
  const title = name ? `${name} — Menu · DishRank` : 'Découvrir sur DishRank';
  const description = name
    ? `Le menu de ${name}${venue?.city ? ` à ${venue.city}` : ''} — et ses plats notés sur DishRank.`
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

const C = {
  bg: '#0F0D1A',
  card: '#1A1730',
  text: '#FFFDF5',
  sub: '#9B97B0',
  accent: '#A29BFE',
  primary: '#6C5CE7',
  line: '#2A2545',
};

function priceStr(n: number): string {
  return `${Number.isInteger(n) ? n : n.toFixed(2).replace('.', ',')} €`;
}

function ItemRow({
  item,
  locale,
  itemById,
}: {
  item: MenuItem;
  locale: MenuLocale;
  itemById: Map<string, MenuItem>;
}) {
  const ui = MENU_UI[locale];
  const name = loc(item.name, item.i18n, locale, 'name') ?? item.name;
  const desc = loc(item.description, item.i18n, locale, 'description');
  const services = item.availability?.services ?? [];
  const serviceNote =
    services.length === 1 ? (services[0] === 'lunch' ? ui.lunchOnly : ui.dinnerOnly) : null;

  return (
    <div
      style={{
        padding: '12px 0',
        borderBottom: `1px solid ${C.line}`,
        opacity: item.is_available ? 1 : 0.55,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 15.5, fontWeight: 700 }}>
            {name}
            {item.is_signature ? (
              <span
                style={{
                  marginLeft: 8,
                  fontSize: 10.5,
                  fontWeight: 800,
                  color: C.accent,
                  border: `1px solid ${C.accent}`,
                  borderRadius: 999,
                  padding: '2px 8px',
                  verticalAlign: 'middle',
                }}
              >
                ★ {ui.signature}
              </span>
            ) : null}
            {!item.is_available ? (
              <span
                style={{
                  marginLeft: 8,
                  fontSize: 10.5,
                  fontWeight: 800,
                  color: '#FF7675',
                  border: '1px solid #FF7675',
                  borderRadius: 999,
                  padding: '2px 8px',
                  verticalAlign: 'middle',
                }}
              >
                {ui.soldOut}
              </span>
            ) : null}
          </span>
        </div>
        {item.kind === 'item' && item.variants.length === 0 && item.price != null ? (
          <span style={{ fontSize: 15, fontWeight: 800, color: C.accent, whiteSpace: 'nowrap' }}>
            {priceStr(item.price)}
          </span>
        ) : null}
      </div>

      {desc ? (
        <p style={{ margin: '4px 0 0', color: C.sub, fontSize: 13.5, lineHeight: 1.45 }}>{desc}</p>
      ) : null}

      {/* Variantes (verre / bouteille…) */}
      {item.variants.length > 0 ? (
        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {item.variants.map((v) => (
            <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}>
              <span style={{ color: C.sub }}>
                {locale !== 'fr' && v.i18n?.[locale]?.label ? v.i18n[locale].label : v.label}
              </span>
              <span style={{ color: C.accent, fontWeight: 700 }}>{priceStr(v.price)}</span>
            </div>
          ))}
        </div>
      ) : null}

      {/* Options / suppléments */}
      {item.options.length > 0 ? (
        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {item.options.map((o) => (
            <p key={o.id} style={{ margin: 0, fontSize: 12.5, color: C.sub }}>
              <span style={{ fontWeight: 700 }}>
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

      {/* Formule : échelle de prix + composition */}
      {item.kind === 'formula' && item.formula_config ? (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {item.formula_config.prices.map((p, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}>
                <span style={{ color: C.text, fontWeight: 600 }}>{p.label}</span>
                <span style={{ color: C.accent, fontWeight: 800 }}>{priceStr(p.price)}</span>
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
              <p key={i} style={{ margin: '6px 0 0', fontSize: 12.5, color: C.sub }}>
                <span style={{ fontWeight: 700, color: C.text }}>{slot.name}</span>
                {names.length > 0 ? ` — ${ui.choiceOf} : ${names.join(' · ')}` : ''}
                {supplements.length > 0 ? ` (${ui.supplement} ${supplements.join(', ')})` : ''}
              </p>
            );
          })}
        </div>
      ) : null}

      {/* Allergènes + régimes + service */}
      {(item.allergens.length > 0 || item.diet_tags.length > 0 || serviceNote) && (
        <p style={{ margin: '6px 0 0', fontSize: 11.5, color: C.sub }}>
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
    </div>
  );
}

function SectionBlock({
  section,
  locale,
  itemById,
  depth = 0,
}: {
  section: MenuSection;
  locale: MenuLocale;
  itemById: Map<string, MenuItem>;
  depth?: number;
}) {
  const name = loc(section.name, section.i18n, locale, 'name') ?? section.name;
  const desc = loc(section.description, section.i18n, locale, 'description');
  if (section.items.length === 0 && section.children.every((child) => child.items.length === 0))
    return null;
  return (
    <section style={{ marginTop: depth === 0 ? 26 : 18 }}>
      <h2
        style={{
          fontSize: depth === 0 ? 19 : 16,
          fontWeight: 800,
          margin: 0,
          color: C.text,
          letterSpacing: 0.2,
        }}
      >
        {name}
      </h2>
      {desc ? (
        <p style={{ margin: '4px 0 0', color: C.sub, fontSize: 13 }}>{desc}</p>
      ) : null}
      <div>
        {section.items.map((item) => (
          <ItemRow key={item.id} item={item} locale={locale} itemById={itemById} />
        ))}
      </div>
      {section.children.map((child) => (
        <SectionBlock key={child.id} section={child} locale={locale} itemById={itemById} depth={1} />
      ))}
    </section>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function RestaurantBridgePage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { src } = await searchParams;

  // Reject malformed ids early (anything that wouldn't ever match a row).
  if (!UUID_RE.test(id)) notFound();

  const hdrs = await headers();
  const locale = pickLocale(hdrs.get('accept-language'));
  const ui = MENU_UI[locale];

  const [venue, menus] = await Promise.all([fetchVenue(id), fetchMenuTree(id)]);
  const name = venue?.name?.trim() || null;
  const city = venue?.city?.trim() || null;
  const description = venue?.description?.trim() || null;
  const cover = venue?.photo_url || null;
  const hasMenu = menus.length > 0;

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

  const storeButtons = (maxWidth: number | string = 280) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
      <a
        href={APP_STORE_URL}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          background: '#fff',
          color: '#0F0D1A',
          padding: '14px 28px',
          borderRadius: 14,
          fontSize: 15,
          fontWeight: 700,
          textDecoration: 'none',
          width: '100%',
          maxWidth,
        }}
      >
        {ui.appStore}
      </a>
      <a
        href={PLAY_STORE_URL}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          background: C.primary,
          color: '#fff',
          padding: '14px 28px',
          borderRadius: 14,
          fontSize: 15,
          fontWeight: 700,
          textDecoration: 'none',
          width: '100%',
          maxWidth,
        }}
      >
        {ui.playStore}
      </a>
    </div>
  );

  return (
    <html lang={locale}>
      <head>
        <link rel="icon" type="image/webp" href="/img/icon.webp" />
      </head>
      <body
        style={{
          fontFamily: "'Outfit', -apple-system, sans-serif",
          background: C.bg,
          color: C.text,
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
            <header style={{ paddingTop: cover ? 18 : 28 }}>
              <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>{name}</h1>
              {city ? (
                <p style={{ color: C.accent, fontSize: 14, fontWeight: 700, margin: '4px 0 0' }}>
                  {city}
                </p>
              ) : null}
              {description ? (
                <p style={{ color: C.sub, fontSize: 14, margin: '8px 0 0', lineHeight: 1.5 }}>
                  {description}
                </p>
              ) : null}
            </header>

            {/* CTA app compact — la boucle d'acquisition, sans bloquer la lecture */}
            <a
              href={`dishrank://restaurant/${encodeURIComponent(id)}?src=qr_app`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                background: C.card,
                border: `1px solid ${C.line}`,
                borderRadius: 14,
                padding: '12px 14px',
                margin: '18px 0 0',
                textDecoration: 'none',
                color: C.text,
              }}
            >
              <Image
                src="/img/icon.webp"
                alt="DishRank"
                width={34}
                height={34}
                style={{ borderRadius: 9 }}
              />
              <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700 }}>{ui.rateCta}</span>
              <span style={{ color: C.accent, fontWeight: 800, fontSize: 18 }}>›</span>
            </a>

            {/* Les cartes (souvent une seule) */}
            {menus.map((menu: MenuTree) => (
              <div key={menu.id}>
                {menus.length > 1 ? (
                  <h2
                    style={{
                      fontSize: 15,
                      fontWeight: 800,
                      color: C.accent,
                      textTransform: 'uppercase',
                      letterSpacing: 1.2,
                      margin: '30px 0 -14px',
                    }}
                  >
                    {loc(menu.name, menu.i18n, locale, 'name') ?? menu.name}
                  </h2>
                ) : null}
                {menu.sections.map((section) => (
                  <SectionBlock
                    key={section.id}
                    section={section}
                    locale={locale}
                    itemById={itemById}
                  />
                ))}
              </div>
            ))}

            {/* Pied : installer l'app + marque */}
            <footer style={{ marginTop: 40, textAlign: 'center' }}>
              {storeButtons('100%')}
              <p style={{ color: C.sub, fontSize: 12.5, marginTop: 18 }}>
                {ui.poweredBy} ·{' '}
                <a href="/" style={{ color: C.accent, textDecoration: 'none' }}>
                  dishrank.fr
                </a>
              </p>
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
                  <p style={{ color: C.accent, fontSize: 14, fontWeight: 700, margin: '0 0 14px' }}>
                    {city}
                  </p>
                ) : null}
                <p style={{ color: C.sub, fontSize: 15, marginBottom: 28, lineHeight: 1.5 }}>
                  {description ||
                    `Découvre les plats notés${city ? ` à ${city}` : ''} et donne ton avis sur DishRank.`}
                </p>
              </>
            ) : (
              <>
                <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 12 }}>
                  Découvre ce lieu sur DishRank
                </h1>
                <p style={{ color: C.sub, fontSize: 15, marginBottom: 28, lineHeight: 1.5 }}>
                  Note les plats, pas les restos. Installe l&apos;app pour découvrir les meilleurs
                  plats près de chez toi.
                </p>
              </>
            )}

            {storeButtons()}

            <p style={{ color: C.sub, fontSize: 13, marginTop: 20 }}>
              {ui.orVisit}{' '}
              <a href="/" style={{ color: C.accent, textDecoration: 'none' }}>
                dishrank.fr
              </a>
            </p>
          </div>
        )}

        {/* Pont deep-link. App installée → le scheme custom ouvre la fiche
            in-app. IMPORTANT : src=qr est réécrit en src=qr_app pour que l'app
            NE relogue PAS un scan déjà compté côté serveur par cette page.
            Sans menu, on tente l'ouverture immédiatement (comportement
            historique) ; avec menu, le client lit d'abord — le CTA compact
            ci-dessus porte le même lien. */}
        <script
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `
              (function () {
                var id = ${JSON.stringify(id)};
                var hasMenu = ${JSON.stringify(hasMenu)};
                if (!id || hasMenu) return;
                // One-shot guard: the Android intent fallback URL points back
                // to this same page, which would re-fire the script in a loop
                // if the app isn't installed. Mark sessionStorage and skip.
                try {
                  var key = 'dishrank-deeplink:restaurant:' + id;
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
      </body>
    </html>
  );
}
