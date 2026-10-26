/** Prix « à la française » : 20 €, 19,45 €, avec une espace insécable avant €. */
export function euros(x: number): string {
  const s = Number.isInteger(x) ? String(x) : x.toFixed(2).replace('.', ',');
  return `${s} €`;
}

/** Écart à l'indice 100 : +8 %, −28 %, 0 % à ±1. */
export function ecart(index: number): string {
  const d = index - 100;
  if (Math.abs(d) <= 1) return '0\u00a0%';
  return `${d > 0 ? '+' : '−'}${Math.abs(d)} %`;
}

export function dateFr(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Paris' }).format(
    new Date(`${iso}T12:00:00Z`)
  );
}

/** Position en % sur un axe [min, max]. */
export function pos(x: number, min: number, max: number): string {
  return `${(((x - min) / (max - min)) * 100).toFixed(2)}%`;
}
