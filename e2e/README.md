# Tests de bout en bout du site (Playwright)

Ils lancent `next dev` en local **contre la base DEV** (jamais la prod :
`e2e/env.ts` refuse l'URL de prod) et pilotent Chromium.

| Fichier | Projet | Ce qui est testé |
|---|---|---|
| `googleMatch.unit.spec.ts` | `unit` | contrôle de correspondance Google (`src/lib/googleMatch.ts`) : nom + distance ; un autre lieu ne donne jamais sa note à une fiche |
| `api.spec.ts` | `api` | routes d'API : tâches planifiées et IndexNow refusées sans secret ; webhook Stripe non signé jamais traité ; `/api/revalidate-menu` (publique par choix, identifiant validé) ; `/api/csp-report` (rapport accepté, JSON invalide 400, trop gros 413) ; routes appelées par l'appli (Google, OSM, ticket de support) refusées sans jeton ou avec un jeton forgé, entrées validées avec une session ; routes `/api/pro/*` refusées sans session propriétaire ; désinscription des emails avec jeton invalide ; note sans compte et confirmation d'email invalides |
| `smoke.spec.ts` | `mobile` | accueil, page de connexion pro, carte d'un resto inconnu (404) |
| `seo.spec.ts` | `mobile` | pages indexées (accueil, ville, ville + catégorie, catégorie, restaurant pris dans le sitemap, prix à Lyon, version anglaise) : statut, titre, canonique, hreflang, robots, contenu, **aucune erreur dans la page** ; adresses inconnues en 404 non indexées (sans consigne robots contradictoire) ; anciennes adresses redirigées ; `robots.txt` et sitemap sans page privée |
| `pages.spec.ts` | `mobile` | lien d'un plat (`/dish`, deux stores, une seule tentative d'ouverture de l'appli), fiche restaurant partagée (`/restaurant/<id>`, 404 si inconnue), parrainage (`/join/<code>`), invitation de groupe (`/g/<code>`), confirmation d'email (`/auth/confirm`) ; toutes hors index |
| `menu.spec.ts` | `mobile` | carte publiée (`/menu/<id>`) ; note d'un plat **sans compte** |
| `outing.spec.ts` | `mobile` | vote d'une sortie **sans compte** (`/s/<jeton>`), vu par le groupe ; lien inconnu (404) |
| `pro.spec.ts` | `desktop` | connexion pro + **double authentification** : espace fermé avant le code, faux code refusé, bon code → tableau de bord ; mauvais mot de passe ; réponse à un avis ; plat ajouté visible sur la carte publique |
| `pro-pages.spec.ts` | `desktop` | espace pro page par page : présentation `/pro` (seule page indexable), pages de compte hors index, garde d'accès (retour à la page demandée après connexion), inscription (mot de passe trop faible), mot de passe oublié et lien magique (même réponse que le compte existe ou non), tableau des allergènes (lien invalide ; lien valide créé puis effacé) ; connecté : connexion journalisée après le code, accueil, `/pro/r` sans établissement, fiche (enregistrement automatique puis remise), apparence (ambiance changée puis remise), partage (lien + QR téléchargé), statistiques, abonnement (paiement fermé), notifications marquées lues, mon compte (rappels par email), revendication (déjà pris / à choisir), déconnexion |

Les tests qui modifient des données les remettent comme avant (fiche,
apparence, préférence email, invitation allergènes). Les formulaires plafonnés
par IP et par adresse (mot de passe oublié, lien magique) envoient à chaque
passage une IP de test (`x-real-ip`) et une adresse sans compte : aucun email
n'est envoyé.

## Lancer

1. Base DEV à jour et seedée, depuis le dépôt de l'appli :
   ```powershell
   cd ..\dishrank
   npm run e2e:seed      # comptes, resto pro + carte, groupe, secret 2FA du compte pro
   ```
2. Depuis ce dépôt :
   ```powershell
   npm run test:e2e                       # tous les tests (démarre next dev sur le port 3100)
   npx playwright test --project=api      # un seul projet (unit, api, mobile, desktop)
   npx playwright show-report             # rapport HTML, traces des échecs
   ```

La config DEV (URL + clé anon) est lue dans `../dishrank/.env.development`
(autre emplacement : variable `DISHRANK_APP_DIR`). Le secret 2FA du compte pro
est lu dans `../dishrank/e2e/maestro/setup/.pro-mfa-secret` (créé par le seed).

**Clé secrète DEV** : le serveur s'en sert pour écrire la note sans compte et
lire les invitations de groupe ; les tests, pour vérifier en base et créer
puis effacer leurs données. Mets-la dans `.env.test.local` (ignoré par git) :

```
SUPABASE_SERVICE_ROLE_KEY_DEV=sb_secret_…
```

Tableau de bord Supabase du projet DEV → Settings → API Keys → « Secret
keys » (l'ancienne clé `service_role` marche aussi). La clé **publishable**
(`sb_publishable_…`) ne convient pas : elle est ignorée, avec un avertissement.
Sans clé secrète, les tests qui en dépendent sont sautés (les autres tournent
avec la clé anon).

Turnstile, Stripe, SMTP, Upstash et la clé Google ne sont pas configurés en
local : le code les désactive (ou refuse, pour Google), comme prévu pour un
déploiement sans ces services.

Si le serveur de développement se met à recharger la page en boucle après une
modification de code pendant qu'il tourne, l'arrêter et relancer les tests
(Playwright en démarre un neuf).