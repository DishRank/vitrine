'use client';

import { useActionState, useEffect } from 'react';
import { upsertItemAction, type MenuActionState } from './menuActions';
import { ALLERGENS, DIETS } from './vocab';
import type { EditorItem } from './menuData';
import { inputCls, labelCls, FormError } from '../../../_components/fields';

/**
 * Formulaire de plat (kind='item'). En édition, embarque `expectedUpdatedAt`
 * (CAS) : si le plat a bougé côté app entre le chargement et l'envoi, le serveur
 * renvoie MENU_CONFLICT au lieu d'écraser.
 */
export default function ItemForm({
  restaurantId,
  sectionId,
  item,
  onDone,
}: {
  restaurantId: string;
  sectionId: string;
  item?: EditorItem;
  onDone: () => void;
}) {
  const [state, action] = useActionState<MenuActionState, FormData>(
    upsertItemAction.bind(null, restaurantId),
    {}
  );

  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  const chip = 'inline-flex items-center gap-1.5 rounded-lg border border-[var(--border2)] px-2.5 py-1.5 text-xs font-semibold cursor-pointer has-[:checked]:border-[var(--primary)] has-[:checked]:bg-[var(--primary-container)] has-[:checked]:text-[var(--primary)]';

  return (
    <form action={action} className="rounded-xl border border-[var(--border2)] bg-[var(--bg)] p-4 space-y-3">
      {item ? <input type="hidden" name="id" value={item.id} /> : null}
      {item ? <input type="hidden" name="expectedUpdatedAt" value={item.updated_at} /> : null}
      <input type="hidden" name="sectionId" value={sectionId} />

      <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
        <div>
          <label className={labelCls}>Nom du plat</label>
          <input name="name" type="text" required maxLength={120} defaultValue={item?.name ?? ''} placeholder="Ramen tonkotsu" className={inputCls} autoFocus />
        </div>
        <div>
          <label className={labelCls}>Prix (€)</label>
          <input name="price" type="text" inputMode="decimal" defaultValue={item?.price != null ? String(item.price) : ''} placeholder="14.50" className={inputCls} />
        </div>
      </div>

      <div>
        <label className={labelCls}>Description</label>
        <textarea name="description" rows={2} maxLength={400} defaultValue={item?.description ?? ''} placeholder="Bouillon de porc mijoté 12 h, nouilles fraîches, œuf mollet…" className={inputCls} />
      </div>

      <div>
        <label className={labelCls}>Allergènes</label>
        <div className="flex flex-wrap gap-1.5">
          {ALLERGENS.map((a) => (
            <label key={a.key} className={chip}>
              <input type="checkbox" name="allergens" value={a.key} defaultChecked={item?.allergens.includes(a.key)} className="sr-only" />
              {a.label}
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className={labelCls}>Régimes / mentions</label>
        <div className="flex flex-wrap gap-1.5">
          {DIETS.map((d) => (
            <label key={d.key} className={chip}>
              <input type="checkbox" name="diet_tags" value={d.key} defaultChecked={item?.diet_tags.includes(d.key)} className="sr-only" />
              {d.label}
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 pt-1">
        <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
          <input type="checkbox" name="is_visible" defaultChecked={item?.is_visible ?? true} className="h-4 w-4 accent-[var(--primary)]" />
          Visible sur le menu
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
          <input type="checkbox" name="is_signature" defaultChecked={item?.is_signature ?? false} className="h-4 w-4 accent-[var(--primary)]" />
          Plat signature ⭐
        </label>
      </div>

      <FormError error={state.error} />

      <div className="flex items-center gap-2">
        <button type="submit" className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-bold text-white hover:opacity-90">
          {item ? 'Enregistrer' : 'Ajouter le plat'}
        </button>
        <button type="button" onClick={onDone} className="rounded-lg px-3 py-2 text-sm font-semibold text-[var(--text2)] hover:text-[var(--text)]">
          Annuler
        </button>
      </div>
    </form>
  );
}
