'use client';

import { useRef, useState, useTransition } from 'react';
import { updateThemeAction } from '../mediaActions';
import { uploadMenuImage } from '../imageUpload';
import {
  MENU_THEME_PRESETS,
  MENU_THEME_ORDER,
  PRESET_LABEL,
  MENU_ACCENTS,
  isDefaultTheme,
  type MenuThemeConfig,
  type MenuThemePreset,
} from '../themeConstants';

export default function ThemeEditor({
  restaurantId,
  initial,
  premium,
}: {
  restaurantId: string;
  initial: MenuThemeConfig;
  premium: boolean;
}) {
  const [theme, setTheme] = useState<MenuThemeConfig>(initial);
  const [pending, start] = useTransition();
  const [notice, setNotice] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = <K extends keyof MenuThemeConfig>(k: K, v: MenuThemeConfig[K]) =>
    setTheme((t) => ({ ...t, [k]: v }));

  const preset = MENU_THEME_PRESETS[theme.theme];
  const fontFamily = theme.font === 'serif' ? 'Georgia, "Times New Roman", serif' : 'system-ui, sans-serif';

  const save = () =>
    start(async () => {
      setNotice('');
      const r = await updateThemeAction(restaurantId, theme);
      setNotice(r.ok ? 'Apparence enregistrée ✓' : r.error || 'Erreur.');
    });

  const reset = () => {
    const def: MenuThemeConfig = { theme: 'ivory', accent: '#AE8324', font: 'serif', photos: true, logo_url: null };
    setTheme(def);
    start(async () => {
      const r = await updateThemeAction(restaurantId, def);
      setNotice(r.ok ? 'Apparence réinitialisée.' : r.error || 'Erreur.');
    });
  };

  const onLogo = async (file: File) => {
    setUploading(true);
    setNotice('');
    const r = await uploadMenuImage(file);
    setUploading(false);
    if (r.ok && r.url) set('logo_url', r.url);
    else setNotice(r.error || "Échec de l'envoi du logo.");
  };

  const disabled = !premium;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      {/* Contrôles */}
      <div className="space-y-6">
        {!premium ? (
          <div className="rounded-xl border border-[var(--primary)]/30 bg-[var(--primary-container)] p-4 text-sm">
            <p className="font-bold text-[var(--primary)]">Personnalisation Premium</p>
            <p className="mt-1 text-[var(--text2)]">
              Vous pouvez explorer les options ci-dessous, mais l&apos;enregistrement d&apos;une
              apparence personnalisée nécessite le forfait Premium. Votre menu reste sur l&apos;ambiance
              ivoire par défaut.
            </p>
          </div>
        ) : null}

        <section className={disabled ? 'opacity-60 pointer-events-none' : ''}>
          <h3 className="mb-2 text-sm font-extrabold">Ambiance</h3>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {MENU_THEME_ORDER.map((p) => (
              <button
                key={p}
                onClick={() => set('theme', p)}
                className={`rounded-xl border-2 p-2 text-left transition-colors ${theme.theme === p ? 'border-[var(--primary)]' : 'border-[var(--border2)]'}`}
              >
                <div className="h-10 rounded-lg" style={{ background: MENU_THEME_PRESETS[p].bg, border: `1px solid ${MENU_THEME_PRESETS[p].line}` }}>
                  <div className="m-1.5 h-2 w-8 rounded" style={{ background: MENU_THEME_PRESETS[p].text }} />
                </div>
                <span className="mt-1 block text-xs font-semibold">{PRESET_LABEL[p]}</span>
              </button>
            ))}
          </div>
        </section>

        <section className={disabled ? 'opacity-60 pointer-events-none' : ''}>
          <h3 className="mb-2 text-sm font-extrabold">Couleur d&apos;accent</h3>
          <div className="flex flex-wrap gap-2">
            {MENU_ACCENTS.map((c) => (
              <button
                key={c}
                onClick={() => set('accent', c)}
                aria-label={c}
                className={`h-9 w-9 rounded-full border-2 ${theme.accent === c ? 'border-[var(--text)]' : 'border-transparent'}`}
                style={{ background: c }}
              />
            ))}
          </div>
        </section>

        <section className={disabled ? 'opacity-60 pointer-events-none' : ''}>
          <h3 className="mb-2 text-sm font-extrabold">Police</h3>
          <div className="flex gap-2">
            {(['serif', 'modern'] as const).map((f) => (
              <button
                key={f}
                onClick={() => set('font', f)}
                className={`rounded-lg border-2 px-4 py-2 text-sm font-semibold ${theme.font === f ? 'border-[var(--primary)] text-[var(--primary)]' : 'border-[var(--border2)]'}`}
                style={{ fontFamily: f === 'serif' ? 'Georgia, serif' : 'system-ui, sans-serif' }}
              >
                {f === 'serif' ? 'Élégante (serif)' : 'Moderne'}
              </button>
            ))}
          </div>
        </section>

        <section className={disabled ? 'opacity-60 pointer-events-none' : ''}>
          <h3 className="mb-2 text-sm font-extrabold">Logo (en tête du menu)</h3>
          <div className="flex items-center gap-3">
            {theme.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={theme.logo_url} alt="" className="h-12 w-12 rounded-lg object-contain bg-[var(--surface-var)]" />
            ) : null}
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onLogo(f); e.target.value = ''; }} />
            <button onClick={() => fileRef.current?.click()} disabled={uploading} className="rounded-lg border border-[var(--border2)] px-3 py-2 text-sm font-semibold hover:border-[var(--primary)] disabled:opacity-50">
              {uploading ? 'Envoi…' : theme.logo_url ? 'Changer' : 'Ajouter un logo'}
            </button>
            {theme.logo_url ? <button onClick={() => set('logo_url', null)} className="text-sm font-semibold text-red-500 hover:underline">Retirer</button> : null}
          </div>
        </section>

        <section className={disabled ? 'opacity-60 pointer-events-none' : ''}>
          <h3 className="mb-2 text-sm font-extrabold">Photos des plats</h3>
          <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
            <input type="checkbox" checked={theme.photos} onChange={(e) => set('photos', e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
            Afficher les photos des plats sur le menu
          </label>
          <p className="mt-1 text-xs text-[var(--text3)]">
            Les photos sont incluses gratuitement et affichées par défaut. Les masquer (choix de
            présentation) fait partie de la personnalisation Premium.
          </p>
        </section>

        <div className="flex items-center gap-3 pt-2">
          <button onClick={save} disabled={pending} className="rounded-xl bg-[var(--primary)] px-5 py-3 text-[15px] font-bold text-white hover:opacity-90 disabled:opacity-50">
            {pending ? 'Enregistrement…' : 'Enregistrer l’apparence'}
          </button>
          {!isDefaultTheme(theme) ? (
            <button onClick={reset} disabled={pending} className="text-sm font-semibold text-[var(--text2)] hover:text-[var(--text)]">Réinitialiser</button>
          ) : null}
          {notice ? <span className="text-sm font-medium text-[var(--text2)]">{notice}</span> : null}
        </div>
      </div>

      {/* Aperçu en direct */}
      <div className="lg:sticky lg:top-4 self-start">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--text3)]">Aperçu</p>
        <div className="rounded-2xl border border-[var(--border2)] p-4" style={{ background: preset.bg, fontFamily }}>
          {theme.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={theme.logo_url} alt="" className="mx-auto mb-3 h-14 w-14 rounded-lg object-contain" />
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
