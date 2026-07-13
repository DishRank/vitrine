'use client';

import { useActionState, useEffect, useState } from 'react';
import { upsertItemAction, type MenuActionState } from './menuActions';
import { ALLERGENS, DIETS } from './vocab';
import type { EditorItem } from './menuData';
import { newLeafId } from './menuLeaves';
import DishCategoryPicker from './DishCategoryPicker';
import { inputCls, labelCls, FormError } from '../../../_components/fields';

/** États d'édition : prix en STRING (saisie tolérante), sérialisés en number. */
interface VariantDraft {
  id: string;
  label: string;
  price: string;
}
interface ChoiceDraft {
  label: string;
  price_delta: string;
}
interface OptionDraft {
  id: string;
  name: string;
  required: boolean;
  choices: ChoiceDraft[];
}

const DAYS = [
  { n: 1, l: 'L' },
  { n: 2, l: 'M' },
  { n: 3, l: 'M' },
  { n: 4, l: 'J' },
  { n: 5, l: 'V' },
  { n: 6, l: 'S' },
  { n: 7, l: 'D' },
];

const parseNum = (s: string): number => {
  const n = Number(String(s).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

const miniInput =
  'w-full rounded-lg border border-[var(--border2)] bg-[var(--bg)] px-2.5 py-1.5 text-sm text-[var(--text)] placeholder-[var(--text3)] outline-none focus:border-[var(--primary)]';

/**
 * Formulaire de plat (kind='item') — parité app : nom, prix OU variantes,
 * description, allergènes, régimes, options/suppléments, disponibilité
 * (services/jours/saison), signature, visibilité. En édition, embarque
 * `expectedUpdatedAt` (CAS) et charge les feuilles JSONB existantes pour les
 * ré-envoyer intactes (pas d'écrasement de ce qu'a posé l'app).
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

  const [variants, setVariants] = useState<VariantDraft[]>(() =>
    (item?.variants ?? []).map((v) => ({
      id: v.id || newLeafId(),
      label: v.label,
      price: v.price != null ? String(v.price) : '',
    }))
  );
  const [options, setOptions] = useState<OptionDraft[]>(() =>
    (item?.options ?? []).map((o) => ({
      id: o.id || newLeafId(),
      name: o.name,
      required: !!o.required,
      choices: (o.choices ?? []).map((c) => ({
        label: c.label,
        price_delta: c.price_delta != null ? String(c.price_delta) : '',
      })),
    }))
  );
  const [services, setServices] = useState<string[]>(() => item?.availability?.services ?? []);
  const [days, setDays] = useState<number[]>(() => item?.availability?.days ?? []);
  const [seasonFrom, setSeasonFrom] = useState(() => item?.availability?.season?.from ?? '');
  const [seasonTo, setSeasonTo] = useState(() => item?.availability?.season?.to ?? '');

  useEffect(() => {
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  const chip =
    'inline-flex items-center gap-1.5 rounded-lg border border-[var(--border2)] px-2.5 py-1.5 text-xs font-semibold cursor-pointer has-[:checked]:border-[var(--primary)] has-[:checked]:bg-[var(--primary-container)] has-[:checked]:text-[var(--primary)]';
  const pill = (on: boolean) =>
    `rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${
      on
        ? 'border-[var(--primary)] bg-[var(--primary-container)] text-[var(--primary)]'
        : 'border-[var(--border2)] text-[var(--text2)] hover:border-[var(--primary)]'
    }`;

  const hasVariants = variants.length > 0;

  // Payloads sérialisés (relus + revalidés par le Server Action).
  const variantsPayload = variants.map((v) => ({ id: v.id, label: v.label.trim(), price: parseNum(v.price) }));
  const optionsPayload = options.map((o) => ({
    id: o.id,
    name: o.name.trim(),
    required: o.required,
    max: 1,
    choices: o.choices.map((c) => {
      const d = parseNum(c.price_delta);
      return d > 0 ? { label: c.label.trim(), price_delta: d } : { label: c.label.trim() };
    }),
  }));
  const availabilityPayload = { services, days, seasonFrom, seasonTo };

  return (
    <form action={action} className="rounded-xl border border-[var(--border2)] bg-[var(--bg)] p-4 space-y-3">
      {item ? <input type="hidden" name="id" value={item.id} /> : null}
      {item ? <input type="hidden" name="expectedUpdatedAt" value={item.updated_at} /> : null}
      <input type="hidden" name="sectionId" value={sectionId} />
      <input type="hidden" name="variants" value={JSON.stringify(variantsPayload)} />
      <input type="hidden" name="options" value={JSON.stringify(optionsPayload)} />
      <input type="hidden" name="availability" value={JSON.stringify(availabilityPayload)} />

      <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
        <div>
          <label className={labelCls}>Nom du plat</label>
          <input name="name" type="text" required maxLength={120} defaultValue={item?.name ?? ''} placeholder="Ramen tonkotsu" className={inputCls} autoFocus />
        </div>
        <div>
          <label className={labelCls}>Prix (€)</label>
          {hasVariants ? (
            <p className="rounded-xl border border-dashed border-[var(--border2)] px-3 py-3 text-xs text-[var(--text3)]">
              Défini par variante ↓
            </p>
          ) : (
            <input name="price" type="text" inputMode="decimal" defaultValue={item?.price != null ? String(item.price) : ''} placeholder="14.50" className={inputCls} />
          )}
        </div>
      </div>

      <div>
        <label className={labelCls}>Description</label>
        <textarea name="description" rows={2} maxLength={400} defaultValue={item?.description ?? ''} placeholder="Bouillon de porc mijoté 12 h, nouilles fraîches, œuf mollet…" className={inputCls} />
      </div>

      {/* Variantes de prix */}
      <div>
        <label className={labelCls}>Variantes (verre/bouteille, 25/50 cl…)</label>
        <div className="space-y-2">
          {variants.map((v) => (
            <div key={v.id} className="flex items-center gap-2">
              <input
                value={v.label}
                onChange={(e) => setVariants((s) => s.map((x) => (x.id === v.id ? { ...x, label: e.target.value } : x)))}
                maxLength={40}
                placeholder="Verre / 25 cl…"
                className={`${miniInput} flex-1`}
              />
              <input
                value={v.price}
                onChange={(e) => setVariants((s) => s.map((x) => (x.id === v.id ? { ...x, price: e.target.value } : x)))}
                inputMode="decimal"
                placeholder="€"
                className={`${miniInput} w-20`}
              />
              <button type="button" onClick={() => setVariants((s) => s.filter((x) => x.id !== v.id))} aria-label="Retirer" className="px-1.5 text-[var(--text3)] hover:text-red-500">
                ✕
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setVariants((s) => [...s, { id: newLeafId(), label: '', price: '' }])}
            className="text-sm font-semibold text-[var(--primary)] hover:underline"
          >
            + Ajouter une variante
          </button>
        </div>
      </div>

      {/* Options / suppléments */}
      <div>
        <label className={labelCls}>Options / suppléments</label>
        <div className="space-y-3">
          {options.map((o) => (
            <div key={o.id} className="rounded-xl border border-[var(--border2)] bg-[var(--surface)] p-3 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  value={o.name}
                  onChange={(e) => setOptions((s) => s.map((x) => (x.id === o.id ? { ...x, name: e.target.value } : x)))}
                  maxLength={40}
                  placeholder="Cuisson, Suppléments…"
                  className={`${miniInput} flex-1`}
                />
                <label className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-[var(--text2)]">
                  <input
                    type="checkbox"
                    checked={o.required}
                    onChange={(e) => setOptions((s) => s.map((x) => (x.id === o.id ? { ...x, required: e.target.checked } : x)))}
                    className="h-4 w-4 accent-[var(--primary)]"
                  />
                  Obligatoire
                </label>
                <button type="button" onClick={() => setOptions((s) => s.filter((x) => x.id !== o.id))} aria-label="Retirer le groupe" className="px-1.5 text-[var(--text3)] hover:text-red-500">
                  ✕
                </button>
              </div>
              <div className="space-y-1.5 pl-1">
                {o.choices.map((c, ci) => (
                  <div key={ci} className="flex items-center gap-2">
                    <input
                      value={c.label}
                      onChange={(e) =>
                        setOptions((s) => s.map((x) => (x.id === o.id ? { ...x, choices: x.choices.map((cc, i) => (i === ci ? { ...cc, label: e.target.value } : cc)) } : x)))
                      }
                      maxLength={40}
                      placeholder="Saignant, Extra fromage…"
                      className={`${miniInput} flex-1`}
                    />
                    <div className="flex w-24 items-center gap-1">
                      <span className="text-xs text-[var(--text3)]">+</span>
                      <input
                        value={c.price_delta}
                        onChange={(e) =>
                          setOptions((s) => s.map((x) => (x.id === o.id ? { ...x, choices: x.choices.map((cc, i) => (i === ci ? { ...cc, price_delta: e.target.value } : cc)) } : x)))
                        }
                        inputMode="decimal"
                        placeholder="€"
                        className={`${miniInput} w-full`}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setOptions((s) => s.map((x) => (x.id === o.id ? { ...x, choices: x.choices.filter((_, i) => i !== ci) } : x)))}
                      aria-label="Retirer le choix"
                      className="px-1 text-[var(--text3)] hover:text-red-500"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setOptions((s) => s.map((x) => (x.id === o.id ? { ...x, choices: [...x.choices, { label: '', price_delta: '' }] } : x)))}
                  className="text-xs font-semibold text-[var(--primary)] hover:underline"
                >
                  + Ajouter un choix
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setOptions((s) => [...s, { id: newLeafId(), name: '', required: false, choices: [{ label: '', price_delta: '' }] }])}
            className="text-sm font-semibold text-[var(--primary)] hover:underline"
          >
            + Ajouter un groupe d&apos;options
          </button>
        </div>
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

      <div>
        <label className={labelCls}>Catégories</label>
        <DishCategoryPicker initial={item?.category_slugs ?? []} max={3} />
        <p className="mt-1 text-xs text-[var(--text3)]">Relie le plat aux catégories notées par la communauté DishRank (3 max).</p>
      </div>

      {/* Disponibilité */}
      <div>
        <label className={labelCls}>Disponibilité</label>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs text-[var(--text3)]">Service :</span>
            {[
              { key: 'lunch', label: 'Midi' },
              { key: 'dinner', label: 'Soir' },
            ].map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setServices((v) => (v.includes(s.key) ? v.filter((x) => x !== s.key) : [...v, s.key]))}
                className={pill(services.includes(s.key))}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs text-[var(--text3)]">Jours :</span>
            {DAYS.map((d) => (
              <button
                key={d.n}
                type="button"
                onClick={() => setDays((v) => (v.includes(d.n) ? v.filter((x) => x !== d.n) : [...v, d.n]))}
                className={`${pill(days.includes(d.n))} w-8`}
              >
                {d.l}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-xs text-[var(--text3)]">Saison (MM-JJ) :</span>
            <input value={seasonFrom} onChange={(e) => setSeasonFrom(e.target.value)} maxLength={5} placeholder="06-01" className={`${miniInput} w-20`} />
            <span className="text-xs text-[var(--text3)]">→</span>
            <input value={seasonTo} onChange={(e) => setSeasonTo(e.target.value)} maxLength={5} placeholder="09-30" className={`${miniInput} w-20`} />
          </div>
          <p className="text-xs text-[var(--text3)]">Laissez vide = toujours disponible.</p>
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
