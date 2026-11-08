import { expect, type Page } from '@playwright/test';
import { proMfaSecret } from '../env';
import { SEED, freshTotpWindow, totp } from './data';

/** Secret TOTP du compte pro de test (recréé par `npm run e2e:seed`, dépôt dishrank). */
export const proSecret = proMfaSecret();
export const NO_PRO_SECRET = 'Secret 2FA du compte pro absent : lance `npm run e2e:seed` dans le dépôt dishrank.';

/** Connexion à l'espace pro : mot de passe, puis code de double authentification. */
export async function loginPro(page: Page): Promise<void> {
  if (!proSecret) throw new Error(NO_PRO_SECRET);
  await page.goto('/pro/login');
  await page.locator('#email').fill(SEED.pro);
  await page.locator('#password').fill(SEED.password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/pro\/mfa/);
  await freshTotpWindow();
  await page.getByLabel('Code').fill(totp(proSecret));
  await page.getByRole('button', { name: 'Vérifier' }).click();
  await expect(page).toHaveURL(new RegExp(`/pro/r/${SEED.proRestaurantId}`));
}