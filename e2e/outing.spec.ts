import { expect, test } from '@playwright/test';
import { SEED, rpc, signIn } from './helpers/data';

/**
 * Vote d'une sortie SANS compte : /s/<jeton>, le lien « Inviter des amis sans
 * l'appli ». Alice crée la sortie par l'API dans « Sortie Site Maestro » ; un
 * invité coche un lieu sur le site ; Alice voit son vote.
 */
type Outing = {
  id: string;
  share_token: string | null;
  guests: { name: string; voted: boolean }[];
  candidates: { id: string; name: string; approvals: number }[];
};

let aliceToken: string;
let outing: Outing;

test.beforeAll(async () => {
  aliceToken = await signIn(SEED.alice);
  outing = await rpc<Outing>(aliceToken, 'create_outing', {
    p_group_id: SEED.outingGroupId,
    p_category: 'eat',
    p_planned_at: null,
    p_center_lat: 45.764,
    p_center_lng: 4.8357,
    p_center_label: 'Lyon',
  });
  expect(outing.share_token, 'jeton de partage de la sortie').toBeTruthy();
  expect(outing.candidates.length, 'lieux proposés autour de Lyon (base DEV)').toBeGreaterThan(0);
});

test.afterAll(async () => {
  if (outing?.id) await rpc(aliceToken, 'outing_cancel', { p_session_id: outing.id }).catch(() => {});
});

test('un invité coche un lieu, le groupe voit son vote', async ({ page }) => {
  await page.goto(`/s/${outing.share_token}`);
  await expect(page.getByRole('heading', { name: 'Les propositions' })).toBeVisible();

  const first = page.getByRole('button', { name: /^Ça me va pour / }).first();
  const label = (await first.textContent()) ?? '';
  const placeName = label.replace(/^.*Ça me va pour /, '').trim();
  await first.click();

  // Premier vote : le prénom est demandé (pas de compte).
  const dialog = page.getByRole('dialog', { name: 'Ton prénom' });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel('Prénom').fill('Invité Playwright');
  await dialog.getByRole('button', { name: 'Voter' }).click();

  await expect(page.getByRole('button', { name: `Ça me va pour ${placeName}` })).toHaveAttribute(
    'aria-pressed',
    'true'
  );

  // Côté groupe : la sortie lue par Alice compte l'invité et son vote.
  await expect
    .poll(async () => {
      const o = await rpc<Outing>(aliceToken, 'get_outing', { p_session_id: outing.id });
      const guest = o.guests.find((g) => g.name === 'Invité Playwright');
      const place = o.candidates.find((c) => c.name === placeName);
      return !!guest?.voted && (place?.approvals ?? 0) > 0;
    })
    .toBe(true);
});

test('un lien inconnu mène à une page introuvable', async ({ page }) => {
  const res = await page.goto('/s/AAAAAAAAAAAAAAAAAAAAAA');
  expect(res?.status()).toBe(404);
});
