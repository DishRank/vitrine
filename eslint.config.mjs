import coreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

/**
 * Flat ESLint 9 config.
 *
 * La vitrine n'a jamais été lintée : `next lint` a disparu dans Next 16 et
 * ESLint n'était même pas installé, donc le script `lint` échouait en silence
 * depuis la migration. On repart des configs officielles Next, qui couvrent
 * React, les hooks et les règles propres au framework (liens, images, polices).
 *
 * `eslint-config-next` 16 exporte du flat NATIF : on importe ses sous-chemins
 * directement. Ne pas passer par `FlatCompat` — la conversion échoue sur une
 * structure circulaire (le plugin react se référence lui-même).
 *
 * Même parti pris que l'app mobile : un filet utile plutôt que la sévérité
 * maximale. Les règles bloquantes portent sur la correction ; ce qui relève
 * d'une dette pré-existante est signalé en `warn` pour ne pas transformer la
 * mise en place du lint en chantier de refonte.
 */
export default [
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'next-env.d.ts',
      'public/**',
      'scripts/**',
      '*.config.mjs',
      '*.config.ts',
    ],
  },
  ...coreWebVitals,
  ...nextTypescript,
  {
    rules: {
      // ── Faux positif ──────────────────────────────────────────────────────
      // Hérité du Pages Router : la règle réclame `next/head`, précisément
      // déprécié en App Router. `MenuBridge` rend une page AUTONOME (route menu
      // sans layout) avec ses propres <html>/<head> — c'est la bonne façon de
      // faire ici, la règle n'a pas lieu d'être.
      '@next/next/no-head-element': 'off',

      // ── Dettes signalées, non bloquantes ──────────────────────────────────
      // 78 occurrences : des <a href="/…"> internes au lieu de <Link>. La règle
      // a raison sur le fond (on perd la navigation client et le préchargement),
      // mais les convertir est un refactor de navigation à part entière —
      // certains liens portent un onClick (scrollToTop du footer). En `warn` le
      // temps de traiter ça proprement, pas en bloquant la CI dès le jour 1.
      '@next/next/no-html-link-for-pages': 'warn',

      // Règles du React Compiler (nouvelles dans eslint-config-next 16). Elles
      // pointent des optimisations de rendu, pas des bugs : le code tourne en
      // production. `setState` dans un effet est notamment le motif standard
      // d'hydratation SSR (`mounted`). À traiter lors d'une passe perf React.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/immutability': 'warn',

      // `any` massivement présent sur les lignes Supabase non typées et les
      // payloads OSM : relève d'une passe de typage à part.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
];
