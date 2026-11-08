import { expect, test } from "@playwright/test";
import {
  SEED,
  hasServiceRoleKey,
  jwtSub,
  signIn,
  userSelect,
} from "./helpers/data";
import { watchPageErrors } from "./helpers/pageErrors";

/**
 * Pages ouvertes depuis un lien partagé (hors référencement) : lien d'un plat,
 * fiche restaurant, parrainage, invitation de groupe, confirmation d'email.
 * Toutes hors index, toutes sans erreur.
 */
let errors: string[];
test.beforeEach(({ page }) => {
  errors = watchPageErrors(page);
});
test.afterEach(() => {
  expect(errors, "erreurs dans la page").toEqual([]);
});

async function expectNoindex(page: import("@playwright/test").Page) {
  const robots = await page
    .locator('meta[name="robots"]')
    .evaluateAll((els) => els.map((e) => e.getAttribute("content")));
  expect(robots.length).toBeGreaterThan(0);
  for (const r of robots) expect(r).toMatch(/noindex/);
}

test("lien d’un plat : page d’installation, les deux stores", async ({
  page,
}) => {
  await page.goto("/dish");
  await expect(
    page.getByRole("heading", { name: "Voir ce plat sur DishRank" }),
  ).toBeVisible();
  await expect(
    page.getByText("découvrir les avis de la communauté", { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /App Store/ })).toHaveAttribute(
    "href",
    /apps\.apple\.com/,
  );
  // Fiche publique du Play Store (l'app est publiée), pas l'inscription des testeurs.
  await expect(page.getByRole("link", { name: /Google Play/ })).toHaveAttribute(
    "href",
    "https://play.google.com/store/apps/details?id=com.dishrank.app",
  );
  await expectNoindex(page);
});

test.describe("lien d’un plat sur ordinateur", () => {
  // Sur un téléphone, le script ouvre l'appli (intent:// sur Android,
  // dishrank:// sur iPhone) : le navigateur de test reste alors bloqué sur
  // cette navigation. Sur ordinateur, il ne fait que poser sa garde.
  test.use({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36",
  });

  test("pas de redirection, une seule tentative par lien", async ({ page }) => {
    await page.goto(`/dish?r=${SEED.proRestaurantId}&d=Burger%20Maestro`);
    await expect(
      page.getByRole("heading", { name: "Voir ce plat sur DishRank" }),
    ).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/dish");
    expect(
      await page.evaluate(() =>
        Object.keys(sessionStorage).some((k) =>
          k.startsWith("dishrank-deeplink:"),
        ),
      ),
    ).toBe(true);
  });
});

test("fiche restaurant partagée : plats et notation", async ({ page }) => {
  const res = await page.goto(`/restaurant/${SEED.proRestaurantId}`);
  expect(res?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { name: SEED.proRestaurantName, level: 1 }),
  ).toBeVisible();
  await expect(page.getByText("Burger Maestro").first()).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Noter/ }).first(),
  ).toBeVisible();
  await expectNoindex(page);
});

test("fiche restaurant inconnue → 404", async ({ page }) => {
  const res = await page.goto(
    "/restaurant/00000000-0000-4000-8000-000000000000",
  );
  expect(res?.status()).toBe(404);
});

test.describe("parrainage (ordinateur)", () => {
  test.use({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0 Safari/537.36",
  });

  test("parrainage : le prénom de qui invite", async ({ page }) => {
    const token = await signIn(SEED.alice);
    const [me] = await userSelect<{ referral_code: string }[]>(
      token,
      `profiles?id=eq.${jwtSub(token)}&select=referral_code`,
    );
    expect(me?.referral_code).toBeTruthy();
    await page.goto(`/join/${me.referral_code}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      /Test Alice t.invite sur DishRank/,
    );
    await expectNoindex(page);
  });

  test("parrainage : code inconnu → page générique ; code invalide → 404", async ({
    page,
  }) => {
    await page.goto("/join/ZZZZZZZZ");
    await expect(page).toHaveTitle("Rejoins DishRank");
    const res = await page.goto("/join/%3Cscript%3E");
    expect(res?.status()).toBe(404);
  });
});

test("invitation de groupe : nom du groupe", async ({ page }) => {
  test.skip(
    !hasServiceRoleKey,
    "Clé secrète DEV absente : le serveur ne peut pas lire l’invitation (lue avec cette clé).",
  );
  await page.goto(`/g/${SEED.groupInviteCode}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    SEED.groupInviteName,
  );
  await expect(page).toHaveTitle(new RegExp(SEED.groupInviteName));
  await expectNoindex(page);
});

test("invitation de groupe : code inconnu", async ({ page }) => {
  await page.goto("/g/INCONNU99");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    hasServiceRoleKey
      ? "Invitation introuvable"
      : /Invitation introuvable|Rejoins le groupe/,
  );
});

test("confirmation d’email : lien sans jeton ou faux jeton", async ({
  page,
}) => {
  await page.goto("/auth/confirm");
  await expect(page).toHaveTitle("Confirmation de ton email — DishRank");
  await expect(page.getByText("Lien invalide ou expiré.")).toBeVisible();
  await expectNoindex(page);

  // Faux jeton : refusé par Supabase (400 de la route, attendu ici).
  errors.length = 0;
  page.removeAllListeners("response");
  await page.goto("/auth/confirm?token_hash=faux-jeton&type=signup");
  await expect(
    page.getByRole("heading", { name: "Lien expiré" }),
  ).toBeVisible();
});
