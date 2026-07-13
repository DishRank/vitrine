'use client';

import { useActionState } from 'react';
import { updateListingAction, type ListingActionState } from './listingActions';
import { SubmitButton, FormError, FormSuccess, inputCls, labelCls } from '../../_components/fields';
import CuisineAutocomplete from './CuisineAutocomplete';

export interface ListingInitial {
  description: string;
  phone: string;
  website: string;
  reservation_url: string;
  menu_url: string;
  instagram: string;
  price_level: number | null;
  cuisines: string[];
}

export default function ListingForm({ id, initial }: { id: string; initial: ListingInitial }) {
  const action = updateListingAction.bind(null, id);
  const [state, formAction] = useActionState<ListingActionState, FormData>(action, {});

  return (
    <form action={formAction} className="space-y-6">
      <section className="rounded-2xl border border-[var(--border2)] bg-[var(--surface)] p-5 sm:p-6 space-y-4">
        <h2 className="text-base font-extrabold">Présentation</h2>
        <div>
          <label htmlFor="description" className={labelCls}>Description</label>
          <textarea
            id="description" name="description" rows={4} maxLength={600}
            defaultValue={initial.description}
            placeholder="Quelques mots sur votre établissement, votre cuisine, votre histoire…"
            className={inputCls}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="price_level" className={labelCls}>Gamme de prix</label>
            <select id="price_level" name="price_level" defaultValue={initial.price_level ?? ''} className={inputCls}>
              <option value="">Non précisé</option>
              <option value="1">€ — économique</option>
              <option value="2">€€ — modéré</option>
              <option value="3">€€€ — haut de gamme</option>
              <option value="4">€€€€ — gastronomique</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Types de cuisine</label>
            <CuisineAutocomplete initial={initial.cuisines} max={8} />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border2)] bg-[var(--surface)] p-5 sm:p-6 space-y-4">
        <h2 className="text-base font-extrabold">Contact &amp; liens</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="phone" className={labelCls}>Téléphone</label>
            <input id="phone" name="phone" type="tel" defaultValue={initial.phone} placeholder="04 78 00 00 00" className={inputCls} />
          </div>
          <div>
            <label htmlFor="website" className={labelCls}>Site web</label>
            <input id="website" name="website" type="text" defaultValue={initial.website} placeholder="votre-site.fr" className={inputCls} />
          </div>
          <div>
            <label htmlFor="reservation_url" className={labelCls}>Lien de réservation</label>
            <input id="reservation_url" name="reservation_url" type="text" defaultValue={initial.reservation_url} placeholder="thefork.fr/…" className={inputCls} />
          </div>
          <div>
            <label htmlFor="menu_url" className={labelCls}>Lien du menu (externe)</label>
            <input id="menu_url" name="menu_url" type="text" defaultValue={initial.menu_url} placeholder="votre-site.fr/carte" className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="instagram" className={labelCls}>Instagram</label>
            <input id="instagram" name="instagram" type="text" defaultValue={initial.instagram} placeholder="@votre_resto" className={inputCls} />
          </div>
        </div>
      </section>

      <div className="sticky bottom-0 -mx-4 border-t border-[var(--border2)] bg-[var(--bg)]/90 px-4 py-3 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="w-full max-w-[220px]">
            <SubmitButton>Enregistrer</SubmitButton>
          </div>
          <FormError error={state.error} />
          <FormSuccess message={state.ok ? 'Fiche mise à jour ✓' : undefined} />
        </div>
      </div>
    </form>
  );
}
