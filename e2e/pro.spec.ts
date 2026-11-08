import { expect, test, type Page } from '@playwright/test';
import { proMfaSecret } from './env';
import { SEED, freshTotpWindow, totp } from './helpers/data';

/**
 * Espace pro + double authentification (mig. 211) : « Maestro Pro » a un
 * appareil inscrit (seed). Après le mot de passe, la session attend le code :
 * l'espace reste fermé tant qu'il n'est pas saisi ; un faux code est refusé ;
 * le bon ouvre le tableau de bord. Puis, connecté : réponse à un avis client,
 * plat ajouté à la carte et visible sur la carte publique.
 */
test('mauvais mot de passe : message générique', async ({ page }) => {
  await page.goto('/pro/login');
  await page.locator('#email').fill(SEED.pro);
  await page.locator('#password').fill('pas-le-bon-mot-de-passe');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).toHaveURL(/\/pro\/login/);
  // Il ne dit pas lequel des deux est faux.
  await expect(page.getByRole('alert').filter({ hasText: /\S/ })).toHaveText('Email ou mot de passe incorrect.');
});

test.describe.serial('connecté avec la double authentification', () => {
  let page: Page;
  const secret = proMfaSecret();

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
  });
  test.afterAll(async () => {
    await page?.close();
  });

  test('connexion : mot de passe puis code', async () => {
    test.skip(!secret, 'Secret 2FA du compte pro absent : lance `npm run e2e:seed` dans le dépôt dishrank.');
    await page.goto('/pro/login');
    await page.locator('#email').fill(SEED.pro);
    await page.locator('#password').fill(SEED.password);
    await page.getByRole('button', { name: 'Se connecter' }).click();
    await expect(page).toHaveURL(/\/pro\/mfa/);
    await expect(page.getByRole('heading', { name: 'Vérification en deux étapes' })).toBeVisible();

    // Session en attente du code : l'espace renvoie vers la saisie du code.
    await page.goto(`/pro/r/${SEED.proRestaurantId}`);
    await expect(page).toHaveURL(/\/pro\/mfa/);

    // Faux code.
    await page.getByLabel('Code').fill('000000');
    await page.getByRole('button', { name: 'Vérifier' }).click();
    await expect(page.getByRole('alert').filter({ hasText: /Code incorrect/ })).toBeVisible();
    await expect(page).toHaveURL(/\/pro\/mfa/);

    // Bon code → tableau de bord de l'établissement.
    await freshTotpWindow();
    await page.getByLabel('Code').fill(totp(secret!));
    await page.getByRole('button', { name: 'Vérifier' }).click();
    await expect(page).toHaveURL(new RegExp(`/pro/r/${SEED.proRestaurantId}`));
    await expect(page.getByText(SEED.proRestaurantName).first()).toBeVisible();
  });

  test('répondre à un avis client, puis supprimer la réponse', async () => {
    test.skip(!secret, 'connexion impossible sans le secret 2FA');
    await page.goto(`/pro/r/${SEED.proRestaurantId}/avis`);
    // Onglet « Répondre » : les avis sans réponse, en liste.
    await page.getByRole('button', { name: /^Répondre\s*\d+$/ }).click();
    const card = page.locator('div', { hasText: 'Avis de Bob pour le pro' }).filter({ has: page.locator('textarea') }).last();
    await expect(card).toBeVisible();
    await card.locator('textarea').fill('Merci Bob, à bientôt ! (Playwright)');
    await card.getByRole('button', { name: 'Répondre' }).click();
    // Répondu : l'avis quitte la liste « à répondre »…
    await expect(page.getByText('Avis de Bob pour le pro')).toHaveCount(0);

    // … et s'affiche avec sa réponse dans « Les avis », rangé par plat.
    await page.getByRole('button', { name: 'Les avis' }).click();
    await page.getByRole('button', { name: /Burger Maestro/ }).first().click();
    await expect(page.getByText('Merci Bob, à bientôt ! (Playwright)')).toBeVisible();

    await page.getByRole('button', { name: 'Supprimer', exact: true }).first().click();
    await page.getByRole('dialog', { name: 'Supprimer la réponse' }).getByRole('button', { name: 'Supprimer' }).click();
    await expect(page.getByText('Merci Bob, à bientôt ! (Playwright)')).toHaveCount(0);
  });

  test('ajouter un plat à la carte : visible sur la carte publique', async () => {
    test.skip(!secret, 'connexion impossible sans le secret 2FA');
    const dish = `Salade Playwright ${Date.now()}`;
    await page.goto(`/pro/r/${SEED.proRestaurantId}/menu`);
    await page.getByRole('button', { name: /Ajouter un plat/ }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Ajouter un plat' });
    await expect(dialog).toBeVisible();
    await dialog.locator('input[name="name"]').fill(dish);
    await dialog.locator('input[name="price"]').fill('9.50');
    await dialog.getByRole('button', { name: 'Ajouter le plat' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText(dish).first()).toBeVisible();

    // Carte publique (QR de table), dans un autre onglet sans session.
    const visitor = await page.context().browser()!.newPage();
    await expect
      .poll(async () => {
        await visitor.goto(`/menu/${SEED.proRestaurantId}`);
        return visitor.getByText(dish).count();
      }, { timeout: 30_000 })
      .toBeGreaterThan(0);
    await visitor.close();
  });
});
