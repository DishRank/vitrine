# Espace Pro — config manuelle requise (dashboards)

> Fichier d'état (lot 0.3 / 1.3 / 1.4 / 4.4 du plan `dishrank/docs/specs/espace-pro-web.md`).
> Toute la config auth/emails vit au dashboard, non versionnée, dupliquée sur les DEUX
> projets (prod `yztbhdvrvgozhyaujtjz`, dev `ddregohrzzewutpfabwf`). Cocher ici à chaque
> action faite, avec la date — c'est la seule trace auditable.

## 1. Vercel — variables d'environnement

Préprod (→ projet **DEV**) et prod (→ **PROD**) :
- [ ] `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (projet cible)
- [ ] `NEXT_PUBLIC_SITE_URL` = `https://dishrank.fr` (prod) / URL préprod — **origine canonique des liens
  email** (jamais dérivée des en-têtes, audit M3) + base des liens de désabonnement
- [ ] `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` = la **vraie clé service-role** du projet
  (⚠️ le `.env.local` de dev porte une clé anon → le cron digest et l'unsubscribe ne marchent
  qu'avec la vraie clé service-role, donc en préprod/prod)
- [ ] `BREVO_API_KEY` (+ `BREVO_SENDER`=`no-reply@dishrank.fr`) — emails owner (digest). Sans elle,
  `sendOwnerEmail` renvoie `skipped` (aucun envoi).
- [ ] `CRON_SECRET` — auth des crons Vercel (indexnow + owner-digest)
- [ ] `PRO_EMAIL_SECRET` — HMAC des liens de désabonnement (fallback `CRON_SECRET` si absent)
- [ ] (optionnel) `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (rate-limit partagé)
- [ ] (optionnel) `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (+ captcha Supabase, cf. §4)

Crons (déjà dans `vercel.json`) : `/api/cron/indexnow` (lundi 06:00) et `/api/cron/owner-digest`
(quotidien 08:00). Vérifier qu'ils apparaissent dans Vercel → Functions → Cron Jobs.

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
- [ ] **Brevo** : sender `no-reply@dishrank.fr` vérifié (déjà le cas pour claim-verify). Le digest owner
  et l'unsubscribe utilisent la même clé.

## 5. Après chaque modif ici

Reporter la date + le projet, et vérifier le flow complet sur la préprod : login email/Google/Apple,
mot de passe oublié (autre navigateur), signup + confirmation, **cron digest** (`GET /api/cron/owner-digest?dry=1`
avec le bearer CRON_SECRET → doit lister les owners), **désabonnement** (lien dans l'email → page « Désabonné »).

## État

| Item | PROD | DEV | Date |
|---|---|---|---|
| Env Vercel (SITE_URL, service key, BREVO, CRON_SECRET, PRO_EMAIL_SECRET) | ❌ | ❌ | — |
| Redirect URLs /pro/callback | ❌ | ❌ | — |
| Google web | ❌ | ❌ | — |
| Apple Services ID | ❌ | ❌ | — |
| Template recovery → token_hash | ❌ | ❌ | — |
| Leaked password protection | ❌ | ❌ | — |
| Crons visibles (indexnow + owner-digest) | ❌ | ❌ | — |
| Préprod Vercel → DEV | — | ❌ | — |

Compte de test DEV (créé le 2026-07-10, email confirmé) :
`pro-test-lot1@dishrank.fr` / `ProTest#2026ok` — possède Nokyo (menu + photo) et La Scène.
