import { defineConfig, devices } from '@playwright/test';
import { loadDevEnv } from './e2e/env';

/**
 * Tests de bout en bout du site (Playwright), en local contre la base DEV.
 *
 * Le serveur `next dev` est lancé par Playwright avec les clés de la base DEV,
 * lues dans le dépôt de l'appli (../dishrank/.env.development) : jamais la
 * prod (e2e/env.ts refuse l'URL de prod). Les données de test (compte pro,
 * carte publiée, groupe) viennent du seed de l'appli : `npm run e2e:seed` dans
 * le dépôt dishrank avant une série. Voir e2e/README.md.
 */
const dev = loadDevEnv();
const PORT = Number(process.env.E2E_PORT ?? 3100);

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  // Une seule base partagée et des données de seed communes : en série.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'fr-FR',
    timezoneId: 'Europe/Paris',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    // Fonctions pures (sans navigateur ni serveur) : *.unit.spec.ts.
    { name: 'unit', testMatch: /\.unit\.spec\.ts$/ },
    // Routes d'API : requêtes HTTP seules, sans navigateur.
    { name: 'api', testMatch: /[\\/]api\.spec\.ts$/ },
    // Pages publiques (SEO, carte QR, partages, vote de sortie) : sur téléphone,
    // d'où viennent la plupart des visites.
    {
      name: 'mobile',
      testMatch: /[\\/](menu|outing|smoke|seo|pages)\.spec\.ts$/,
      use: { ...devices['Pixel 7'] },
    },
    // L'espace pro se consulte surtout sur ordinateur.
    { name: 'desktop', testMatch: /[\\/](pro|pro-pages)\.spec\.ts$/, use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/pro/login`,
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'pipe',
    env: {
      NEXT_PUBLIC_SUPABASE_URL: dev.url,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: dev.anonKey,
      SUPABASE_URL: dev.url,
      SUPABASE_ANON_KEY: dev.anonKey,
      // Sans la clé secrète DEV (sb_secret_… ou ancienne service_role), le
      // serveur lit avec la clé anon (RLS) : les lectures et écritures
      // réservées au serveur (note sans compte, invitation de groupe) échouent,
      // et les tests qui en dépendent sont sautés (dev.serviceRoleKey absent).
      SUPABASE_SERVICE_ROLE_KEY: dev.serviceRoleKey ?? dev.anonKey,
      NEXT_PUBLIC_SITE_URL: `http://localhost:${PORT}`,
      // Valeur de test, propre à ce serveur local (signe le cookie d'invité).
      GUEST_COOKIE_SECRET: 'e2e-local-only-guest-cookie-secret',
      // Turnstile du menu : clés de TEST publiques de Cloudflare (toujours
      // valides). Le parcours complet est joué : widget, jeton, siteverify.
      NEXT_PUBLIC_TURNSTILE_MENU_SITE_KEY: '1x00000000000000000000AA',
      TURNSTILE_MENU_SECRET_KEY: '1x0000000000000000000000000000000AA',
      // Turnstile pro, Stripe, SMTP, Upstash : non définis → désactivés, comme
      // prévu par le code pour un déploiement sans ces services.
    },
  },
});
