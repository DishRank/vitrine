'use client';

import { useActionState, useEffect, useState } from 'react';
import { upsertFormulaAction, type MenuActionState } from './menuActions';
import type { EditorItem } from './menuData';
import type { FormulaSources } from './menuSources';
import { newLeafId } from './menuLeaves';
import { inputCls, labelCls, FormError } from '../../../_components/fields';

interface PriceDraft {
  id: string;
  label: string;
  price: string;
}
interface SlotDraft {
  id: string;
  name: string;
  mode: 'section' | 'items';
  sectionId: string;
  itemIds: string[];
}

const parseNum = (s: string): number => {
  const n = Number(String(s).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

const miniInput =
  'w-full rounded-lg border border-[var(--border2)] bg-[var(--bg)] px-2.5 py-1.5 text-sm text-[var(--text)] placeholder-[var(--text3)] outline-none focus:border-[var(--primary)]';

/**
 * Éditeur de FORMULE (kind='formula') — parité app : un nom, une description,
 * une grille de prix (Midi 19€, Entrée+Plat 24€…) et des crans (Entrée / Plat /
 * Dessert), chaque cran puisant soit dans une section entière, soit dans une
 * liste de plats. Le formula_config est sérialisé en JSON caché puis validé
 * côté serveur (validateFormulaConfig + trigger DB).
 */
export default function FormulaForm({
  restaurantId,
  sectionId,
  item,
  sources,
  onDone,
}: {
  restaurantId: string;
  sectionId: string;
  item?: EditorItem;
  sources: FormulaSources;
  onDone: () => void;
}) {
  const [state, action] = useActionState<MenuActionState, FormData>(
    upsertFormulaAction.bind(null, restaurantId),
    {}
  );

  const [prices, setPrices] = useState<PriceDraft[]>(() =>
    (item?.formula_config?.prices ?? []).map((p) => ({
      id: newLeafId(),
      label: p.label,
      price: p.price != null ? String(p.price) : '',
    }))
  );
  const [slots, setSlots] = useState<SlotDraft[]>(() =>
    (item?.formula_config?.slots ?? []).map((s) => ({
      id: newLeafId(),
      name: s.name,
      mode: s.source?.section_id ? 'section' : 'items',
      sectionId: s.source?.section_id ?? '',
      itemIds: s.source?.item_ids ?? [],
    }))
  );

  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  const formulaConfig = {
    prices: prices.map((p) => ({ label: p.label.trim(), price: parseNum(p.price) })),
    slots: slots.map((s) => ({
      name: s.name.trim(),
      source: s.mode === 'section' ? { section_id: s.sectionId || null } : { item_ids: s.itemIds },
    })),
  };

  return (
    <form action={action} className="rounded-xl border border-[var(--border2)] bg-[var(--bg)] p-4 space-y-3">
      {item ? <input type="hidden" name="id" value={item.id} /> : null}
      {item ? <input type="hidden" name="expectedUpdatedAt" value={item.updated_at} /> : null}
      <input type="hidden" name="sectionId" value={sectionId} />
      <input type="hidden" name="formula_config" value={JSON.stringify(formulaConfig)} />

      <div>
        <label className={labelCls}>Nom de la formule</label>
        <input name="name" type="text" required maxLength={120} defaultValue={item?.name ?? ''} placeholder="Formule du midi" className={inputCls} autoFocus />
      </div>
      <div>
        <label className={labelCls}>Description</label>
        <textarea name="description" rows={2} maxLength={400} defaultValue={item?.description ?? ''} placeholder="Entrée + plat + dessert au choix" className={inputCls} />
      </div>

      {/* Prix */}
      <div>
        <label className={labelCls}>Prix</label>
        <div className="space-y-2">
          {prices.map((p) => (
            <div key={p.id} className="flex items-center gap-2">
              <input
                value={p.label}
                onChange={(e) => setPrices((s) => s.map((x) => (x.id === p.id ? { ...x, label: e.target.value } : x)))}
                maxLength={60}
                placeholder="Entrée + plat…"
                className={`${miniInput} flex-1`}
              />
              <input
                value={p.price}
                onChange={(e) => setPrices((s) => s.map((x) => (x.id === p.id ? { ...x, price: e.target.value } : x)))}
                inputMode="decimal"
                placeholder="€"
                className={`${miniInput} w-20`}
              />
              <button type="button" onClick={() => setPrices((s) => s.filter((x) => x.id !== p.id))} aria-label="Retirer" className="px-1.5 text-[var(--text3)] hover:text-red-500">
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setPrices((s) => [...s, { id: newLeafId(), label: '', price: '' }])}
            className="text-sm font-semibold text-[var(--primary)] hover:underline"
          >
            + Ajouter un prix
          </button>
        </div>
      </div>

      {/* Crans / étapes */}
      <div>
        <label className={labelCls}>Étapes (entrée, plat, dessert…)</label>
        <div className="space-y-3">
          {slots.map((slot) => (
            <div key={slot.id} className="rounded-xl border border-[var(--border2)] bg-[var(--surface)] p-3 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  value={slot.name}
                  onChange={(e) => setSlots((s) => s.map((x) => (x.id === slot.id ? { ...x, name: e.target.value } : x)))}
                  maxLength={40}
                  placeholder="Entrée, Plat, Dessert…"
                  className={`${miniInput} flex-1`}
                />
                <button type="button" onClick={() => setSlots((s) => s.filter((x) => x.id !== slot.id))} aria-label="Retirer l'étape" className="px-1.5 text-[var(--text3)] hover:text-red-500">
                  ✕
                </button>
              </div>
              <div className="flex gap-1.5">
                {(['section', 'items'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setSlots((s) => s.map((x) => (x.id === slot.id ? { ...x, mode: m } : x)))}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      slot.mode === m
                        ? 'border-[var(--primary)] bg-[var(--primary-container)] text-[var(--primary)]'
                        : 'border-[var(--border2)] text-[var(--text2)] hover:border-[var(--primary)]'
                    }`}
                  >
                    {m === 'section' ? 'Toute une catégorie' : 'Plats choisis'}
                  </button>
                ))}
              </div>
              {slot.mode === 'section' ? (
                <select
                  value={slot.sectionId}
                  onChange={(e) => setSlots((s) => s.map((x) => (x.id === slot.id ? { ...x, sectionId: e.target.value } : x)))}
                  className={miniInput}
                >
                  <option value="">— Choisir une catégorie —</option>
                  {sources.sections.map((sec) => (
                    <option key={sec.id} value={sec.id}>
                      {sec.name}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="max-h-40 space-y-1 overflow-auto rounded-lg border border-[var(--border2)] p-2">
                  {sources.items.map((it) => {
                    const checked = slot.itemIds.includes(it.id);
                    return (
                      <label key={it.id} className="flex cursor-pointer items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setSlots((s) =>
                              s.map((x) =>
                                x.id === slot.id
                                  ? {
                                      ...x,
                                      itemIds: e.target.checked
                                        ? [...x.itemIds, it.id]
                                        : x.itemIds.filter((i) => i !== it.id),
                                    }
                                  : x
                              )
                            )
                          }
                          className="h-3.5 w-3.5 accent-[var(--primary)]"
                        />
                        <span className="font-medium text-[var(--text)]">{it.name}</span>
                        <span className="text-[var(--text3)]">· {it.sectionName}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => setSlots((s) => [...s, { id: newLeafId(), name: '', mode: 'section', sectionId: '', itemIds: [] }])}
            className="text-sm font-semibold text-[var(--primary)] hover:underline"
          >
            + Ajouter une étape
          </button>
        </div>
      </div>

      <FormError error={state.error} />

      <div className="flex items-center gap-2">
        <button type="submit" className="rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-bold text-white hover:opacity-90">
          {item ? 'Enregistrer' : 'Ajouter la formule'}
        </button>
        <button type="button" onClick={onDone} className="rounded-lg px-3 py-2 text-sm font-semibold text-[var(--text2)] hover:text-[var(--text)]">
          Annuler
        </button>
      </div>
    </form>
  );
}
