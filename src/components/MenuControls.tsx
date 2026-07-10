'use client';
import { useEffect, useRef, useState } from 'react';

// ─── Barre d'outils du menu web : recherche + filtres + langue ───────────────
//
// Le menu est rendu CÔTÉ SERVEUR (SEO + no-JS + îlots <RateDish/>). Ce composant
// client l'enrobe et l'améliore progressivement :
//  • recherche : filtre live sur `data-s` (nom + description + tags, localisés) ;
//  • filtres   : puces « Tout / ✦ Signature / régimes » sur `data-sig`/`data-diet` ;
//  • langue    : navigue vers `?lang=xx` (le serveur re-render dans la langue).
// Le filtrage bascule `display` sur les `[data-mi]` déjà rendus (aucun re-render
// React de l'arbre serveur — la référence `children` est stable), puis masque
// les sections `[data-ms]` devenues vides.

const LOCALE_NAMES: Record<string, string> = {
  fr: 'Français',
  en: 'English',
  es: 'Español',
  de: 'Deutsch',
  it: 'Italiano',
};
const LOCALE_FLAG: Record<string, string> = {
  fr: '🇫🇷',
  en: '🇬🇧',
  es: '🇪🇸',
  de: '🇩🇪',
  it: '🇮🇹',
};

interface Theme {
  bg: string;
  card: string;
  text: string;
  sub: string;
  line: string;
  accent: string;
  dark: boolean;
}

interface Props {
  children: React.ReactNode;
  locale: string;
  /** Langues proposées par le sélecteur. */
  locales: string[];
  dietFilters: { slug: string; label: string }[];
  hasSignature: boolean;
  ui: { search: string; all: string; signature: string; noResults: string };
  theme: Theme;
}

export default function MenuControls({
  children,
  locale,
  locales,
  dietFilters,
  hasSignature,
  ui,
  theme,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<string>('all'); // 'all' | 'signature' | 'diet:<slug>'
  const [noResults, setNoResults] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    // Même normalisation que `data-s` côté serveur → recherche insensible aux accents.
    const q = query
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '');
    const dietSlug = filter.startsWith('diet:') ? filter.slice(5) : null;
    let visible = 0;
    container.querySelectorAll<HTMLElement>('[data-mi]').forEach((el) => {
      const s = el.getAttribute('data-s') || '';
      const matchSearch = !q || s.includes(q);
      const matchFilter =
        filter === 'all'
          ? true
          : filter === 'signature'
            ? el.getAttribute('data-sig') === '1'
            : dietSlug
              ? (el.getAttribute('data-diet') || '').split(' ').includes(dietSlug)
              : true;
      const show = matchSearch && matchFilter;
      el.style.display = show ? '' : 'none';
      if (show) visible++;
    });
    // Masquer les sections dont plus aucun plat n'est visible.
    container.querySelectorAll<HTMLElement>('[data-ms]').forEach((sec) => {
      const any = Array.from(sec.querySelectorAll<HTMLElement>('[data-mi]')).some(
        (el) => el.style.display !== 'none',
      );
      sec.style.display = any ? '' : 'none';
    });
    // Multi-menu : masquer tout un bloc menu (titre inclus) s'il ne reste aucun
    // plat visible dedans.
    container.querySelectorAll<HTMLElement>('[data-menu]').forEach((menuEl) => {
      const any = Array.from(menuEl.querySelectorAll<HTMLElement>('[data-mi]')).some(
        (el) => el.style.display !== 'none',
      );
      menuEl.style.display = any ? '' : 'none';
    });
    setNoResults(visible === 0);
  }, [query, filter]);

  const switchLang = (code: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('lang', code);
    window.location.href = url.toString();
  };

  const chipStyle = (active: boolean): React.CSSProperties => ({
    flexShrink: 0,
    padding: '7px 13px',
    borderRadius: 999,
    border: `1px solid ${active ? theme.accent : theme.line}`,
    background: active ? theme.accent : 'transparent',
    color: active ? (theme.dark ? '#141018' : '#fff') : theme.sub,
    fontSize: 12.5,
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    fontFamily: 'inherit',
  });

  const showChips = hasSignature || dietFilters.length > 0;
  const showLang = locales.length > 1;

  return (
    <>
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 30,
          background: theme.bg,
          marginTop: 22,
          paddingTop: 12,
          paddingBottom: 10,
          borderBottom: `1px solid ${theme.line}`,
        }}
      >
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <span
              aria-hidden
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: theme.sub,
                fontSize: 15,
                pointerEvents: 'none',
              }}
            >
              ⌕
            </span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={ui.search}
              aria-label={ui.search}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: query ? '10px 34px 10px 32px' : '10px 12px 10px 32px',
                borderRadius: 12,
                border: `1px solid ${theme.line}`,
                background: theme.card,
                color: theme.text,
                fontSize: 14,
                fontFamily: 'inherit',
                outline: 'none',
              }}
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="×"
                style={{
                  position: 'absolute',
                  right: 6,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  border: 'none',
                  background: 'none',
                  color: theme.sub,
                  fontSize: 18,
                  lineHeight: 1,
                  cursor: 'pointer',
                  padding: 4,
                }}
              >
                ×
              </button>
            ) : null}
          </div>

          {showLang ? (
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => setLangOpen((v) => !v)}
                aria-label="Language"
                aria-expanded={langOpen}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '9px 12px',
                  borderRadius: 12,
                  border: `1px solid ${theme.line}`,
                  background: theme.card,
                  color: theme.text,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <span aria-hidden style={{ fontSize: 15 }}>
                  {LOCALE_FLAG[locale] ?? '🌐'}
                </span>
                {locale.toUpperCase()}
              </button>
              {langOpen ? (
                <>
                  {/* backdrop fermeture au clic extérieur */}
                  <div
                    onClick={() => setLangOpen(false)}
                    style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 'calc(100% + 6px)',
                      zIndex: 41,
                      background: theme.card,
                      border: `1px solid ${theme.line}`,
                      borderRadius: 12,
                      padding: 4,
                      minWidth: 150,
                      boxShadow: '0 8px 28px rgba(0,0,0,0.18)',
                    }}
                  >
                    {locales.map((code) => {
                      const active = code === locale;
                      return (
                        <button
                          key={code}
                          type="button"
                          onClick={() => (active ? setLangOpen(false) : switchLang(code))}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            width: '100%',
                            textAlign: 'left',
                            padding: '9px 10px',
                            borderRadius: 9,
                            border: 'none',
                            background: active ? theme.accent + '22' : 'transparent',
                            color: theme.text,
                            fontSize: 13.5,
                            fontWeight: active ? 700 : 500,
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                          }}
                        >
                          <span aria-hidden style={{ fontSize: 16 }}>
                            {LOCALE_FLAG[code] ?? '🌐'}
                          </span>
                          {LOCALE_NAMES[code] ?? code.toUpperCase()}
                        </button>
                      );
                    })}
                  </div>
                </>
              ) : null}
            </div>
          ) : null}
        </div>

        {showChips ? (
          <div
            style={{
              display: 'flex',
              gap: 8,
              overflowX: 'auto',
              marginTop: 10,
              paddingBottom: 2,
              scrollbarWidth: 'none',
            }}
          >
            <button type="button" onClick={() => setFilter('all')} style={chipStyle(filter === 'all')}>
              {ui.all}
            </button>
            {hasSignature ? (
              <button
                type="button"
                onClick={() => setFilter('signature')}
                style={chipStyle(filter === 'signature')}
              >
                ✦ {ui.signature}
              </button>
            ) : null}
            {dietFilters.map((d) => (
              <button
                key={d.slug}
                type="button"
                onClick={() => setFilter(`diet:${d.slug}`)}
                style={chipStyle(filter === `diet:${d.slug}`)}
              >
                {d.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <div ref={containerRef}>{children}</div>

      <p
        style={{
          display: noResults ? 'block' : 'none',
          textAlign: 'center',
          color: theme.sub,
          fontSize: 14,
          margin: '36px 0 0',
        }}
      >
        {ui.noResults}
      </p>
    </>
  );
}
