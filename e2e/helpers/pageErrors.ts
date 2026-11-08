import type { Page } from '@playwright/test';

/**
 * Erreurs d'une page pendant un test : exceptions JS, erreurs console, et
 * réponses en erreur du site lui-même (hors images optimisées : la base DEV
 * contient des photos de démonstration hébergées ailleurs, parfois
 * injoignables — ce n'est pas un défaut du site).
 */
export function watchPageErrors(page: Page): string[] {
  const errors: string[] = [];
  const origin = () => new URL(page.url() || 'http://localhost').origin;
  page.on('pageerror', (e) => errors.push(`exception: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    // Doublon des réponses en erreur, examinées ci-dessous avec leur adresse.
    if (m.text().startsWith('Failed to load resource')) return;
    errors.push(`console: ${m.text().slice(0, 300)}`);
  });
  page.on('response', (r) => {
    const url = r.url();
    if (r.status() < 400 || !url.startsWith(origin())) return;
    if (url.includes('/_next/image')) return;
    // La page elle-même peut être une 404 voulue : vérifiée par le test.
    if (r.request().isNavigationRequest()) return;
    errors.push(`${r.status()} ${url}`);
  });
  return errors;
}