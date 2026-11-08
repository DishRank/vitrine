import { expect, test } from '@playwright/test';

/** Pages publiques qui doivent toujours s'afficher. */
test('accueil', async ({ page }) => {
  const res = await page.goto('/');
  expect(res?.status()).toBeLessThan(400);
  await expect(page).toHaveTitle(/DishRank/);
});

test('connexion pro', async ({ page }) => {
  await page.goto('/pro/login');
  await expect(page.getByRole('button', { name: 'Se connecter' })).toBeVisible();
});

test('carte d’un restaurant inconnu : introuvable', async ({ page }) => {
  const res = await page.goto('/menu/00000000-0000-4000-8000-000000000000');
  expect(res?.status()).toBe(404);
});
