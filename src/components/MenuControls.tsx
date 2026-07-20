"use client";
import { useEffect, useRef, useState } from "react";
import FlagIcon from "./FlagIcon";

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
  fr: "Français",
  en: "English",
  es: "Español",
  de: "Deutsch",
  it: "Italiano",
};

// Keyframes de la feuille de filtres. Chacune ne déclare qu'UN bout (`from` ou
// `to`) : l'autre extrémité est le style calculé de l'élément, donc l'état de
// repos — celui qu'on voit si l'animation ne joue pas.
// S'y ajoutent les glissements d'onglet (bascule entre plusieurs cartes). Cette
// route rend son propre <html> et n'a donc PAS accès à globals.css, où vivent
// les `.tab-panel-*` de l'espace pro : les keyframes doivent être embarquées ici.
const MENU_KEYFRAMES = `
@keyframes dr-sheet-in { from { transform: translateY(100%) } }
@keyframes dr-sheet-out { to { transform: translateY(100%) } }
@keyframes dr-tab-next { from { opacity: 0; transform: translateX(16px) } }
@keyframes dr-tab-prev { from { opacity: 0; transform: translateX(-16px) } }
.dr-tab-next { animation: dr-tab-next 260ms cubic-bezier(0.32, 0.72, 0, 1) }
.dr-tab-prev { animation: dr-tab-prev 260ms cubic-bezier(0.32, 0.72, 0, 1) }
@media (prefers-reduced-motion: reduce) {
  .dr-tab-next, .dr-tab-prev { animation: dr-fade-in 160ms ease-out }
}
@keyframes dr-fade-in { from { opacity: 0 } }
@keyframes dr-fade-out { to { opacity: 0 } }
`;

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
  ui: {
    search: string;
    all: string;
    signature: string;
    noResults: string;
    avoidAllergens: string;
    filtersTitle: string;
    sectionShow: string;
    signatureHelp: string;
    dietHelp: string;
    allergenHelp: string;
    allergenWarning: string;
    reset: string;
    applyNone: string;
    applyOne: string;
    applyMany: string;
  };
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
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<string>("all"); // 'all' | 'signature' | 'diet:<slug>'
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [activeMenu, setActiveMenu] = useState<string>(
    menuTabs.length > 1 ? menuTabs[0].id : "all",
  );
  // Nombre de plats retenus par les filtres : alimente à la fois le message
  // « aucun résultat » et le compteur du bouton de validation de la modale
  // (savoir combien de plats restent AVANT de refermer).
  const [visibleCount, setVisibleCount] = useState<number | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // Animation de la feuille : `mounted` maintient le nœud dans le DOM pendant la
  // fermeture, sans quoi elle disparaîtrait d'un coup, sans animation de sortie.
  const [filtersMounted, setFiltersMounted] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const sheetMs = reduceMotion ? 0 : 260;
  // Encore monté alors que l'intention est « fermé » = phase de sortie.
  const filtersClosing = filtersMounted && !filtersOpen;
  const [zoomSrc, setZoomSrc] = useState<string | null>(null);
  const [langOpen, setLangOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);

  // ── Filtrage (search + filtre + allergènes exclus + onglet menu) ───────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const q = query.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const dietSlug = filter.startsWith("diet:") ? filter.slice(5) : null;
    let visible = 0;
    container.querySelectorAll<HTMLElement>("[data-mi]").forEach((el) => {
      const s = el.getAttribute("data-s") || "";
      const matchSearch = !q || s.includes(q);
      const matchFilter =
        filter === "all"
          ? true
          : filter === "signature"
            ? el.getAttribute("data-sig") === "1"
            : dietSlug
              ? (el.getAttribute("data-diet") || "")
                  .split(" ")
                  .includes(dietSlug)
              : true;
      const allergens = (el.getAttribute("data-allergens") || "")
        .split(" ")
        .filter(Boolean);
      const matchAllergen =
        excluded.size === 0 || !allergens.some((a) => excluded.has(a));
      const menuId =
        el.closest("[data-menu-id]")?.getAttribute("data-menu-id") || "";
      const matchMenu = activeMenu === "all" || menuId === activeMenu;
      const show = matchSearch && matchFilter && matchAllergen && matchMenu;
      el.style.display = show ? "" : "none";
      if (show) visible++;
    });
    container.querySelectorAll<HTMLElement>("[data-ms]").forEach((sec) => {
      const any = Array.from(
        sec.querySelectorAll<HTMLElement>("[data-mi]"),
      ).some((el) => el.style.display !== "none");
      sec.style.display = any ? "" : "none";
    });
    container.querySelectorAll<HTMLElement>("[data-menu]").forEach((menuEl) => {
      const isActive =
        activeMenu === "all" ||
        menuEl.getAttribute("data-menu-id") === activeMenu;
      const any = Array.from(
        menuEl.querySelectorAll<HTMLElement>("[data-mi]"),
      ).some((el) => el.style.display !== "none");
      menuEl.style.display = isActive && any ? "" : "none";
    });
    setVisibleCount(visible);
  }, [query, filter, excluded, activeMenu]);

  // ── Glissement à la bascule d'onglet (plusieurs cartes) ────────────────────
  // Effet DÉDIÉ, qui ne dépend que de `activeMenu` : rangé dans l'effet de
  // filtrage ci-dessus, il rejouerait l'animation à chaque frappe de recherche.
  // Les cartes sont toutes déjà dans le DOM (rendu serveur, montrées/masquées
  // par `display`) → on anime celle qu'on vient de révéler.
  const prevMenuIndex = useRef(0);
  useEffect(() => {
    if (menuTabs.length < 2) return;
    const index = menuTabs.findIndex((m) => m.id === activeMenu);
    if (index < 0) return;
    const dir = index >= prevMenuIndex.current ? "next" : "prev";
    prevMenuIndex.current = index;
    const el = containerRef.current?.querySelector<HTMLElement>(
      `[data-menu-id="${activeMenu}"]`,
    );
    if (!el) return;
    el.classList.remove("dr-tab-next", "dr-tab-prev");
    // Reflow forcé : retirer puis reposer la classe dans la même frame ne
    // redémarre pas l'animation sans cette lecture de layout.
    void el.offsetWidth;
    el.classList.add(`dr-tab-${dir}`);
  }, [activeMenu, menuTabs]);

  // ── Modale filtres : Échap ────────────────────────────────────────────────
  useEffect(() => {
    if (!filtersOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFiltersOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtersOpen]);

  // Certains utilisateurs souffrent de troubles vestibulaires : une feuille qui
  // glisse peut leur donner la nausée. On respecte leur réglage système.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // ── Cycle de montage de la feuille ────────────────────────────────────────
  // L'animation d'ENTRÉE est portée par des keyframes CSS qui se jouent à
  // l'insertion du nœud : aucun basculement d'état JS n'est nécessaire, et
  // surtout l'état AU REPOS est l'état visible. Une première version pilotait
  // une transition depuis `translateY(100%)` via requestAnimationFrame — dans un
  // onglet en arrière-plan rAF ne se déclenche pas, et la feuille restait
  // définitivement hors écran. Ici, si l'animation ne joue pas, elle s'affiche
  // quand même : on échoue en visible, jamais en invisible.
  // Seule la SORTIE a besoin de JS, pour retarder le démontage.
  useEffect(() => {
    if (filtersOpen) {
      setFiltersMounted(true);
      return;
    }
    if (!filtersMounted) return;
    const t = setTimeout(() => setFiltersMounted(false), sheetMs);
    return () => clearTimeout(t);
  }, [filtersOpen, filtersMounted, sheetMs]);

  // Le défilement de fond reste gelé tant que la feuille est à l'écran : le
  // dégeler dès le clic ferait sauter la page pendant l'animation de sortie.
  useEffect(() => {
    if (!filtersMounted) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [filtersMounted]);

  // ── Lightbox : fermeture au clavier (Échap) ────────────────────────────────
  useEffect(() => {
    if (!zoomSrc) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoomSrc(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomSrc]);

  // ── Dropdown langue : fermeture au clic extérieur + Échap ──────────────────
  useEffect(() => {
    if (!langOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (langRef.current && !langRef.current.contains(e.target as Node))
        setLangOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLangOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("keydown", onKey);
    };
  }, [langOpen]);

  const switchLang = (code: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set("lang", code);
    window.location.href = url.toString();
  };

  const resetFilters = () => {
    setFilter("all");
    setExcluded(new Set());
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
    const el = (e.target as HTMLElement).closest("[data-zoom]");
    const src = el?.getAttribute("data-zoom");
    if (src) setZoomSrc(src);
  };

  const chip = (active: boolean): React.CSSProperties => ({
    flexShrink: 0,
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "7px 13px",
    borderRadius: 999,
    border: `1px solid ${active ? theme.accent : theme.line}`,
    background: active ? theme.accent : "transparent",
    color: active ? theme.accentOn : theme.sub,
    fontSize: 12.5,
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
    fontFamily: "inherit",
  });

  const showChips =
    hasSignature || dietFilters.length > 0 || allergenFilters.length > 0;
  const activeFilterCount = (filter !== "all" ? 1 : 0) + excluded.size;
  // Le bouton de validation porte le nombre de plats retenus, recalculé en
  // direct : on voit l'effet d'un filtre AVANT de refermer la modale.
  const applyLabel =
    visibleCount === null
      ? ui.filtersTitle
      : visibleCount === 0
        ? ui.applyNone
        : visibleCount === 1
          ? ui.applyOne
          : ui.applyMany.replace("{n}", String(visibleCount));
  const sectionTitleStyle: React.CSSProperties = {
    margin: "0 0 4px",
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    color: theme.sub,
    fontFamily: "inherit",
  };
  const helpStyle: React.CSSProperties = {
    margin: "0 0 10px",
    fontSize: 12.5,
    lineHeight: 1.5,
    color: theme.sub,
  };
  const showLang = locales.length > 1;
  const showTabs = menuTabs.length > 1;

  return (
    <>
      <div
        style={{
          position: "sticky",
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
              display: "flex",
              gap: 6,
              overflowX: "auto",
              marginBottom: 10,
              scrollbarWidth: "none",
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
                    padding: "8px 15px",
                    borderRadius: 12,
                    border: "none",
                    background: active ? theme.accent : theme.card,
                    color: active ? theme.accentOn : theme.text,
                    fontSize: 13.5,
                    fontWeight: 700,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    fontFamily: "inherit",
                  }}
                >
                  {m.name}
                </button>
              );
            })}
          </div>
        ) : null}

        {/* Recherche + langue */}
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
            <span
              aria-hidden
              style={{
                position: "absolute",
                left: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: theme.sub,
                fontSize: 15,
                pointerEvents: "none",
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
                width: "100%",
                boxSizing: "border-box",
                padding: query ? "10px 34px 10px 32px" : "10px 12px 10px 32px",
                borderRadius: 12,
                border: `1px solid ${theme.line}`,
                background: theme.card,
                color: theme.text,
                fontSize: 16,
                fontFamily: "inherit",
                outline: "none",
              }}
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="×"
                style={{
                  position: "absolute",
                  right: 6,
                  top: "50%",
                  transform: "translateY(-50%)",
                  border: "none",
                  background: "none",
                  color: theme.sub,
                  fontSize: 18,
                  lineHeight: 1,
                  cursor: "pointer",
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
              onClick={() => setFiltersOpen(true)}
              aria-haspopup="dialog"
              aria-expanded={filtersOpen}
              aria-label={ui.filtersTitle}
              title={ui.filtersTitle}
              style={{
                position: "relative",
                flexShrink: 0,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                height: 42,
                width: 46,
                borderRadius: 12,
                border: `1px solid ${filtersOpen || activeFilterCount > 0 ? theme.accent : theme.line}`,
                background: activeFilterCount > 0 ? theme.accent : theme.card,
                color: activeFilterCount > 0 ? theme.accentOn : theme.sub,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                aria-hidden
              >
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
                    position: "absolute",
                    top: -5,
                    right: -5,
                    minWidth: 16,
                    height: 16,
                    padding: "0 4px",
                    borderRadius: 8,
                    background: "#C0604E",
                    color: "#fff",
                    fontSize: 10,
                    fontWeight: 800,
                    lineHeight: "16px",
                    textAlign: "center",
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
            <div ref={langRef} style={{ position: "relative", flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => setLangOpen((v) => !v)}
                aria-haspopup="listbox"
                aria-expanded={langOpen}
                aria-label={`Langue : ${LOCALE_NAMES[locale] ?? locale}`}
                title={LOCALE_NAMES[locale] ?? locale}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  height: 42,
                  padding: "0 10px",
                  borderRadius: 12,
                  border: `1px solid ${langOpen ? theme.accent : theme.line}`,
                  background: theme.card,
                  color: theme.sub,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                <FlagIcon code={locale} size={20} />
                <span
                  aria-hidden
                  style={{
                    fontSize: 10,
                    lineHeight: 1,
                    transform: langOpen ? "rotate(180deg)" : undefined,
                  }}
                >
                  ▾
                </span>
              </button>
              {langOpen ? (
                <ul
                  role="listbox"
                  style={{
                    position: "absolute",
                    top: "100%",
                    right: 0,
                    marginTop: 6,
                    zIndex: 40,
                    minWidth: 160,
                    padding: 4,
                    listStyle: "none",
                    borderRadius: 12,
                    border: `1px solid ${theme.line}`,
                    background: theme.card,
                    boxShadow: "0 10px 30px rgba(0,0,0,0.16)",
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
                            display: "flex",
                            alignItems: "center",
                            gap: 9,
                            width: "100%",
                            padding: "9px 10px",
                            border: "none",
                            borderRadius: 8,
                            background: active
                              ? theme.accent + "22"
                              : "transparent",
                            color: theme.text,
                            fontSize: 13.5,
                            fontWeight: active ? 700 : 500,
                            cursor: "pointer",
                            textAlign: "left",
                            fontFamily: "inherit",
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
      </div>

      {/* Keyframes rendues en permanence : elles servent aussi aux onglets de
          menu, pas seulement à la feuille de filtres (qui, elle, n'est montée
          qu'à l'ouverture — les y laisser les rendait indisponibles). */}
      <style>{MENU_KEYFRAMES}</style>

      <div ref={containerRef} onClick={onContainerClick}>
        {children}
      </div>

      <p
        style={{
          display: visibleCount === 0 ? "block" : "none",
          textAlign: "center",
          color: theme.sub,
          fontSize: 14,
          margin: "36px 0 0",
        }}
      >
        {ui.noResults}
      </p>

      {/* Modale de filtres — feuille ancrée en bas (le menu se lit au téléphone,
          le pouce est en bas). Remplace les puces repliées : chaque option a
          enfin la place d'être nommée ET expliquée, et l'exclusion d'allergènes
          n'est plus un second niveau caché derrière une puce. Le filtrage
          s'applique en direct ; le bouton du bas ne fait que refermer, en
          annonçant combien de plats restent. */}
      {showChips && filtersMounted ? (
        <div
          onClick={() => setFiltersOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 60,
            background: "rgba(8,6,18,0.55)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            animation: reduceMotion
              ? undefined
              : filtersClosing
                ? `dr-fade-out ${sheetMs}ms ease forwards`
                : `dr-fade-in ${sheetMs}ms ease`,
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={ui.filtersTitle}
            onClick={(e) => e.stopPropagation()}
            style={{
              display: "flex",
              flexDirection: "column",
              width: "100%",
              maxWidth: 560,
              maxHeight: "86vh",
              background: theme.bg,
              color: theme.text,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              boxShadow: "0 -8px 40px rgba(0,0,0,0.3)",
              fontFamily: "inherit",
              // Courbe type « feuille iOS » : départ franc, arrivée amortie.
              animation: reduceMotion
                ? undefined
                : filtersClosing
                  ? `dr-sheet-out ${sheetMs}ms cubic-bezier(0.32, 0.72, 0, 1) forwards`
                  : `dr-sheet-in ${sheetMs}ms cubic-bezier(0.32, 0.72, 0, 1)`,
            }}
          >
            {/* En-tête */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                padding: "15px 18px 12px",
                borderBottom: `1px solid ${theme.line}`,
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: 17,
                  fontWeight: 800,
                  fontFamily: "inherit",
                }}
              >
                {ui.filtersTitle}
              </h2>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                aria-label="×"
                style={{
                  flexShrink: 0,
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  border: "none",
                  background: theme.card,
                  color: theme.sub,
                  fontSize: 19,
                  lineHeight: 1,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                ×
              </button>
            </div>

            {/* Corps défilant */}
            <div style={{ overflowY: "auto", padding: "15px 18px 6px" }}>
              <h3 style={sectionTitleStyle}>{ui.sectionShow}</h3>
              <p style={helpStyle}>{ui.dietHelp}</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setFilter("all")}
                  style={chip(filter === "all")}
                >
                  {ui.all}
                </button>
                {hasSignature ? (
                  <button
                    type="button"
                    onClick={() => setFilter("signature")}
                    style={chip(filter === "signature")}
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
              </div>
              {hasSignature ? (
                <p style={{ ...helpStyle, margin: "10px 0 0" }}>
                  <span style={{ color: theme.accent, fontWeight: 700 }}>
                    ✦ {ui.signature}
                  </span>{" "}
                  — {ui.signatureHelp}
                </p>
              ) : null}

              {allergenFilters.length > 0 ? (
                <div
                  style={{
                    marginTop: 22,
                    paddingTop: 18,
                    borderTop: `1px solid ${theme.line}`,
                  }}
                >
                  <h3 style={sectionTitleStyle}>🚫 {ui.avoidAllergens}</h3>
                  <p style={helpStyle}>{ui.allergenHelp}</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                    {allergenFilters.map((a) => {
                      const off = excluded.has(a.slug);
                      return (
                        <button
                          key={a.slug}
                          type="button"
                          onClick={() => toggleExcluded(a.slug)}
                          aria-pressed={off}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            padding: "8px 12px",
                            borderRadius: 999,
                            border: `1px solid ${off ? "#C0604E" : theme.line}`,
                            background: off ? "#C0604E22" : "transparent",
                            color: off ? "#C0604E" : theme.sub,
                            fontSize: 13,
                            fontWeight: 600,
                            cursor: "pointer",
                            textDecoration: off ? "line-through" : "none",
                            fontFamily: "inherit",
                          }}
                        >
                          <span aria-hidden>{a.icon}</span>
                          {a.label}
                        </button>
                      );
                    })}
                  </div>
                  {/* Un filtre d'allergènes engage la santé du client : on dit
                      d'où vient l'information et on renvoie vers le personnel. */}
                  <p
                    style={{
                      margin: "12px 0 0",
                      padding: "9px 11px",
                      borderRadius: 10,
                      background: "#C0604E14",
                      border: "1px solid #C0604E33",
                      fontSize: 12,
                      lineHeight: 1.5,
                      color: theme.text,
                    }}
                  >
                    ⚠ {ui.allergenWarning}
                  </p>
                </div>
              ) : null}
            </div>

            {/* Pied : effacer + valider (compteur en direct) */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "12px 18px",
                paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))",
                borderTop: `1px solid ${theme.line}`,
              }}
            >
              <button
                type="button"
                onClick={resetFilters}
                disabled={activeFilterCount === 0}
                style={{
                  flexShrink: 0,
                  padding: "11px 14px",
                  borderRadius: 12,
                  border: `1px solid ${theme.line}`,
                  background: "transparent",
                  color: theme.sub,
                  fontSize: 13.5,
                  fontWeight: 700,
                  cursor: activeFilterCount === 0 ? "default" : "pointer",
                  opacity: activeFilterCount === 0 ? 0.4 : 1,
                  fontFamily: "inherit",
                }}
              >
                {ui.reset}
              </button>
              <button
                type="button"
                onClick={() => setFiltersOpen(false)}
                style={{
                  flex: 1,
                  padding: "11px 14px",
                  borderRadius: 12,
                  border: "none",
                  background: theme.accent,
                  color: theme.accentOn,
                  fontSize: 14.5,
                  fontWeight: 800,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {applyLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Lightbox photo plein écran */}
      {zoomSrc ? (
        <div
          onClick={() => setZoomSrc(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 70,
            background: "rgba(8,6,18,0.92)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
            cursor: "zoom-out",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={zoomSrc}
            alt=""
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              borderRadius: 12,
              objectFit: "contain",
              boxShadow: "0 12px 48px rgba(0,0,0,0.5)",
            }}
          />
          <button
            type="button"
            aria-label="×"
            onClick={() => setZoomSrc(null)}
            style={{
              position: "fixed",
              top: 16,
              right: 16,
              width: 40,
              height: 40,
              borderRadius: 20,
              border: "none",
              background: "rgba(255,255,255,0.15)",
              color: "#fff",
              fontSize: 22,
              lineHeight: 1,
              cursor: "pointer",
            }}
          >
            ×
          </button>
        </div>
      ) : null}
    </>
  );
}
