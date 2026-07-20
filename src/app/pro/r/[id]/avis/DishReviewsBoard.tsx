"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import TabPanel from "@/components/TabPanel";
import ReviewCard, { type ProReview, type MenuItemRef } from "./ReviewCard";
import OrphanWorklist, { type OrphanDish } from "./OrphanWorklist";
import { getThumbnailUrl } from "../menu/thumb";
import Modal from "../../../_components/Modal";

/** Un plat + ses avis (préparé côté serveur par la page). */
export interface DishGroup {
  name: string;
  avg: number | null;
  reviews: ProReview[];
  unanswered: number;
  /** Photo du plat (menu_items.photo_url) — vignette de la carte. */
  photoUrl: string | null;
  /** Repli de vignette : une photo d'avis du plat, si pas de photo menu. */
  reviewPhoto: string | null;
}

type OpenState = { kind: "dish"; group: DishGroup } | { kind: "orphan" } | null;
type ViewMode = "dish" | "list";
type ListFilter = "all" | "unanswered" | "negative" | "positive";
type SortMode = "recent" | "rating_asc";

const norm = (s: string) =>
  s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Slug FR du filtre pour l'URL `?avis=…` (miroir de AVIS_SLUG_TO_FILTER de page.tsx).
const FILTER_TO_SLUG: Record<ListFilter, string> = {
  all: "tous",
  unanswered: "a-repondre",
  negative: "negatifs",
  positive: "positifs",
};

const isNegative = (r: ProReview) =>
  r.verdict === "disappointing" || (r.rating != null && r.rating <= 2);
const isPositive = (r: ProReview) =>
  r.verdict === "must_return" || (r.rating != null && r.rating >= 4);
const matchFilter = (r: ProReview, f: ListFilter) =>
  f === "unanswered"
    ? !r.reply
    : f === "negative"
      ? isNegative(r)
      : f === "positive"
        ? isPositive(r)
        : true;

/**
 * Dashboard des avis, DEUX styles d'affichage :
 *  • « Par plat » — grille de cartes (une par plat) ; clic → modale des avis.
 *  • « Liste » — tous les avis à plat, filtrables (à répondre / négatifs /
 *    positifs). Le style + le filtre initiaux viennent des query params
 *    (`?avis=negatifs`) → accès rapides partageables depuis le cockpit/stats.
 */
export default function DishReviewsBoard({
  restaurantId,
  premium,
  thankTemplate,
  menuItems,
  reviews,
  dishGroups,
  orphanReviews,
  orphans,
  pendingCount,
  initialView,
  initialFilter,
}: {
  restaurantId: string;
  premium: boolean;
  thankTemplate: string;
  menuItems: MenuItemRef[];
  reviews: ProReview[];
  dishGroups: DishGroup[];
  orphanReviews: ProReview[];
  orphans: OrphanDish[];
  pendingCount: number;
  initialView?: ViewMode;
  initialFilter?: ListFilter;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState<OpenState>(null);
  const [query, setQuery] = useState("");
  // Un filtre ≠ « all » implique la vue liste (deep-link depuis une carte).
  const [view, setView] = useState<ViewMode>(
    initialView === "list" || (initialFilter && initialFilter !== "all")
      ? "list"
      : "dish",
  );
  const [filter, setFilter] = useState<ListFilter>(initialFilter ?? "all");
  // Arrivée directe sur « négatifs » → pires notes en haut (triage immédiat).
  const [sort, setSort] = useState<SortMode>(
    initialFilter === "negative" ? "rating_asc" : "recent",
  );

  // Reflète vue+filtre dans l'URL SANS re-render serveur (history.replaceState au
  // lieu de router.replace, qui re-streamerait tous les avis) → l'URL reste
  // partageable/rechargeable ; au reload, le serveur relit `?avis=` pour l'état
  // initial. URL lisible : un seul param en français, absent = vue « par plat ».
  const syncUrl = (v: ViewMode, f: ListFilter) => {
    if (typeof window === "undefined") return;
    const slug = v === "list" ? FILTER_TO_SLUG[f] : null;
    window.history.replaceState(
      null,
      "",
      slug ? `${pathname}?avis=${slug}` : pathname,
    );
  };
  const changeView = (v: ViewMode) => {
    setView(v);
    syncUrl(v, filter);
  };
  const changeFilter = (f: ListFilter) => {
    setFilter(f);
    setView("list");
    syncUrl("list", f);
  };

  // Comptes pour les puces de filtre (sur l'ensemble des avis chargés).
  const counts = useMemo(
    () => ({
      all: reviews.length,
      unanswered: reviews.filter((r) => !r.reply).length,
      negative: reviews.filter(isNegative).length,
      positive: reviews.filter(isPositive).length,
    }),
    [reviews],
  );

  const dishFiltered = useMemo(() => {
    const q = norm(query);
    return q ? dishGroups.filter((g) => norm(g.name).includes(q)) : dishGroups;
  }, [dishGroups, query]);

  const listFiltered = useMemo(() => {
    const q = norm(query);
    const arr = reviews.filter(
      (r) =>
        matchFilter(r, filter) &&
        (!q ||
          norm(r.dishName ?? "").includes(q) ||
          norm(r.comment ?? "").includes(q)),
    );
    // `reviews` arrive déjà triés récents→anciens (query created_at desc) → on
    // garde cet ordre pour 'recent' ; 'rating_asc' = pires notes d'abord (utile
    // pour traiter les négatifs), notes absentes en dernier.
    if (sort === "rating_asc") {
      arr.sort((a, b) => (a.rating ?? Infinity) - (b.rating ?? Infinity));
    }
    return arr;
  }, [reviews, filter, query, sort]);

  const card = (r: ProReview) => (
    <ReviewCard
      key={r.id}
      restaurantId={restaurantId}
      review={r}
      canPin={premium}
      thankTemplate={thankTemplate}
      menuItems={menuItems}
    />
  );

  const title =
    open?.kind === "dish"
      ? open.group.name
      : open?.kind === "orphan"
        ? "Plats non reconnus"
        : "";
  const subtitle =
    open?.kind === "dish"
      ? `${open.group.reviews.length} avis${open.group.avg != null ? ` · ★ ${open.group.avg.toFixed(1)}` : ""}`
      : open?.kind === "orphan"
        ? `${orphanReviews.length} avis à rattacher`
        : undefined;

  const goPending = () => {
    setView("list");
    setFilter("unanswered");
    syncUrl("list", "unanswered");
  };

  const segBtn = (active: boolean) =>
    `flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
      active
        ? "bg-[var(--surface)] text-[var(--text)] shadow-sm"
        : "text-[var(--text2)] hover:text-[var(--text)]"
    }`;

  const chip = (active: boolean, tone?: "neg" | "pos") =>
    `rounded-full border px-3 py-1.5 text-xs font-bold transition-colors ${
      active
        ? tone === "neg"
          ? "border-red-500 bg-red-500 text-white"
          : tone === "pos"
            ? "border-[var(--accent-success)] bg-[var(--accent-success)] text-white"
            : "border-[var(--primary)] bg-[var(--primary)] text-white"
        : "border-[var(--border2)] text-[var(--text2)] hover:border-[var(--primary)]"
    }`;

  return (
    <>
      {/* Deux façons de travailler : parcourir les avis par plat, ou traiter la
          file de réponses. Le nombre d'avis en attente vit DANS l'onglet — c'est
          ce qui rendait redondante la grosse carte d'alerte qui trônait ici (son
          bouton « Voir → » renvoyait de toute façon sur la même page).
          L'onglet nomme l'ACTIVITÉ (« Répondre ») et non le contenu : ses puces
          de filtre peuvent donc montrer les positifs ou tous les avis — cibles
          des liens du cockpit et des stats — sans contredire son libellé. */}
      <div className="flex gap-1 rounded-xl border border-[var(--border2)] bg-[var(--bg)] p-1">
        <button
          type="button"
          onClick={() => changeView("dish")}
          aria-pressed={view === "dish"}
          className={segBtn(view === "dish")}
        >
          Les avis
        </button>
        <button
          type="button"
          onClick={goPending}
          aria-pressed={view === "list"}
          className={`${segBtn(view === "list")} inline-flex items-center justify-center gap-2`}
        >
          Répondre
          {pendingCount > 0 ? (
            <span className="inline-flex min-w-[20px] items-center justify-center rounded-full bg-[var(--primary)] px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
              {pendingCount > 99 ? "99+" : pendingCount}
            </span>
          ) : null}
        </button>
      </div>

      {/* Recherche (plat en vue « par plat », plat + commentaire en vue liste) */}
      <div className="relative mt-3">
        <span
          aria-hidden
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text3)]"
        >
          ⌕
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={
            view === "dish"
              ? "Rechercher un plat…"
              : "Rechercher un plat ou un mot…"
          }
          aria-label="Rechercher"
          className="w-full rounded-xl border border-[var(--border2)] bg-[var(--surface)] py-2.5 pl-10 pr-9 text-sm text-[var(--text)] outline-none transition-colors focus:border-[var(--primary)]"
        />
        {query ? (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Effacer"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--text3)] hover:text-[var(--text)]"
          >
            ✕
          </button>
        ) : null}
      </div>

      {/* Seul le PANNEAU glisse : la barre d'onglets et la recherche restent
          fixes au-dessus, sinon toute la page semblerait se recharger. */}
      <TabPanel index={view === "dish" ? 0 : 1}>
        {view === "dish" ? (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {/* Carte « Plats non reconnus » — en tête, à traiter (jamais filtrée) */}
            {orphanReviews.length > 0 ? (
              <button
                type="button"
                onClick={() => setOpen({ kind: "orphan" })}
                className="flex flex-col justify-between gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/[0.06] p-4 text-left transition-colors hover:border-amber-500"
              >
                <span className="flex items-center gap-2 font-extrabold text-[var(--text)]">
                  <span aria-hidden>🔍</span> Plats non reconnus
                </span>
                <span className="flex items-center gap-2">
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-bold text-amber-600">
                    {orphanReviews.length} avis
                  </span>
                  <span className="text-xs font-semibold text-amber-600">
                    à rattacher →
                  </span>
                </span>
              </button>
            ) : null}

            {dishFiltered.map((g) => {
              const thumb = g.photoUrl ?? g.reviewPhoto;
              return (
                <button
                  key={g.name}
                  type="button"
                  onClick={() => setOpen({ kind: "dish", group: g })}
                  className="flex gap-3 rounded-2xl border border-[var(--border2)] bg-[var(--surface)] p-3 text-left shadow-[0_2px_10px_var(--card-shadow)] transition-colors hover:border-[var(--primary)]"
                >
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={getThumbnailUrl(thumb)}
                      alt=""
                      className="h-16 w-16 shrink-0 rounded-xl object-cover"
                    />
                  ) : (
                    <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-var)] text-xl text-[var(--text3)]">
                      🍽️
                    </span>
                  )}
                  <span className="flex min-w-0 flex-1 flex-col gap-2">
                    <span className="line-clamp-2 font-extrabold text-[var(--text)]">
                      {g.name}
                    </span>
                    <span className="mt-auto flex flex-wrap items-center gap-1.5">
                      {g.avg != null ? (
                        <span className="rounded-md bg-[var(--surface-var)] px-1.5 py-0.5 text-xs font-bold text-[var(--text)]">
                          ★ {g.avg.toFixed(1)}
                        </span>
                      ) : null}
                      <span className="text-xs text-[var(--text3)]">
                        {g.reviews.length} avis
                      </span>
                      {g.unanswered > 0 ? (
                        <span className="rounded-full bg-[var(--primary-container)] px-2 py-0.5 text-xs font-bold text-[var(--primary)]">
                          {g.unanswered} à répondre
                        </span>
                      ) : null}
                    </span>
                  </span>
                </button>
              );
            })}

            {query && dishFiltered.length === 0 ? (
              <p className="col-span-full py-6 text-center text-sm text-[var(--text3)]">
                Aucun plat ne correspond à « {query} ».
              </p>
            ) : null}
          </div>
        ) : (
          <>
            {/* Puces de filtre + tri */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => changeFilter("all")}
                aria-pressed={filter === "all"}
                className={chip(filter === "all")}
              >
                Tous · {counts.all}
              </button>
              <button
                type="button"
                onClick={() => changeFilter("unanswered")}
                aria-pressed={filter === "unanswered"}
                className={chip(filter === "unanswered")}
              >
                À répondre · {counts.unanswered}
              </button>
              <button
                type="button"
                onClick={() => changeFilter("negative")}
                aria-pressed={filter === "negative"}
                className={chip(filter === "negative", "neg")}
              >
                👎 Négatifs · {counts.negative}
              </button>
              <button
                type="button"
                onClick={() => changeFilter("positive")}
                aria-pressed={filter === "positive"}
                className={chip(filter === "positive", "pos")}
              >
                ⭐ Positifs · {counts.positive}
              </button>
              <label className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-[var(--text2)]">
                <span className="hidden sm:inline">Trier :</span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as SortMode)}
                  className="rounded-lg border border-[var(--border2)] bg-[var(--surface)] px-2 py-1.5 text-xs font-semibold text-[var(--text)] outline-none focus:border-[var(--primary)]"
                >
                  <option value="recent">Plus récents</option>
                  <option value="rating_asc">Note croissante</option>
                </select>
              </label>
            </div>

            <p className="mt-2 text-xs text-[var(--text3)]" aria-live="polite">
              {listFiltered.length} avis {query ? "correspondants" : "affichés"}
            </p>

            <div className="mt-2 space-y-3">
              {listFiltered.length > 0 ? (
                listFiltered.map(card)
              ) : filter === "unanswered" && !query ? (
                // Le « tout est traité » que portait la carte supprimée : il garde
                // sa valeur, mais à l'endroit où l'on vient justement le vérifier.
                <div className="flex items-center gap-3 rounded-2xl border border-[var(--accent-success)]/30 bg-[var(--accent-success)]/[0.08] px-4 py-3 text-sm font-semibold text-[var(--accent-success)]">
                  <span aria-hidden className="text-base">
                    ✓
                  </span>{" "}
                  Tous vos avis ont une réponse.
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-[var(--text3)]">
                  Aucun avis pour ce filtre.
                </p>
              )}
            </div>
          </>
        )}
      </TabPanel>

      <Modal
        open={open != null}
        onClose={() => setOpen(null)}
        title={title}
        subtitle={subtitle}
        maxWidth="max-w-2xl"
      >
        <div className="space-y-3">
          {open?.kind === "orphan" ? (
            <>
              {orphans.length > 0 ? (
                <OrphanWorklist
                  restaurantId={restaurantId}
                  orphans={orphans}
                  menuItems={menuItems}
                />
              ) : null}
              {orphanReviews.map(card)}
            </>
          ) : open?.kind === "dish" ? (
            open.group.reviews.map(card)
          ) : null}
        </div>
      </Modal>
    </>
  );
}
