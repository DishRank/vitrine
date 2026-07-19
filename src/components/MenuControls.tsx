'use client';
import { useEffect, useRef, useState } from 'react';
import FlagIcon from './FlagIcon';

// ─── Barre d'outils du menu web : recherche + filtres + langue + zoom photo ──
//
// Le menu est rendu CÔTÉ SERVEUR (SEO + no-JS + îlots <RateDish/>). Ce composant
// client l'enrobe et l'améliore progressivement :
//  • recherche      : filtre live sur `data-s` (nom + desc + tags, localisés) ;
//  • filtres        : puces « Tout / ✦ Signature / régimes » (data-sig/data-diet) ;
//  • sans allergène : exclusion (data-allergens) → masque les plats concernés ;
//  • onglets menus  : bascule entre plusieurs menus (data-menu-id) ;
//  • langue         : navigue vers `?lang=xx` (le serveur re-render) ;
//  • zoom photo     : tap sur une photo → lightbox plein écran (data-zoom).
// Le filtrage bascule `display` sur les `[data-mi]` déjà rendus (référence
// `children` stable → pas de re-render React de l'arbre serveur), puis masque
// les sections `[data-ms]` et menus `[data-menu]` devenus vides.

const LOCALE_NAMES: Record<string, string> = {
  fr: 'Français',
  en: 'English',
  es: 'Español',
  de: 'Deutsch',
  it: 'Italiano',
};

interface Theme {
  bg: string;
  card: string;
  text: string;
  sub: string;
  line: string;
  accent: string;
  /** Encre lisible SUR l'accent (dérivée de la luminance de l'accent). */
  accentOn: string;
  dark: boolean;
}
interface Tag {
  slug: string;
  label: string;
  icon: string;
}

interface Props {
  children: React.ReactNode;
  locale: string;
  locales: string[];
  dietFilters: Tag[];
  allergenFilters: Tag[];
  menuTabs: { id: string; name: string }[];
  hasSignature: boolean;
  ui: { search: string; all: string; signature: string; noResults: string; avoidAllergens: string };
  theme: Theme;
}

export default function MenuControls({
  children,
  locale,
  locales,
  dietFilters,
  allergenFilters,
  menuTabs,
  hasSignature,
  ui,
  theme,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<string>('all'); // 'all' | 'signature' | 'diet:<slug>'
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [activeMenu, setActiveMenu] = useState<string>(menuTabs.length > 1 ? menuTabs[0].id : 'all');
  const [noResults, setNoResults] = useState(false);
  const [allergenOpen, setAllergenOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [zoomSrc, setZoomSrc] = useState<string | null>(null);
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

  // ── Filtrage (search + filtre + allergènes exclus + onglet menu) ───────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
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
      const allergens = (el.getAttribute('data-allergens') || '').split(' ').filter(Boolean);
      const matchAllergen = excluded.size === 0 || !allergens.some((a) => excluded.has(a));
      const menuId = el.closest('[data-menu-id]')?.getAttribute('data-menu-id') || '';
      const matchMenu = activeMenu === 'all' || menuId === activeMenu;
      const show = matchSearch && matchFilter && matchAllergen && matchMenu;
      el.style.display = show ? '' : 'none';
      if (show) visible++;
    });
    container.querySelectorAll<HTMLElement>('[data-ms]').forEach((sec) => {
      const any = Array.from(sec.querySelectorAll<HTMLElement>('[data-mi]')).some(
        (el) => el.style.display !== 'none',
      );
      sec.style.display = any ? '' : 'none';
    });
    container.querySelectorAll<HTMLElement>('[data-menu]').forEach((menuEl) => {
      const isActive = activeMenu === 'all' || menuEl.getAttribute('data-menu-id') === activeMenu;
      const any = Array.from(menuEl.querySelectorAll<HTMLElement>('[data-mi]')).some(
        (el) => el.style.display !== 'none',
      );
      menuEl.style.display = isActive && any ? '' : 'none';
    });
    setNoResults(visible === 0);
  }, [query, filter, excluded, activeMenu]);

  // ── Lightbox : fermeture au clavier (Échap) ────────────────────────────────
  useEffect(() => {
    if (!zoomSrc) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setZoomSrc(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [zoomSrc]);

  // ── Dropdown langue : fermeture au clic extérieur + Échap ──────────────────
  useEffect(() => {
    if (!langOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node)) setLangOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLangOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('keydown', onKey);
    };
  }, [langOpen]);

  const switchLang = (code: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('lang', code);
    window.location.href = url.toString();
  };

  const toggleExcluded = (slug: string) =>
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });

  // Délégation : un tap sur une photo `[data-zoom]` ouvre la lightbox.
  const onContainerClick = (e: React.MouseEvent) => {
    const el = (e.target as HTMLElement).closest('[data-zoom]');
    const src = el?.getAttribute('data-zoom');
    if (src) setZoomSrc(src);
  };

  const chip = (active: boolean): React.CSSProperties => ({
    flexShrink: 0,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '7px 13px',
    borderRadius: 999,
    border: `1px solid ${active ? theme.accent : theme.line}`,
    background: active ? theme.accent : 'transparent',
    color: active ? theme.accentOn : theme.sub,
    fontSize: 12.5,
    fontWeight: 700,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    fontFamily: 'inherit',
  });

  const showChips = hasSignature || dietFilters.length > 0 || allergenFilters.length > 0;
  const activeFilterCount = (filter !== 'all' ? 1 : 0) + excluded.size;
  const showLang = locales.length > 1;
  const showTabs = menuTabs.length > 1;

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
        {/* Onglets menus */}
        {showTabs ? (
          <div
            style={{
              display: 'flex',
              gap: 6,
              overflowX: 'auto',
              marginBottom: 10,
              scrollbarWidth: 'none',
            }}
          >
            {menuTabs.map((m) => {
              const active = m.id === activeMenu;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setActiveMenu(m.id)}
                  style={{
                    flexShrink: 0,
                    padding: '8px 15px',
                    borderRadius: 12,
                    border: 'none',
                    background: active ? theme.accent : theme.card,
                    color: active ? theme.accentOn : theme.text,
                    fontSize: 13.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    fontFamily: 'inherit',
                  }}
                >
                  {m.name}
                </button>
              );
            })}
          </div>
        ) : null}

        {/* Recherche + langue */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
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
                fontSize: 16,
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

          {/* Bouton Filtres (icône curseurs + badge). Les puces sont repliées
              par défaut → la barre reste sur UNE ligne (fix « trop de place ») ;
              un tap déplie le panneau de filtres sous la recherche. */}
          {showChips ? (
            <button
              type="button"
              onClick={() => setFiltersOpen((v) => !v)}
              aria-expanded={filtersOpen}
              aria-label="Filtres"
              title="Filtres"
              style={{
                position: 'relative',
                flexShrink: 0,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 42,
                width: 46,
                borderRadius: 12,
                border: `1px solid ${filtersOpen || activeFilterCount > 0 ? theme.accent : theme.line}`,
                background: activeFilterCount > 0 ? theme.accent : theme.card,
                color: activeFilterCount > 0 ? theme.accentOn : theme.sub,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <line x1="4" y1="7" x2="20" y2="7" />
                <line x1="4" y1="12" x2="20" y2="12" />
                <line x1="4" y1="17" x2="20" y2="17" />
                <circle cx="9" cy="7" r="2.4" fill={theme.bg} />
                <circle cx="15" cy="12" r="2.4" fill={theme.bg} />
                <circle cx="8" cy="17" r="2.4" fill={theme.bg} />
              </svg>
              {activeFilterCount > 0 ? (
                <span
                  aria-hidden
                  style={{
                    position: 'absolute',
                    top: -5,
                    right: -5,
                    minWidth: 16,
                    height: 16,
                    padding: '0 4px',
                    borderRadius: 8,
                    background: '#C0604E',
                    color: '#fff',
                    fontSize: 10,
                    fontWeight: 800,
                    lineHeight: '16px',
                    textAlign: 'center',
                    boxShadow: `0 0 0 2px ${theme.bg}`,
                  }}
                >
                  {activeFilterCount}
                </span>
              ) : null}
            </button>
          ) : null}

          {/* Sélecteur de langue : dropdown (trigger = drapeau de la langue
              active + chevron, aucun texte). S'ouvre sur une liste — scale à 5+
              langues sans déborder la barre, contrairement à des puces inline. */}
          {showLang ? (
            <div ref={langRef} style={{ position: 'relative', flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => setLangOpen((v) => !v)}
                aria-haspopup="listbox"
                aria-expanded={langOpen}
                aria-label={`Langue : ${LOCALE_NAMES[locale] ?? locale}`}
                title={LOCALE_NAMES[locale] ?? locale}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  height: 42,
                  padding: '0 10px',
                  borderRadius: 12,
                  border: `1px solid ${langOpen ? theme.accent : theme.line}`,
                  background: theme.card,
                  color: theme.sub,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <FlagIcon code={locale} size={20} />
                <span aria-hidden style={{ fontSize: 10, lineHeight: 1, transform: langOpen ? 'rotate(180deg)' : undefined }}>
                  ▾
                </span>
              </button>
              {langOpen ? (
                <ul
                  role="listbox"
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: 6,
                    zIndex: 40,
                    minWidth: 160,
                    padding: 4,
                    listStyle: 'none',
                    borderRadius: 12,
                    border: `1px solid ${theme.line}`,
                    background: theme.card,
                    boxShadow: '0 10px 30px rgba(0,0,0,0.16)',
                  }}
                >
                  {locales.map((code) => {
                    const active = code === locale;
                    return (
                      <li key={code}>
                        <button
                          type="button"
                          role="option"
                          aria-selected={active}
                          onClick={() => {
                            setLangOpen(false);
                            if (!active) switchLang(code);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 9,
                            width: '100%',
                            padding: '9px 10px',
                            border: 'none',
                            borderRadius: 8,
                            background: active ? theme.accent + '22' : 'transparent',
                            color: theme.text,
                            fontSize: 13.5,
                            fontWeight: active ? 700 : 500,
                            cursor: 'pointer',
                            textAlign: 'left',
                            fontFamily: 'inherit',
                          }}
                        >
                          <FlagIcon code={code} size={18} />
                          {LOCALE_NAMES[code] ?? code}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Panneau de filtres — REPLIÉ par défaut (ouvert via le bouton Filtres) :
            la barre reste compacte. Puces Tout / Signature / régimes + exclusion
            d'allergènes ; flexWrap → passent à la ligne sans défilement horizontal. */}
        {showChips && filtersOpen ? (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              marginTop: 10,
            }}
          >
            <button type="button" onClick={() => setFilter('all')} style={chip(filter === 'all')}>
              {ui.all}
            </button>
            {hasSignature ? (
              <button
                type="button"
                onClick={() => setFilter('signature')}
                style={chip(filter === 'signature')}
              >
                ✦ {ui.signature}
              </button>
            ) : null}
            {dietFilters.map((d) => (
              <button
                key={d.slug}
                type="button"
                onClick={() => setFilter(`diet:${d.slug}`)}
                style={chip(filter === `diet:${d.slug}`)}
              >
                {d.icon ? <span aria-hidden>{d.icon}</span> : null}
                {d.label}
              </button>
            ))}
            {allergenFilters.length > 0 ? (
              <button
                type="button"
                onClick={() => setAllergenOpen((v) => !v)}
                aria-expanded={allergenOpen}
                style={{
                  ...chip(excluded.size > 0),
                  border: `1px solid ${excluded.size > 0 ? '#C0604E' : theme.line}`,
                  background: excluded.size > 0 ? '#C0604E' : 'transparent',
                  color: excluded.size > 0 ? '#fff' : theme.sub,
                }}
              >
                🚫 {ui.avoidAllergens}
                {excluded.size > 0 ? ` · ${excluded.size}` : ''}
              </button>
            ) : null}
          </div>
        ) : null}

        {/* Panneau exclusion allergènes */}
        {allergenOpen && allergenFilters.length > 0 ? (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 7,
              marginTop: 10,
              paddingTop: 10,
              borderTop: `1px solid ${theme.line}`,
            }}
          >
            {allergenFilters.map((a) => {
              const off = excluded.has(a.slug);
              return (
                <button
                  key={a.slug}
                  type="button"
                  onClick={() => toggleExcluded(a.slug)}
                  aria-pressed={off}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '6px 11px',
                    borderRadius: 999,
                    border: `1px solid ${off ? '#C0604E' : theme.line}`,
                    background: off ? '#C0604E22' : 'transparent',
                    color: off ? '#C0604E' : theme.sub,
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                    textDecoration: off ? 'line-through' : 'none',
                    fontFamily: 'inherit',
                  }}
                >
                  <span aria-hidden>{a.icon}</span>
                  {a.label}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div ref={containerRef} onClick={onContainerClick}>
        {children}
      </div>

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

      {/* Lightbox photo plein écran */}
      {zoomSrc ? (
        <div
          onClick={() => setZoomSrc(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 70,
            background: 'rgba(8,6,18,0.92)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            cursor: 'zoom-out',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={zoomSrc}
            alt=""
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              borderRadius: 12,
              objectFit: 'contain',
              boxShadow: '0 12px 48px rgba(0,0,0,0.5)',
            }}
          />
          <button
            type="button"
            aria-label="×"
            onClick={() => setZoomSrc(null)}
            style={{
              position: 'fixed',
              top: 16,
              right: 16,
              width: 40,
              height: 40,
              borderRadius: 20,
              border: 'none',
              background: 'rgba(255,255,255,0.15)',
              color: '#fff',
              fontSize: 22,
              lineHeight: 1,
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>
      ) : null}
    </>
  );
}
