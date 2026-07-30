'use client';

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { uploadMenuImage } from '../imageUpload';
import { setListingLogoAction } from '../../listingMedia';
import ColorField from './ColorField';
import { useAutoSave } from '@/app/pro/_components/useAutoSave';
import { setSaveStatus } from '@/app/pro/_components/saveStatusStore';
import {
  MENU_THEME_PRESETS,
  MENU_THEME_ORDER,
  PRESET_LABEL,
  deriveMenuPalette,
  nearestPreset,
  contrastRatio,
  MENU_ACCENTS,
  MENU_FONTS,
  MENU_FONT_ORDER,
  isDefaultTheme,
  type MenuThemeConfig,
  type MenuThemePreset,
} from '../themeConstants';

/**
 * Polices de l'aperçu — portées par CE composant, pas par un ancêtre.
 * ThemeEditor est monté SOIT dans la page /menu/apparence, SOIT dans une MODALE
 * (AppearanceButton → Modal → createPortal, donc déplacé sous <body>, hors de
 * tout conteneur parent). Poser les variables sur un ancêtre ne les atteint donc
 * pas dans le cas modale — et une `var(--font-*)` indéfinie rend la déclaration
 * `font-family` ENTIÈREMENT invalide (CSS « invalid at computed-value time ») :
 * la police est alors HÉRITÉE du body, d'où toutes les puces identiques.
 * On charge donc les 6 familles ici et on définit les variables sur la racine.
 */
const PREVIEW_FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Bitter:wght@300..800&family=Cormorant+Garamond:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,300..700&family=Oswald:wght@300..600&family=Playfair+Display:wght@400..800&family=Poppins:wght@400;500;600;700&display=swap';

const PREVIEW_FONT_VARS = {
  '--font-fraunces': '"Fraunces"',
  '--font-cormorant': '"Cormorant Garamond"',
  '--font-bitter': '"Bitter"',
  '--font-playfair': '"Playfair Display"',
  '--font-oswald': '"Oswald"',
  '--font-poppins': '"Poppins"',
} as CSSProperties;

/** Apparence enregistrée dans la bibliothèque (mig.159). */
export type SavedTheme = { id: string; name: string; config: MenuThemeConfig; updated_at: string };

export default function ThemeEditor({
  restaurantId,
  initial,
  premium,
  logoUrl,
  initialLibrary,
}: {
  restaurantId: string;
  initial: MenuThemeConfig;
  premium: boolean;
  /** Logo de l'établissement (`restaurants.logo_url`, mig.124). Il n'appartient
   *  pas au thème : ici on ne pilote que `show_logo`. */
  logoUrl: string | null;
  /** Bibliothèque chargée côté serveur (page.tsx / MenuEditor) — l'éditeur
   *  s'ouvre déjà peuplé, sans aller-retour ni effet au montage. */
  initialLibrary: SavedTheme[];
}) {
  const [theme, setTheme] = useState<MenuThemeConfig>(initial);
  const [logo, setLogo] = useState(logoUrl);
  const [uploadError, setUploadError] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Bibliothèque d'apparences (mig.159) ───────────────────────────────────
  // Ranger un brouillon est ouvert à TOUS, gratuit compris : c'est ce qui évite
  // de perdre son travail quand l'abonnement tombe. Seule l'ACTIVATION (l'auto-
  // save sur restaurants.menu_theme, plus bas) reste gatée par le premium.
  // Le quota affiché est indicatif : la limite qui fait foi est le trigger en
  // base, dont on relaie le message tel quel.
  const [library, setLibrary] = useState<SavedTheme[]>(initialLibrary);
  const [libName, setLibName] = useState('');
  const [libError, setLibError] = useState('');
  const [libBusy, setLibBusy] = useState(false);
  const libMax = premium ? 5 : 1;

  const reloadLibrary = useCallback(async () => {
    const res = await fetch(`/api/pro/theme/library?id=${encodeURIComponent(restaurantId)}`);
    const json = (await res.json().catch(() => ({}))) as { themes?: SavedTheme[] };
    setLibrary(json.themes ?? []);
  }, [restaurantId]);

  const saveCurrentToLibrary = async () => {
    const name = libName.trim();
    if (!name || libBusy) return;
    setLibBusy(true);
    setLibError('');
    const res = await fetch('/api/pro/theme/library', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: restaurantId, name, config: theme }),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (json.ok) {
      setLibName('');
      await reloadLibrary();
    } else setLibError(json.error ?? "Échec de l'enregistrement.");
    setLibBusy(false);
  };

  const removeSaved = async (themeId: string) => {
    if (libBusy) return;
    setLibBusy(true);
    setLibError('');
    const res = await fetch('/api/pro/theme/library', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: restaurantId, themeId }),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (json.ok) await reloadLibrary();
    else setLibError(json.error ?? 'Échec de la suppression.');
    setLibBusy(false);
  };

  const set = <K extends keyof MenuThemeConfig>(k: K, v: MenuThemeConfig[K]) =>
    setTheme((t) => ({ ...t, [k]: v }));

  // Le fond LIBRE prime sur le preset : l'aperçu doit montrer la palette DÉRIVÉE,
  // sinon il ment sur le rendu réel du menu public.
  const preset = (theme.bg ? deriveMenuPalette(theme.bg) : null) ?? MENU_THEME_PRESETS[theme.theme];
  // Même stack que le menu live (MENU_FONTS) → l'aperçu montre la vraie police.
  // Les vars CSS des webfonts sont chargées par le conteneur de la page apparence.
  const fontFamily = MENU_FONTS[theme.font].stack;

  // Auto-save en arrière-plan (comme la fiche) : POST /api/pro/theme, pas de
  // refresh de route → l'aperçu en direct (état local) reste fluide.
  const save = useCallback(async () => {
    const res = await fetch('/api/pro/theme', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: restaurantId, theme }),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    return { ok: res.ok && !!json.ok, error: json.error };
  }, [restaurantId, theme]);

  const { status, error, schedule } = useAutoSave(save);

  // Chaque changement de thème (clic preset/accent/police/photos/logo) planifie
  // une sauvegarde. On saute le premier rendu (état initial inchangé).
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    schedule();
  }, [theme, schedule]);

  // Publie l'état d'auto-save dans l'en-tête du workspace ; remise à idle en sortant.
  useEffect(() => {
    setSaveStatus(status);
  }, [status]);
  useEffect(() => () => setSaveStatus('idle'), []);

  // Réinitialiser = l'APPARENCE seulement. Le logo appartient à la fiche (autre
  // colonne, autre écran) : il n'est pas touché ici, même pas indirectement.
  const reset = () => {
    setTheme({
      theme: 'ivory',
      bg: null, // sinon « Réinitialiser » laisserait le fond libre actif
      accent: '#AE8324',
      font: 'serif',
      photos: true,
      show_logo: true,
    });
  };

  // Raccourci de confort quand la fiche n'a pas encore de logo : on envoie
  // l'image puis on écrit la COLONNE via l'action de la fiche (même validation
  // storage, même source de vérité) — pas dans le thème.
  const onLogo = async (file: File) => {
    setUploading(true);
    setUploadError('');
    const r = await uploadMenuImage(file);
    if (!r.ok || !r.url) {
      setUploading(false);
      setUploadError(r.error || "Échec de l'envoi du logo.");
      return;
    }
    const saved = await setListingLogoAction(restaurantId, r.url);
    setUploading(false);
    if (saved.error) {
      setUploadError(saved.error);
      return;
    }
    setLogo(r.url);
    // Ajouter un logo depuis l'apparence ⇒ on veut le voir : on l'active aussi.
    set('show_logo', true);
  };

  const disabled = !premium;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]" style={PREVIEW_FONT_VARS}>
      <link rel="stylesheet" href={PREVIEW_FONTS_HREF} />
      {/* Contrôles */}
      <div className="space-y-6">
        {!premium ? (
          <div className="rounded-xl border border-[var(--primary)]/30 bg-[var(--primary-container)] p-4 text-sm">
            <p className="font-bold text-[var(--primary)]">Personnalisation Premium</p>
            <p className="mt-1 text-[var(--text2)]">
              Le logo est inclus gratuitement — vous pouvez l&apos;ajouter dès maintenant.
              L&apos;ambiance, la couleur et la police nécessitent le forfait Premium : votre menu
              reste sur l&apos;ambiance ivoire par défaut.
            </p>
          </div>
        ) : null}

        <section className={disabled ? 'opacity-60 pointer-events-none' : ''}>
          <h3 className="mb-2 text-sm font-extrabold">Ambiance</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {MENU_THEME_ORDER.map((p) => (
              <button
                key={p}
                // Choisir une ambiance ANNULE le fond libre — sinon le preset
                // semblerait sans effet (le fond libre resterait prioritaire).
                onClick={() => setTheme((t) => ({ ...t, theme: p, bg: null }))}
                className={`rounded-xl border-2 p-2 text-left transition-colors ${theme.theme === p && !theme.bg ? 'border-[var(--primary)]' : 'border-[var(--border2)]'}`}
              >
                <div className="h-10 rounded-lg" style={{ background: MENU_THEME_PRESETS[p].bg, border: `1px solid ${MENU_THEME_PRESETS[p].line}` }}>
                  <div className="m-1.5 h-2 w-8 rounded" style={{ background: MENU_THEME_PRESETS[p].text }} />
                </div>
                <span className="mt-1 block text-xs font-semibold">{PRESET_LABEL[p]}</span>
              </button>
            ))}
          </div>

          {/* Fond LIBRE — l'échappatoire quand aucune des 8 ambiances ne colle à
              la marque du resto. Le reste de la palette (texte, séparateurs,
              surfaces) est dérivé automatiquement et reste lisible par construction. */}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <ColorField
              value={theme.bg ?? preset.bg}
              onChange={(c) => setTheme((t) => ({ ...t, bg: c, theme: nearestPreset(c) }))}
              presets={[]}
              active={theme.bg != null}
              label="Couleur de fond personnalisée"
            />
            <p className="min-w-0 flex-1 text-xs text-[var(--text3)]">
              {theme.bg ? (
                <>
                  Fond personnalisé <span className="font-semibold text-[var(--text2)]">{theme.bg}</span> — texte et
                  séparateurs adaptés automatiquement (contraste{' '}
                  {contrastRatio(preset.text, preset.bg).toFixed(1)}:1). Choisissez une ambiance
                  ci-dessus pour revenir.
                </>
              ) : (
                <>Ou choisissez librement votre couleur de fond — le texte s&apos;adapte pour rester lisible.</>
              )}
            </p>
          </div>
        </section>

        <section className={disabled ? 'opacity-60 pointer-events-none' : ''}>
          <h3 className="mb-2 text-sm font-extrabold">Couleur d&apos;accent</h3>
          <ColorField value={theme.accent} onChange={(c) => set('accent', c)} presets={MENU_ACCENTS} />
        </section>

        <section className={disabled ? 'opacity-60 pointer-events-none' : ''}>
          <h3 className="mb-2 text-sm font-extrabold">Police</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {MENU_FONT_ORDER.map((f) => (
              <button
                key={f}
                onClick={() => set('font', f)}
                title={MENU_FONTS[f].label}
                className={`rounded-lg border-2 px-3 py-2.5 text-sm font-semibold transition-colors ${theme.font === f ? 'border-[var(--primary)] text-[var(--primary)]' : 'border-[var(--border2)] hover:border-[var(--primary)]'}`}
                style={{ fontFamily: MENU_FONTS[f].stack }}
              >
                {MENU_FONTS[f].label}
              </button>
            ))}
          </div>
        </section>

        {/* Logo — c'est LE logo du restaurant (celui de la fiche), pas un second
            visuel. Ici on choisit seulement de l'afficher ou non sur le menu ;
            s'il n'existe pas encore on peut l'ajouter (ça remplit la fiche aussi). */}
        <section>
          <h3 className="mb-2 text-sm font-extrabold">Logo</h3>
          {logo ? (
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[var(--border2)] p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logo}
                alt=""
                className="h-12 w-12 shrink-0 rounded-lg bg-[var(--surface-var)] object-contain"
              />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">Afficher le logo en tête du menu</span>
                <span className="block text-xs text-[var(--text3)]">
                  C&apos;est le logo de votre établissement.{' '}
                  <Link
                    href={`/pro/r/${restaurantId}/fiche`}
                    className="font-semibold text-[var(--primary)] hover:underline"
                  >
                    Le changer ou le retirer
                  </Link>
                </span>
              </span>
              <input
                type="checkbox"
                checked={theme.show_logo}
                onChange={(e) => set('show_logo', e.target.checked)}
                className="h-4 w-4 shrink-0 accent-[var(--primary)]"
              />
            </label>
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--border2)] p-3">
              <p className="text-sm text-[var(--text2)]">
                Vous n&apos;avez pas encore de logo. Ajoutez-le pour l&apos;afficher en tête de votre
                menu — il servira aussi sur votre fiche.
              </p>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onLogo(f);
                  e.target.value = '';
                }}
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="mt-2 rounded-lg border border-[var(--border2)] px-3 py-2 text-sm font-semibold hover:border-[var(--primary)] disabled:opacity-50"
              >
                {uploading ? 'Envoi…' : 'Ajouter un logo'}
              </button>
            </div>
          )}
          {uploadError ? <p className="mt-2 text-sm font-medium text-red-500">{uploadError}</p> : null}
        </section>

        {/* Photos des plats — GRATUIT (mig. 122) : hors du bloc premium, tout le
            monde décide d'afficher ou non les photos sur son menu. */}
        <section>
          <h3 className="mb-2 text-sm font-extrabold">Photos des plats</h3>
          <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
            <input type="checkbox" checked={theme.photos} onChange={(e) => set('photos', e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
            Afficher les photos des plats sur le menu
          </label>
          <p className="mt-1 text-xs text-[var(--text3)]">
            Affichées par défaut. À vous de décider de les montrer ou non sur votre menu — c&apos;est gratuit.
          </p>
        </section>

        {/* ── Mes apparences (mig.159) ──────────────────────────────────
            Volontairement HORS du bloc premium : ranger un brouillon est ouvert
            à tous. C'est ce qui permet à un établissement qui sort du premium de
            conserver son travail — seule l'ACTIVATION reste gatée. */}
        <section className="pt-2">
          <h3 className="text-sm font-bold text-[var(--text)]">Mes apparences</h3>
          <p className="mt-1 text-xs text-[var(--text3)]">
            {libMax === 1
              ? 'Une apparence enregistrable sur la formule gratuite, cinq en Premium.'
              : 'Jusqu’à cinq apparences enregistrées.'}{' '}
            Elles sont conservées même si votre Premium prend fin.
          </p>

          {library.length === 0 ? (
            <p className="mt-2 text-xs text-[var(--text3)]">Aucune apparence enregistrée.</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {library.map((item) => (
                <li key={item.id} className="flex items-center gap-3 rounded-lg border border-[var(--border2)] px-3 py-2">
                  <span
                    aria-hidden
                    className="h-6 w-6 shrink-0 rounded-md border-2"
                    style={{ background: item.config.bg || MENU_THEME_PRESETS[item.config.theme].bg, borderColor: item.config.accent }}
                  />
                  <span className="min-w-0 flex-1 truncate text-sm text-[var(--text)]">{item.name}</span>
                  <button type="button" onClick={() => setTheme(item.config)} className="text-sm font-semibold text-[var(--text2)] hover:text-[var(--text)]">
                    Charger
                  </button>
                  <button type="button" onClick={() => removeSaved(item.id)} aria-label={`Supprimer ${item.name}`} className="text-sm text-[var(--text3)] hover:text-red-500">
                    Supprimer
                  </button>
                </li>
              ))}
            </ul>
          )}

          {library.length < libMax ? (
            <div className="mt-2 flex items-center gap-2">
              <input
                value={libName}
                onChange={(e) => setLibName(e.target.value)}
                maxLength={60}
                placeholder="Nom de l’apparence"
                className="min-w-0 flex-1 rounded-lg border border-[var(--border2)] bg-transparent px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--text3)]"
              />
              <button
                type="button"
                onClick={saveCurrentToLibrary}
                disabled={!libName.trim() || libBusy}
                className="rounded-lg border border-[var(--border2)] px-3 py-2 text-sm font-semibold text-[var(--text2)] hover:text-[var(--text)] disabled:opacity-40"
              >
                Enregistrer cette apparence
              </button>
            </div>
          ) : null}

          {libError ? <p className="mt-2 text-xs font-medium text-red-500">{libError}</p> : null}
        </section>

        <div className="flex items-center gap-3 pt-2 text-sm">
          <span className="text-[var(--text3)]">
            Vos changements sont enregistrés automatiquement.
          </span>
          {!isDefaultTheme(theme) ? (
            <button onClick={reset} className="font-semibold text-[var(--text2)] hover:text-[var(--text)]">Réinitialiser</button>
          ) : null}
          {status === 'error' && error ? <span className="font-medium text-red-500">{error}</span> : null}
        </div>
      </div>

      {/* Aperçu en direct */}
      <div className="lg:sticky lg:top-4 self-start">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--text3)]">Aperçu</p>
        <div className="rounded-2xl border border-[var(--border2)] p-4" style={{ background: preset.bg, fontFamily }}>
          {logo && theme.show_logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className="mx-auto mb-3 h-14 w-14 rounded-lg object-contain" />
          ) : null}
          <div className="mb-3 text-center">
            <div style={{ color: theme.accent, fontWeight: 800, letterSpacing: '0.05em', fontSize: 12, textTransform: 'uppercase' }}>Notre carte</div>
            <div style={{ height: 2, width: 40, background: theme.accent, margin: '6px auto 0' }} />
          </div>
          {[
            { n: 'Ramen tonkotsu', d: 'Bouillon de porc 12 h, œuf mollet', p: '14,50 €', sig: true },
            { n: 'Gyoza maison', d: 'Raviolis grillés, sauce ponzu', p: '7,00 €', sig: false },
          ].map((it, i) => (
            <div key={i} className="py-2.5" style={{ borderTop: i ? `1px solid ${preset.line}` : 'none' }}>
              <div className="flex items-baseline justify-between gap-2">
                <span style={{ color: preset.text, fontWeight: 700 }}>
                  {it.n}
                  {it.sig ? <span style={{ color: theme.accent, marginLeft: 6, fontSize: 11, fontWeight: 800 }}>★</span> : null}
                </span>
                <span style={{ color: theme.accent, fontWeight: 700 }}>{it.p}</span>
              </div>
              <p style={{ color: preset.sub, fontSize: 13, marginTop: 2 }}>{it.d}</p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-[var(--text3)]">Aperçu indicatif — le menu réel s&apos;ouvre avec « Voir le menu public ».</p>
      </div>
    </div>
  );
}
