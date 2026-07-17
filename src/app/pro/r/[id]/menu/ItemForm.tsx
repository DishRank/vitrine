'use client';

import { useActionState, useEffect, useState } from 'react';
import { upsertItemAction, type MenuActionState } from './menuActions';
import { ALLERGENS, DIETS } from './vocab';
import type { EditorItem, MenuItemI18n } from './menuData';
import { newLeafId } from './menuLeaves';
import DishCategoryPicker from './DishCategoryPicker';
import ItemAliases from './ItemAliases';
import FlagIcon from '@/components/FlagIcon';
import { inputCls, labelCls, FormError } from '../../../_components/fields';

/** États d'édition : prix en STRING (saisie tolérante), sérialisés en number.
 *  `i18n` = traductions par locale du libellé (variante/choix) ou du nom (groupe
 *  d'options) — édité sur les onglets de langue, comme le nom/description du plat. */
interface VariantDraft {
  id: string;
  label: string;
  price: string;
  i18n: Record<string, { label?: string }>;
}
interface ChoiceDraft {
  label: string;
  price_delta: string;
  i18n: Record<string, { label?: string }>;
}
interface OptionDraft {
  id: string;
  name: string;
  required: boolean;
  choices: ChoiceDraft[];
  i18n: Record<string, { name?: string }>;
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

// Traduction manuelle par plat (onglets). fr = source (colonnes name/description).
const TRANSLATABLE = ['en', 'es', 'de', 'it'];
const LANG_LABEL: Record<string, string> = { en: 'Anglais', es: 'Espagnol', de: 'Allemand', it: 'Italien' };

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
  menuLanguages,
  premium,
}: {
  restaurantId: string;
  sectionId: string;
  item?: EditorItem;
  onDone: () => void;
  menuLanguages: string[];
  premium: boolean;
}) {
  const [state, action] = useActionState<MenuActionState, FormData>(
    upsertItemAction.bind(null, restaurantId),
    {}
  );

  // Onglets de traduction : langues éditables = celles activées (LanguagePanel),
  // restreintes à EN pour un resto gratuit (fr+en gratuits ; es/de/it premium).
  const editable = (premium ? menuLanguages : menuLanguages.filter((l) => l === 'en')).filter((l) =>
    TRANSLATABLE.includes(l)
  );
  const [tab, setTab] = useState<string>('fr');
  const [i18n, setI18n] = useState<MenuItemI18n>(() => ({ ...(item?.i18n ?? {}) }));
  // Édition manuelle d'une locale → on retire `_auto`/`_h` : l'entrée devient
  // « manuelle », l'auto-trad ne la réécrit plus jamais (contrat mig 085).
  const setLoc = (loc: string, field: 'name' | 'description', value: string) =>
    setI18n((prev) => {
      const cur = prev[loc] ?? {};
      const next: { name?: string; description?: string } = {
        name: field === 'name' ? value : cur.name,
        description: field === 'description' ? value : cur.description,
      };
      return { ...prev, [loc]: next };
    });

  const [variants, setVariants] = useState<VariantDraft[]>(() =>
    (item?.variants ?? []).map((v) => ({
      id: v.id || newLeafId(),
      label: v.label,
      price: v.price != null ? String(v.price) : '',
      i18n: { ...(v.i18n ?? {}) },
    }))
  );
  const [options, setOptions] = useState<OptionDraft[]>(() =>
    (item?.options ?? []).map((o) => ({
      id: o.id || newLeafId(),
      name: o.name,
      required: !!o.required,
      i18n: { ...(o.i18n ?? {}) },
      choices: (o.choices ?? []).map((c) => ({
        label: c.label,
        price_delta: c.price_delta != null ? String(c.price_delta) : '',
        i18n: { ...(c.i18n ?? {}) },
      })),
    }))
  );
  // Setters des traductions de feuilles (onglets de langue, tab ≠ fr).
  const setVariantI18n = (id: string, loc: string, value: string) =>
    setVariants((s) => s.map((v) => (v.id === id ? { ...v, i18n: { ...v.i18n, [loc]: { label: value } } } : v)));
  const setOptionI18n = (id: string, loc: string, value: string) =>
    setOptions((s) => s.map((o) => (o.id === id ? { ...o, i18n: { ...o.i18n, [loc]: { name: value } } } : o)));
  const setChoiceI18n = (oid: string, ci: number, loc: string, value: string) =>
    setOptions((s) =>
      s.map((o) =>
        o.id === oid
          ? { ...o, choices: o.choices.map((c, i) => (i === ci ? { ...c, i18n: { ...c.i18n, [loc]: { label: value } } } : c)) }
          : o
      )
    );
  const [services, setServices] = useState<string[]>(() => item?.availability?.services ?? []);
  const [days, setDays] = useState<number[]>(() => item?.availability?.days ?? []);
  const [seasonFrom, setSeasonFrom] = useState(() => item?.availability?.season?.from ?? '');
  const [seasonTo, setSeasonTo] = useState(() => item?.availability?.season?.to ?? '');

  // Repli progressif : sections avancées repliées par défaut (plat simple =
  // nom + prix), ouvertes si le plat en a déjà.
  const [advOpen, setAdvOpen] = useState(() => variants.length > 0 || options.length > 0);
  const [metaOpen, setMetaOpen] = useState(
    () =>
      (item?.category_slugs?.length ?? 0) > 0 ||
      services.length > 0 ||
      days.length > 0 ||
      !!seasonFrom ||
      !!seasonTo
  );
  const summaryCls = 'cursor-pointer select-none text-sm font-bold text-[var(--text2)] hover:text-[var(--text)]';
  const detailsCls = 'rounded-xl border border-[var(--border2)] bg-[var(--surface)] px-3.5 py-2.5';

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

  // Payloads sérialisés (relus + revalidés par le Server Action). `i18n` inclus
  // (traductions des variantes/options) — le serveur assainit et écarte le vide.
  const variantsPayload = variants.map((v) => ({
    id: v.id,
    label: v.label.trim(),
    price: parseNum(v.price),
    i18n: v.i18n,
  }));
  const optionsPayload = options.map((o) => ({
    id: o.id,
    name: o.name.trim(),
    required: o.required,
    max: 1,
    i18n: o.i18n,
    choices: o.choices.map((c) => {
      const d = parseNum(c.price_delta);
      const base = d > 0 ? { label: c.label.trim(), price_delta: d } : { label: c.label.trim() };
      return { ...base, i18n: c.i18n };
    }),
  }));
  const availabilityPayload = { services, days, seasonFrom, seasonTo };

  return (
    <div className="space-y-4">
    <form action={action} className="space-y-4">
      {item ? <input type="hidden" name="id" value={item.id} /> : null}
      {item ? <input type="hidden" name="expectedUpdatedAt" value={item.updated_at} /> : null}
      <input type="hidden" name="sectionId" value={sectionId} />
      <input type="hidden" name="variants" value={JSON.stringify(variantsPayload)} />
      <input type="hidden" name="options" value={JSON.stringify(optionsPayload)} />
      <input type="hidden" name="availability" value={JSON.stringify(availabilityPayload)} />

      {/* Onglets de langue — traduction manuelle du plat (nom + description). Le
          français est la source ; chaque langue activée a son onglet. */}
      {editable.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={() => setTab('fr')} className={pill(tab === 'fr')}>
            <FlagIcon code="fr" size={15} style={{ verticalAlign: '-2px', marginRight: 5 }} />
            Français <span className="font-normal opacity-60">· source</span>
          </button>
          {editable.map((l) => {
            const filled = !!i18n[l]?.name?.trim();
            return (
              <button key={l} type="button" onClick={() => setTab(l)} className={pill(tab === l)}>
                <FlagIcon code={l} size={15} style={{ verticalAlign: '-2px', marginRight: 5 }} />
                {LANG_LABEL[l]}{' '}
                {filled ? (
                  <span className="font-bold text-[var(--accent-success)]">✓</span>
                ) : (
                  <span className="font-normal opacity-60">· à traduire</span>
                )}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
        <div>
          <label className={labelCls}>{tab === 'fr' ? 'Nom du plat' : `Nom · ${LANG_LABEL[tab]}`}</label>
          {/* Source FR — toujours soumise (name="name") ; masquée hors onglet fr.
              Pas de `required` : un champ caché requis bloquerait le submit ; le
              serveur valide le nom. */}
          <input
            name="name"
            type="text"
            maxLength={120}
            defaultValue={item?.name ?? ''}
            placeholder="Ramen tonkotsu"
            className={inputCls}
            autoFocus
            style={tab === 'fr' ? undefined : { display: 'none' }}
          />
          {tab !== 'fr' ? (
            <input
              key={tab}
              type="text"
              maxLength={200}
              value={i18n[tab]?.name ?? ''}
              onChange={(e) => setLoc(tab, 'name', e.target.value)}
              placeholder={item?.name || 'Traduction du nom…'}
              className={inputCls}
            />
          ) : null}
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
        <label className={labelCls}>{tab === 'fr' ? 'Description' : `Description · ${LANG_LABEL[tab]}`}</label>
        <textarea
          name="description"
          rows={2}
          maxLength={400}
          defaultValue={item?.description ?? ''}
          placeholder="Bouillon de porc mijoté 12 h, nouilles fraîches, œuf mollet…"
          className={inputCls}
          style={tab === 'fr' ? undefined : { display: 'none' }}
        />
        {tab !== 'fr' ? (
          <textarea
            key={tab}
            rows={2}
            maxLength={1000}
            value={i18n[tab]?.description ?? ''}
            onChange={(e) => setLoc(tab, 'description', e.target.value)}
            placeholder={item?.description || 'Traduction de la description…'}
            className={inputCls}
          />
        ) : null}
      </div>

      <input type="hidden" name="i18n" value={JSON.stringify(i18n)} />

      <details open={advOpen} onToggle={(e) => setAdvOpen(e.currentTarget.open)} className={detailsCls}>
        <summary className={summaryCls}>Variantes &amp; options <span className="font-normal text-[var(--text3)]">· facultatif</span></summary>
        <div className="mt-3 space-y-3">
      {/* Variantes de prix */}
      <div>
        <label className={labelCls}>Variantes (verre/bouteille, 25/50 cl…)</label>
        <div className="space-y-2">
          {variants.map((v) =>
            tab === 'fr' ? (
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
            ) : (
              <div key={v.id} className="flex items-center gap-2">
                <span className="w-2/5 truncate text-sm text-[var(--text3)]" title={v.label}>{v.label || '—'}</span>
                <input
                  value={v.i18n[tab]?.label ?? ''}
                  onChange={(e) => setVariantI18n(v.id, tab, e.target.value)}
                  maxLength={60}
                  placeholder={`Traduction · ${LANG_LABEL[tab]}`}
                  className={`${miniInput} flex-1`}
                />
              </div>
            )
          )}
          {tab === 'fr' ? (
            <button
              type="button"
              onClick={() => setVariants((s) => [...s, { id: newLeafId(), label: '', price: '', i18n: {} }])}
              className="text-sm font-semibold text-[var(--primary)] hover:underline"
            >
              + Ajouter une variante
            </button>
          ) : variants.length === 0 ? (
            <p className="text-xs text-[var(--text3)]">Aucune variante à traduire.</p>
          ) : null}
        </div>
      </div>

      {/* Options / suppléments */}
      <div>
        <label className={labelCls}>Options / suppléments</label>
        <div className="space-y-3">
          {options.map((o) => (
            <div key={o.id} className="rounded-xl border border-[var(--border2)] bg-[var(--surface)] p-3 space-y-2">
              {tab === 'fr' ? (
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
              ) : (
                <div className="flex items-center gap-2">
                  <span className="w-2/5 truncate text-sm font-semibold text-[var(--text3)]" title={o.name}>{o.name || '—'}</span>
                  <input
                    value={o.i18n[tab]?.name ?? ''}
                    onChange={(e) => setOptionI18n(o.id, tab, e.target.value)}
                    maxLength={60}
                    placeholder={`Traduction · ${LANG_LABEL[tab]}`}
                    className={`${miniInput} flex-1`}
                  />
                </div>
              )}
              <div className="space-y-1.5 pl-1">
                {o.choices.map((c, ci) =>
                  tab === 'fr' ? (
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
                  ) : (
                    <div key={ci} className="flex items-center gap-2">
                      <span className="w-2/5 truncate text-sm text-[var(--text3)]" title={c.label}>{c.label || '—'}</span>
                      <input
                        value={c.i18n[tab]?.label ?? ''}
                        onChange={(e) => setChoiceI18n(o.id, ci, tab, e.target.value)}
                        maxLength={60}
                        placeholder={`Traduction · ${LANG_LABEL[tab]}`}
                        className={`${miniInput} flex-1`}
                      />
                    </div>
                  )
                )}
                {tab === 'fr' ? (
                  <button
                    type="button"
                    onClick={() => setOptions((s) => s.map((x) => (x.id === o.id ? { ...x, choices: [...x.choices, { label: '', price_delta: '', i18n: {} }] } : x)))}
                    className="text-xs font-semibold text-[var(--primary)] hover:underline"
                  >
                    + Ajouter un choix
                  </button>
                ) : null}
              </div>
            </div>
          ))}
          {tab === 'fr' ? (
          <button
            type="button"
            onClick={() => setOptions((s) => [...s, { id: newLeafId(), name: '', required: false, i18n: {}, choices: [{ label: '', price_delta: '', i18n: {} }] }])}
            className="text-sm font-semibold text-[var(--primary)] hover:underline"
          >
            + Ajouter un groupe d&apos;options
          </button>
          ) : options.length === 0 ? (
            <p className="text-xs text-[var(--text3)]">Aucune option à traduire.</p>
          ) : null}
        </div>
      </div>
        </div>
      </details>

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

      <details open={metaOpen} onToggle={(e) => setMetaOpen(e.currentTarget.open)} className={detailsCls}>
        <summary className={summaryCls}>Catégories &amp; disponibilité <span className="font-normal text-[var(--text3)]">· facultatif</span></summary>
        <div className="mt-3 space-y-3">
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
        </div>
      </details>

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

      {/* Noms alternatifs (mig 112) — écritures immédiates, hors du <form>. */}
      {item ? (
        <ItemAliases restaurantId={restaurantId} itemId={item.id} initialAliases={item.aliases} />
      ) : null}
    </div>
  );
}
