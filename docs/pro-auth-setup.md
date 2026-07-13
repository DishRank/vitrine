# Espace Pro — config manuelle requise (dashboards)

> Fichier d'état (lot 0.3 / 1.3 / 1.4 du plan `dishrank/docs/specs/espace-pro-web.md`).
> Toute la config auth vit au dashboard Supabase, non versionnée, dupliquée sur les DEUX
> projets (prod `yztbhdvrvgozhyaujtjz`, dev `ddregohrzzewutpfabwf`). Cocher ici à chaque
> action faite, avec la date — c'est la seule trace auditable.

## 1. Vercel — préprod (lot 0.4, BLOQUANT pour tester /pro hors local)

- [ ] Créer un déploiement Vercel séparé (ou environnement Preview dédié) pointant le projet **DEV** :
  - `NEXT_PUBLIC_SUPABASE_URL` = `https://ddregohrzzewutpfabwf.supabase.co`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon dev
  - `SUPABASE_URL(_DEV)` / `SUPABASE_SERVICE_ROLE_KEY(_DEV)` selon les routes utilisées
  - `NEXT_PUBLIC_SITE_URL` = `https://dishrank.fr` (prod) / URL de la préprod — origine
    CANONIQUE des liens envoyés par email (jamais dérivée des en-têtes, audit M3)
  - (optionnel) `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (rate-limit partagé)
  - (optionnel) `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (+ activer le captcha côté Supabase, cf. §4)

## 2. Supabase Auth → URL Configuration (×2 projets)

- [ ] **Site URL** : `https://dishrank.fr` (prod) / URL de la préprod (dev)
- [ ] **Redirect URLs** — ajouter :
  - `https://dishrank.fr/pro/callback` (prod) / `https://<préprod>.vercel.app/pro/callback` (dev)
  - `http://localhost:3000/pro/callback` (dev uniquement, tests locaux)

## 3. Providers OAuth WEB (×2 projets) — sans ça, les owners « Hide My Email » ne peuvent PAS se connecter

- [ ] **Google** : dans la console Google Cloud du client OAuth existant, ajouter les
  redirect URIs `https://<ref>.supabase.co/auth/v1/callback` (déjà présents si le natif
  passe par signInWithOAuth) et vérifier que le provider est actif côté Supabase.
- [ ] **Apple** : créer un **Services ID** (≠ App ID natif) sur developer.apple.com,
  domaine `dishrank.fr` + return URL `https://<ref>.supabase.co/auth/v1/callback`,
  générer la clé `.p8` + team ID + key ID, renseigner le provider Apple du dashboard
  Supabase (section « Web »). À faire pour PROD et DEV.

## 4. Emails / templates (×2 projets)

- [ ] **Template Reset Password** → pointer sur le callback web avec token_hash
  (flow robuste même si le lien est ouvert dans un AUTRE navigateur que la demande) :
  ```html
  <a href="{{ .SiteURL }}/pro/callback?token_hash={{ .TokenHash }}&type=recovery&next=/pro/reset/update">
    Choisir un nouveau mot de passe
  </a>
  ```
- [ ] **Template Confirm signup** : conserve le flux actuel (`/auth/confirm`, orienté app).
  Optionnel plus tard : router les signups pro vers `/pro/callback?token_hash={{ .TokenHash }}&type=signup&next=/pro`.
- [ ] **Attack protection** : activer *Leaked password protection* (en attente depuis
  l'audit) et, si Turnstile retenu, *Captcha protection* avec la secret key Cloudflare.

## 5. Après chaque modif ici

Reporter la date + le projet dans ce fichier, et vérifier le flow complet sur la préprod :
login email, login Google, login Apple, mot de passe oublié (lien ouvert dans un autre
navigateur), signup + confirmation.

## État

| Item | PROD | DEV | Date |
|---|---|---|---|
| Redirect URLs /pro/callback | ❌ | ❌ | — |
| Google web | ❌ | ❌ | — |
| Apple Services ID | ❌ | ❌ | — |
| Template recovery → token_hash | ❌ | ❌ | — |
| Leaked password protection | ❌ | ❌ | — |
| Préprod Vercel → DEV | — | ❌ | — |

Compte de test DEV (créé le 2026-07-10, email confirmé via SQL) :
`pro-test-lot1@dishrank.fr` / `ProTest#2026ok` — aucun resto possédé.
