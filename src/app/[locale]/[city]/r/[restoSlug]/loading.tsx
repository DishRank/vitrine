import Nav from '@/components/Nav';
import Footer from '@/components/Footer';
import M3Spinner from '@/components/M3Spinner';

/**
 * Loading UI pour la route `/[locale]/[city]/r/[restoSlug]`.
 *
 * Next.js wrappe `page.tsx` dans un `<Suspense>` et affiche ce composant
 * INSTANTANÉMENT au moment du `Link` click, avant même que la requête SSR
 * ne démarre. Le user voit donc une transition fluide :
 *   click → Nav + spinner immédiat → swap avec le contenu réel quand prêt
 *
 * Sans ce fichier, le browser reste sur l'ancienne page pendant que SSR
 * tourne (~300ms-1.3s sur cold cache Supabase) — sensation de freeze.
 *
 * On garde Nav + Footer dans le loading pour que la chrome de l'app reste
 * stable (pas de "blink"), seul le contenu central est remplacé par le
 * spinner + skeleton.
 */
export default function RestaurantLoading() {
  return (
    <>
      <Nav />
      <main
        id="main-content"
        className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4 py-24"
      >
        {/* Glow violet — match le hero pour cohérence visuelle */}
        <div
          className="absolute top-[80px] left-1/2 -translate-x-1/2 rounded-full pointer-events-none"
          style={{
            width: 'min(700px, 100vw)',
            height: 'min(400px, 50vw)',
            background: 'radial-gradient(closest-side, rgba(124,108,247,0.18), transparent 70%)',
            filter: 'blur(40px)',
          }}
          aria-hidden="true"
        />

        <div className="relative z-10 flex flex-col items-center">
          <M3Spinner size={56} />
          <p className="mt-7 text-sm text-[var(--text2)] font-medium tracking-wide">
            Chargement du restaurant…
          </p>

          {/* Skeleton blocks discrets pour suggérer la structure de la page
              qui va apparaître. Pulse léger pour montrer l'activité. */}
          <div className="mt-10 w-full max-w-md flex flex-col items-center gap-3 opacity-60">
            <div className="h-8 w-3/4 rounded-md bg-[var(--surface-var)] animate-pulse" />
            <div className="h-4 w-1/2 rounded-md bg-[var(--surface-var)] animate-pulse" style={{ animationDelay: '0.15s' }} />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
