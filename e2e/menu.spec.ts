import { expect, test } from '@playwright/test';
import { SEED, hasServiceRoleKey, serviceSelect } from './helpers/data';

/**
 * Carte numérique (QR de table) : /menu/<id> affiche la carte publiée de
 * « Resto Pro Maestro » (seed), et un client note un plat SANS compte.
 *
 * La note est écrite par le serveur avec la clé service_role : sans la clé
 * DEV (.env.test.local), ce test est sauté. Le seed efface les notes à chaque
 * passage (une note par plat et par mois et par visiteur).
 */
test('la carte publiée s’affiche', async ({ page }) => {
  await page.goto(`/menu/${SEED.proRestaurantId}`);
  await expect(page.getByText(SEED.proRestaurantName).first()).toBeVisible();
  await expect(page.getByText('Burger Maestro').first()).toBeVisible();
  await expect(page.getByText('Tarte Maestro').first()).toBeVisible();
});

test('noter un plat sans compte', async ({ page }) => {
  test.skip(
    !hasServiceRoleKey,
    'Clé service_role DEV absente (vitrine/.env.test.local : SUPABASE_SERVICE_ROLE_KEY_DEV) : la note sans compte est écrite par le serveur avec cette clé.'
  );
  // Compte avant / après : le test reste juste sans reseed entre deux passages.
  const guestCount = async () =>
    ((await serviceSelect<{ id: string; user_id: string | null }[]>(
      `reviews?restaurant_id=eq.${SEED.proRestaurantId}&select=id,user_id`
    )) ?? []).filter((r) => r.user_id === null).length;
  const before = await guestCount();

  await page.goto(`/menu/${SEED.proRestaurantId}`);
  await page.getByRole('button', { name: /Noter/ }).first().click();
  await expect(page.getByText('Burger Maestro').last()).toBeVisible();
  await page.getByRole('button', { name: '5/5' }).click();
  await page.getByPlaceholder('Un mot sur ce plat ? (optionnel)').fill('Testé par Playwright');
  await page.getByRole('button', { name: 'Publier' }).click();
  await expect(page.getByText('Merci pour votre note !')).toBeVisible();

  await expect.poll(guestCount).toBe(before + 1);
});
