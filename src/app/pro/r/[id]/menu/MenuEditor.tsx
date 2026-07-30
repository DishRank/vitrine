'use client';

import { useActionState, useEffect, useState, useTransition } from 'react';
import {
  createDefaultMenuAction,
  upsertSectionAction,
  type MenuActionState,
} from './menuActions';
import type { EditorMenu } from './menuData';
import type { MenuThemeConfig } from './themeConstants';
import { collectFormulaSources } from './menuSources';
import MenuBoard from './MenuBoard';
import LanguagePanel from './LanguagePanel';
import AppearanceButton from './apparence/AppearanceButton';
import type { SavedTheme } from './apparence/ThemeEditor';
import { inputCls, labelCls, FormError } from '../../../_components/fields';

export default function MenuEditor({
  restaurantId,
  menu,
  premium,
  initialTheme,
  logoUrl,
  menuLanguages,
  initialEditItemId,
  initialThemeLibrary,
}: {
  restaurantId: string;
  menu: EditorMenu | null;
  premium: boolean;
  initialTheme: MenuThemeConfig;
  /** Logo de la fiche (`restaurants.logo_url`) — l'apparence ne fait que décider
   *  de l'afficher ou non en tête du menu. */
  logoUrl: string | null;
  menuLanguages: string[];
  /** Apparences enregistrées (bibliothèque, mig.159), chargées côté serveur. */
  initialThemeLibrary: SavedTheme[];
  /** Plat à éditer d'emblée (deep-link `?edit=<id>` — ex. « Créer ce plat » depuis un avis). */
  initialEditItemId?: string;
}) {
  const [pending, start] = useTransition();
  const [addingSection, setAddingSection] = useState(false);

  // ── Aucune carte encore ──────────────────────────────────────────────────
  if (!menu) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--border2)] bg-[var(--surface)] p-8 text-center">
        <p className="text-[15px] font-semibold mb-1">Créez votre menu numérique</p>
        <p className="text-sm text-[var(--text2)] max-w-md mx-auto mb-5">
          Ajoutez vos catégories et vos plats. Vos clients y accèdent gratuitement via le QR code de
          table — édition en temps réel, allergènes et prix inclus.
        </p>
        <button
          onClick={() => start(async () => { await createDefaultMenuAction(restaurantId); })}
          disabled={pending}
          className="rounded-xl bg-[var(--primary)] px-5 py-3 text-[15px] font-bold text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending ? 'Création…' : 'Créer ma carte'}
        </button>
      </div>
    );
  }

  const formulaSources = collectFormulaSources(menu.sections);

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold">{menu.name}</h2>
          <p className="text-sm text-[var(--text2)]">
            Vos modifications sont visibles immédiatement sur le menu public.
          </p>
        </div>
        {/* Même piège que la rangée du kit QR : le parent enveloppe, mais c'est
            cette rangée-ci qui doit casser. Sans `flex-wrap` les 3 libellés se
            font écraser sur 2 lignes dès 375 px. */}
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <a
            href={`/menu/${restaurantId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-[var(--border2)] px-3 py-2 text-sm font-semibold text-[var(--text2)] hover:border-[var(--primary)] hover:text-[var(--text)]"
          >
            Voir le menu public ↗
          </a>
          <AppearanceButton restaurantId={restaurantId} initialTheme={initialTheme} premium={premium} logoUrl={logoUrl} initialLibrary={initialThemeLibrary} />
          <a
            href={`/pro/r/${restaurantId}/partage`}
            className="rounded-lg border border-[var(--border2)] px-3 py-2 text-sm font-semibold text-[var(--text2)] hover:border-[var(--primary)] hover:text-[var(--text)]"
          >
            Partager
          </a>
        </div>
      </div>

      <LanguagePanel
        restaurantId={restaurantId}
        translatedLocales={menu.translatedLocales}
        menuLanguages={menuLanguages}
        premium={premium}
      />

      {/* Catégories — glisser-déposer (réordonner catégories & plats, déplacer
          un plat d'une catégorie à l'autre) orchestré par MenuBoard. */}
      {menu.sections.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--border2)] bg-[var(--surface)] p-6 text-center text-sm text-[var(--text2)]">
          Votre carte est vide. Ajoutez une première catégorie (Entrées, Plats, Desserts…).
        </p>
      ) : (
        <MenuBoard
          restaurantId={restaurantId}
          menu={menu}
          sources={formulaSources}
          menuLanguages={menuLanguages}
          premium={premium}
          initialEditItemId={initialEditItemId}
        />
      )}

      {/* Ajouter une catégorie */}
      {addingSection ? (
        <AddSectionForm restaurantId={restaurantId} menuId={menu.id} onDone={() => setAddingSection(false)} />
      ) : (
        <button
          onClick={() => setAddingSection(true)}
          className="w-full rounded-2xl border border-dashed border-[var(--border2)] py-4 text-sm font-bold text-[var(--primary)] hover:bg-[var(--surface)]"
        >
          + Ajouter une catégorie
        </button>
      )}
    </div>
  );
}

function AddSectionForm({
  restaurantId,
  menuId,
  onDone,
}: {
  restaurantId: string;
  menuId: string;
  onDone: () => void;
}) {
  const [state, action] = useActionState<MenuActionState, FormData>(
    upsertSectionAction.bind(null, restaurantId),
    {}
  );
  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);
  return (
    <form action={action} className="rounded-2xl border border-[var(--border2)] bg-[var(--surface)] p-4 space-y-2">
      <input type="hidden" name="menuId" value={menuId} />
      <div>
        <label className={labelCls}>Nom de la catégorie</label>
        <input name="name" type="text" required maxLength={80} placeholder="Entrées, Plats, Desserts…" className={inputCls} autoFocus />
      </div>
      <FormError error={state.error} />
      <div className="flex items-center gap-2">
        <button type="submit" className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-bold text-white hover:opacity-90">Ajouter</button>
        <button type="button" onClick={onDone} className="rounded-lg px-3 py-2 text-sm font-semibold text-[var(--text2)] hover:text-[var(--text)]">Annuler</button>
      </div>
    </form>
  );
}
