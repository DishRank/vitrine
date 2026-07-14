'use client';

import { useCallback, useEffect, useRef } from 'react';
import { inputCls, labelCls } from '../../_components/fields';
import { useAutoSave } from '../../_components/useAutoSave';
import { setSaveStatus } from '../../_components/saveStatusStore';
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
  const formRef = useRef<HTMLFormElement>(null);

  const save = useCallback(async () => {
    const form = formRef.current;
    if (!form) return { ok: true };
    const fd = new FormData(form);
    const payload: Record<string, unknown> = { id };
    fd.forEach((v, k) => {
      payload[k] = v;
    });
    const res = await fetch('/api/pro/listing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    return { ok: res.ok && !!json.ok, error: json.error };
  }, [id]);

  const { status, schedule, flush } = useAutoSave(save);

  // Publie l'état d'auto-save dans l'en-tête du workspace (à côté d'« Aperçu
  // public »), pas dans le pied du formulaire. Remise à idle en quittant la fiche.
  useEffect(() => {
    setSaveStatus(status);
  }, [status]);
  useEffect(() => () => setSaveStatus('idle'), []);

  // Déclenchement au niveau de CHAQUE champ (onChange React fiable, contrairement
  // à onInput/onChange au niveau du <form> en React 19). Débounce dans le hook.
  return (
    <form
      ref={formRef}
      onBlur={flush}
      onSubmit={(e) => {
        e.preventDefault();
        flush();
      }}
      className="space-y-6"
    >
      <section className="rounded-2xl border border-[var(--border2)] bg-[var(--surface)] p-5 sm:p-6 space-y-4">
        <h2 className="text-base font-extrabold">Présentation</h2>
        <div>
          <label htmlFor="description" className={labelCls}>Description</label>
          <textarea
            id="description" name="description" rows={4} maxLength={600}
            defaultValue={initial.description}
            onChange={schedule}
            placeholder="Quelques mots sur votre établissement, votre cuisine, votre histoire…"
            className={inputCls}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="price_level" className={labelCls}>Gamme de prix</label>
            <select id="price_level" name="price_level" defaultValue={initial.price_level ?? ''} onChange={schedule} className={inputCls}>
              <option value="">Non précisé</option>
              <option value="1">€ — économique</option>
              <option value="2">€€ — modéré</option>
              <option value="3">€€€ — haut de gamme</option>
              <option value="4">€€€€ — gastronomique</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>Types de cuisine</label>
            <CuisineAutocomplete initial={initial.cuisines} max={8} onChange={schedule} />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-[var(--border2)] bg-[var(--surface)] p-5 sm:p-6 space-y-4">
        <h2 className="text-base font-extrabold">Contact &amp; liens</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="phone" className={labelCls}>Téléphone</label>
            <input id="phone" name="phone" type="tel" defaultValue={initial.phone} onChange={schedule} placeholder="04 78 00 00 00" className={inputCls} />
          </div>
          <div>
            <label htmlFor="website" className={labelCls}>Site web</label>
            <input id="website" name="website" type="text" defaultValue={initial.website} onChange={schedule} placeholder="votre-site.fr" className={inputCls} />
          </div>
          <div>
            <label htmlFor="reservation_url" className={labelCls}>Lien de réservation</label>
            <input id="reservation_url" name="reservation_url" type="text" defaultValue={initial.reservation_url} onChange={schedule} placeholder="thefork.fr/…" className={inputCls} />
          </div>
          <div>
            <label htmlFor="menu_url" className={labelCls}>Lien du menu (externe)</label>
            <input id="menu_url" name="menu_url" type="text" defaultValue={initial.menu_url} onChange={schedule} placeholder="votre-site.fr/carte" className={inputCls} />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="instagram" className={labelCls}>Instagram</label>
            <input id="instagram" name="instagram" type="text" defaultValue={initial.instagram} onChange={schedule} placeholder="@votre_resto" className={inputCls} />
          </div>
        </div>
      </section>
    </form>
  );
}
