# DishRank — Vitrine Web

Site vitrine de DishRank. Version web de l'app mobile avec SSR, i18n et SEO.

## Stack

- **Next.js 16** (App Router, SSR)
- **TypeScript**
- **Tailwind CSS v4**
- **next-intl** (i18n : FR, EN, ES, DE, IT)
- **Supabase** (donnees en temps reel)

## Setup

```bash
npm install
cp .env.example .env.local
# Remplir avec les vraies valeurs Supabase
npm run dev
```

### Variables d'environnement

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL du projet Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cle anon (publique, protegee par RLS) |

## Architecture

```
src/
├── app/
│   ├── [locale]/
│   │   ├── layout.tsx      # Layout i18n, fonts, dark mode
│   │   └── page.tsx        # Page principale SSR
│   ├── dish/
│   │   └── page.tsx        # Deep link partage de plats
│   ├── globals.css         # Tailwind + CSS vars themes
│   ├── sitemap.ts          # Sitemap auto (categories x villes)
│   └── robots.ts
├── components/
│   ├── Nav.tsx             # Navbar sticky avec blur
│   ├── Hero.tsx            # Hero traduit
│   ├── SearchSection.tsx   # Recherche + ville + chips categories
│   ├── DishGrid.tsx        # Grille de plats (donnees SSR)
│   ├── WhySection.tsx      # 6 arguments cles
│   ├── ExploreCategories.tsx  # Emojis parallax au scroll
│   ├── Showcase.tsx        # Slideshow 8 ecrans avec autoplay
│   ├── CtaBanner.tsx       # CTA telechargement
│   ├── Footer.tsx          # Footer + liens legaux
│   ├── LegalSheet.tsx      # Bottom sheet RGPD (privacy, CGU, suppression)
│   └── DishModal.tsx       # Modal detail plat (placeholder)
├── i18n/
│   ├── config.ts           # Locales supportees
│   ├── request.ts          # Chargement des messages
│   └── routing.ts          # Routing i18n (prefix as-needed)
├── lib/
│   └── supabase.ts         # Client Supabase + cache serveur + types
├── messages/
│   ├── fr.json             # Francais (defaut)
│   ├── en.json             # Anglais
│   ├── es.json             # Espagnol
│   ├── de.json             # Allemand
│   └── it.json             # Italien
└── proxy.ts                # Rate limiting + anti-scraping + i18n (Next 16 proxy)
```

## SEO

### SSR

Les donnees Supabase (plats, categories, avis) sont fetchees **server-side**. Le HTML envoye a Google contient deja les vrais plats avec notes, prix, restaurants.

### Meta dynamiques

Le titre et la description changent selon les query params :

| URL | Titre |
|---|---|
| `/?categorie=burger&ville=Lyon` | Meilleur burger de Lyon — DishRank |
| `/?categorie=sushi` | Meilleur sushi — DishRank |
| `/?ville=Paris` | Meilleurs plats de Paris — DishRank |
| `/en/?categorie=pizza&ville=Lyon` | Best pizza in Lyon — DishRank |

### hreflang

Chaque page genere automatiquement les balises `hreflang` pour les 5 langues + `x-default`. Google sait que la meme page existe en FR, EN, ES, DE, IT.

### Sitemap

Genere automatiquement dans `/sitemap.xml` :
- Page principale
- Pages RGPD
- 50 categories les plus populaires
- Top categories x 10 villes (140 URLs)
- 10 pages par ville

## i18n

Detection automatique de la langue du navigateur via le header `Accept-Language`.

| Langue | URL | Comportement |
|---|---|---|
| Francais (defaut) | `dishrank.fr/` | Pas de prefix |
| Anglais | `dishrank.fr/en/` | Prefix `/en` |
| Espagnol | `dishrank.fr/es/` | Prefix `/es` |
| Allemand | `dishrank.fr/de/` | Prefix `/de` |
| Italien | `dishrank.fr/it/` | Prefix `/it` |

Config : `localePrefix: 'as-needed'` — le prefix n'apparait que pour les langues non-default.

## Securite

### Headers HTTP

Configures dans `next.config.ts` :
- `Content-Security-Policy` (bloque XSS, injection)
- `X-Frame-Options: DENY` (anti-clickjacking)
- `X-Content-Type-Options: nosniff`
- `Strict-Transport-Security` (force HTTPS, 2 ans)
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` (desactive camera/micro)

### Rate limiting

Dans `proxy.ts` : 60 requetes/minute par IP. Au-dela, reponse 429.

### Anti-scraping

Blocage des user-agents connus (Scrapy, python-requests, wget, curl, HTTrack...).

### Cache serveur

Les appels Supabase sont caches en memoire :
- Plats : 5 minutes
- Categories : 30 minutes

Evite de marteler la DB et protege contre les attaques par repetition.

### Supabase

- Seule la **cle anon** est utilisee (publique par design)
- **RLS active** sur toutes les tables : seules les lectures publiques sont autorisees
- Aucune operation d'ecriture depuis la vitrine

## Routes speciales

### Deep links (`/dish`)

L'app mobile partage des plats via `dishrank.fr/dish?r=RESTAURANT_ID&d=DISH_NAME`.
La page tente d'ouvrir l'app native (`dishrank://dish?...`), sinon propose le Play Store.

### `.well-known`

- `/.well-known/assetlinks.json` — Android App Links
- `/.well-known/apple-app-site-association` — iOS Universal Links

### RGPD (Play Store)

Les URLs utilisees dans le Play Store redirigent vers la page principale avec le bottom sheet :

| URL Play Store | Redirection |
|---|---|
| `/privacy` | `/?page=privacy` |
| `/terms` | `/?page=terms` |
| `/delete-account` | `/?page=delete` |
| `/legal` | `/?page=privacy` |

## Themes

Detection automatique du theme systeme via `prefers-color-scheme`. Le favicon s'adapte aussi (logo sombre en light, logo clair en dark).

Variables CSS dans `globals.css` : `:root` (light) et `.dark` (dark).

## Deploiement

### Vercel (recommande)

```bash
npm i -g vercel
vercel login
vercel
```

Ajouter les env vars dans le dashboard Vercel :
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Pointer le domaine `dishrank.fr` vers Vercel (CNAME).

### Vercel

Vercel supporte Next.js SSR nativement. Meme process, ajouter les env vars dans le dashboard.

## Scripts

| Commande | Description |
|---|---|
| `npm run dev` | Serveur de dev (localhost:3000) |
| `npm run build` | Build production |
| `npm run start` | Serveur production |
| `npm run lint` | Lint ESLint |
