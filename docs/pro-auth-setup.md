# Espace Pro — config manuelle requise (dashboards)

> Fichier d'état (lot 0.3 / 1.3 / 1.4 / 4.4 du plan `dishrank/docs/specs/espace-pro-web.md`).
> Toute la config auth/emails vit au dashboard, non versionnée, dupliquée sur les DEUX
> projets (prod `yztbhdvrvgozhyaujtjz`, dev `ddregohrzzewutpfabwf`). Cocher ici à chaque
> action faite, avec la date — c'est la seule trace auditable.

## 1. Vercel — variables d'environnement

> 🎯 **Tout est gratuit** : le code réutilise les variables DÉJÀ posées sur le projet
> (SMTP OVH, `INDEXNOW_TRIGGER_SECRET`) — rien de nouveau à ajouter pour l'espace pro.
> Pas de Brevo/SendGrid, pas de Vercel Cron payant, pas de Redis (cf. notes ci-dessous).

Déjà présentes et réutilisées telles quelles (préprod → **DEV**, prod → **PROD**) :
- [x] `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (projet cible)
- [x] `NEXT_PUBLIC_SITE_URL` = `https://dishrank.fr` (prod) / URL préprod — **origine canonique des liens
  email** (jamais dérivée des en-têtes, audit M3) + base des liens de désabonnement
- [x] `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` = la **vraie clé service-role** du projet
  (⚠️ le `.env.local` de dev porte une clé anon → le digest et l'unsubscribe ne marchent
  qu'avec la vraie clé service-role, donc en préprod/prod)
- [x] `SMTP_HOST` / `SMTP_PORT` / `SMTP_USERNAME` / `SMTP_PASSWORD` (+ `SMTP_SENDER_NAME`, `SMTP_FROM`
  optionnel → défaut `SMTP_USERNAME`) — **mêmes variables que `support-ticket`**. Le digest owner
  passe par ce relais SMTP OVH. Sans elles → `sendOwnerEmail` renvoie `skipped` (aucun envoi).
- [x] `INDEXNOW_TRIGGER_SECRET` — réutilisé comme **secret HMAC** des liens de désabonnement
  (`PRO_EMAIL_SECRET` reste prioritaire si un jour on veut l'isoler) **et** comme bearer accepté
  pour un déclenchement manuel du digest.

Optionnel (pas nécessaire au lancement) :
- [ ] `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` — rate-limit partagé multi-instances.
  **Sans Redis, le rate-limit tombe en mémoire (par instance)** : gratuit et suffisant au démarrage,
  à ajouter seulement avant un vrai trafic public.
- [ ] `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (+ captcha Supabase, cf. §4)

**Cron du digest → `pg_cron` (Supabase), pas Vercel Cron.** Le seul cron Vercel restant dans
`vercel.json` est `/api/cron/indexnow` (lundi 06:00). Le digest owner est planifié côté base par
`pg_cron` + `pg_net` (job `owner-review-digest`, quotidien 08:00 UTC, migration 106) qui appelle
`POST /api/cron/owner-digest` avec un secret stocké en base (`app_internal_config`) — **0 config
Vercel, 0 coût**. Déjà planifié en PROD. Pour (re)planifier/désactiver :
`SELECT public.ensure_owner_digest_cron();` / `SELECT cron.unschedule('owner-review-digest');`.

## 2. Supabase Auth → URL Configuration (×2 projets)

- [ ] **Site URL** : `https://dishrank.fr` (prod) / URL préprod (dev)
- [ ] **Redirect URLs** — ajouter :
  - `https://dishrank.fr/pro/callback` (prod) / `https://<préprod>.vercel.app/pro/callback` (dev)
  - `http://localhost:3000/pro/callback` (dev uniquement, tests locaux)

## 3. Providers OAuth WEB (×2 projets) — sans ça, les owners « Hide My Email » ne peuvent PAS se connecter

- [ ] **Google** : redirect URIs `https://<ref>.supabase.co/auth/v1/callback` + provider actif.
- [ ] **Apple** : créer un **Services ID** (≠ App ID natif) sur developer.apple.com, domaine
  `dishrank.fr` + return URL `https://<ref>.supabase.co/auth/v1/callback`, clé `.p8` + team/key ID,
  renseigner le provider Apple (section « Web »). Pour PROD et DEV.

## 4. Emails / templates (×2 projets)

- [ ] **Template Reset Password** → pointer sur le callback web avec token_hash (robuste cross-navigateur) :
  ```html
  <a href="{{ .SiteURL }}/pro/callback?token_hash={{ .TokenHash }}&type=recovery&next=/pro/reset/update">
    Choisir un nouveau mot de passe
  </a>
  ```
- [ ] **Attack protection** : activer *Leaked password protection* et, si Turnstile, *Captcha protection*.
- [x] **Emails owner** : SMTP OVH (`support-ticket`), expéditeur `SMTP_SENDER_NAME <SMTP_USERNAME>`
  (= `contact@dishrank.fr`). Rien à configurer de plus — Brevo n'est PAS utilisé côté vitrine.

## 5. Après chaque modif ici

Reporter la date + le projet, et vérifier le flow complet sur la préprod : login email/Google/Apple,
mot de passe oublié (autre navigateur), signup + confirmation, **digest** (`GET /api/cron/owner-digest?dry=1`
avec le bearer `INDEXNOW_TRIGGER_SECRET` → doit lister les owners), **désabonnement** (lien dans
l'email → page « Désabonné »).

## État

| Item | PROD | DEV | Date |
|---|---|---|---|
| Env Vercel (SITE_URL, service key, SMTP, INDEXNOW_TRIGGER_SECRET) — déjà posées | ✅ | ✅ | 2026-07-13 |
| Migration 106 (secret DB + pg_cron digest) | ✅ | ⬜ (à jouer côté dev) | 2026-07-13 |
| Job pg_cron `owner-review-digest` planifié (`ensure_owner_digest_cron()`) | ✅ | — (prod only) | 2026-07-13 |
| Redirect URLs /pro/callback | ❌ | ❌ | — |
| Google web | ❌ | ❌ | — |
| Apple Services ID | ❌ | ❌ | — |
| Template recovery → token_hash | ❌ | ❌ | — |
| Leaked password protection | ❌ | ❌ | — |
| Cron Vercel visible (indexnow seul) | ❌ | ❌ | — |
| Préprod Vercel → DEV | — | ❌ | — |

Compte de test DEV (créé le 2026-07-10, email confirmé) :
`pro-test-lot1@dishrank.fr` / `ProTest#2026ok` — possède Nokyo (menu + photo) et La Scène.
