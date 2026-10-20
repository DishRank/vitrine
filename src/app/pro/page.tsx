import Link from 'next/link';
import { headers } from 'next/headers';
import type { Metadata } from 'next';
import { getSupabaseServer } from '@/lib/pro/supabaseServer';
import ProLandingHeader from './_components/ProLandingHeader';

const SITE = 'https://dishrank.fr';
// Image OG/Twitter partagée avec le site (identité DishRank, 1024×500) — évite
// un aperçu social/IA sans visuel. Une image dédiée « Pro » pourra la remplacer.
const OG_IMAGE = `${SITE}/img/play_store_feature_graphic-v2.webp`;
const TITLE = 'DishRank Pro — Gérez votre établissement';
const DESCRIPTION =
  'Fiche, menu numérique avec QR de table, allergènes par plat et réponse aux avis clients, réunis dans un seul espace. Gratuit, sans carte bancaire.';

/**
 * Landing PUBLIQUE de présentation de l'offre restaurateur (segment /pro).
 *
 * Le double rôle historique de /pro a été scindé : cette page est désormais la
 * vitrine publique, l'accueil connecté du tableau de bord vit sur /pro/espace
 * (cf. proxy.ts + les redirections post-login). Identité « DishRank Pro »
 * (police Inter + thème pro du layout) volontairement distincte du site grand
 * public → séparation nette utilisateur / restaurateur.
 *
 * SEO : SEULE page indexable de la zone (le layout impose noindex à tout le
 * reste, le middleware pose X-Robots-Tag: index uniquement ici). On surcharge
 * donc `robots` + canonical + OpenGraph.
 */
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  robots: { index: true, follow: true },
  alternates: { canonical: `${SITE}/pro` },
  openGraph: {
    type: 'website',
    url: `${SITE}/pro`,
    siteName: 'DishRank Pro',
    title: TITLE,
    description: DESCRIPTION,
    locale: 'fr_FR',
    images: [{ url: OG_IMAGE, width: 1024, height: 500 }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
};

const featColor = (c: string) => ({ ['--feat-color']: c } as React.CSSProperties);

// Bénéfices — alignés sur la frontière gratuit/premium (le gratuit couvre la
// parité menu + photos + réponse aux avis ; le premium = analytics/thème/etc.).
const BENEFITS = [
  {
    emoji: '🥜',
    color: 'var(--primary)',
    title: 'Allergènes par plat',
    body: 'Indiquez les 14 allergènes de chaque plat : vos clients filtrent « sans gluten », « sans lait »… directement sur votre carte.',
    tag: 'Gratuit',
  },
  {
    emoji: '📱',
    color: '#E0A617',
    title: 'Menu numérique & QR de table',
    body: 'Un QR sur chaque table ouvre votre carte, toujours à jour. Un plat épuisé se masque en un tap. Photos incluses.',
    tag: 'Gratuit',
  },
  {
    emoji: '💬',
    color: '#5fd39a',
    title: 'Répondez aux avis',
    body: 'Chaque avis client est une occasion de montrer que vous écoutez. Réponse publique incluse.',
    tag: 'Gratuit',
  },
  {
    emoji: '🔄',
    color: '#ff7a3d',
    title: 'Allergènes à jour',
    body: 'Quand votre carte change, nous la relevons et vous validez : allergènes et carte QR suivent, traduits en 5 langues.',
    tag: 'Premium',
  },
];

const STEPS = [
  {
    n: '1',
    title: 'Revendiquez',
    body: 'Prouvez que l’établissement est le vôtre en quelques minutes (code envoyé par email).',
  },
  {
    n: '2',
    title: 'Personnalisez',
    body: 'Complétez votre fiche, montez votre menu, ajoutez vos photos et votre logo.',
  },
  {
    n: '3',
    title: 'Recevez',
    body: 'Imprimez votre QR de table, recevez les avis de vos clients et suivez vos statistiques.',
  },
];

// Détail Premium — mêmes intitulés que l'écran d'abonnement (AbonnementPanel).
const PREMIUM_FEATURES = [
  'Allergènes à jour : quand votre carte change, nous la relevons, vous validez',
  'Carte et allergènes traduits automatiquement (5 langues)',
  'Statistiques & alertes de la fiche',
  'Thème du menu, réponse épinglée, 5 plats signature, logo au centre du QR',
];

export default async function ProLandingPage() {
  const supabase = await getSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  const authed = !!user;
  const nonce = (await headers()).get('x-nonce') || undefined;

  const primaryHref = authed ? '/pro/espace' : '/pro/claim';
  const primaryLabel = authed ? 'Accéder à mon espace' : 'Revendiquer mon établissement';

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: 'DishRank Pro',
    serviceType: 'Gestion de présence pour restaurateurs',
    provider: { '@type': 'Organization', name: 'DishRank', url: SITE },
    areaServed: 'FR',
    url: `${SITE}/pro`,
    description: DESCRIPTION,
  };

  return (
    <>
      <script
        type="application/ld+json"
        nonce={nonce}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <ProLandingHeader authed={authed} />

      <main id="main-content">
        {/* ── Hero ── */}
        <section className="mx-auto max-w-[1280px] px-4 py-16 text-center sm:px-8 sm:py-24 lg:px-14">
          <span className="inline-flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[1.8px] text-[var(--primary)]">
            <span className="h-px w-[clamp(16px,4vw,24px)] bg-[var(--primary)] opacity-40" />
            Espace restaurateur
            <span className="h-px w-[clamp(16px,4vw,24px)] bg-[var(--primary)] opacity-40" />
          </span>

          <h1
            className="mx-auto mt-5 max-w-4xl font-extrabold tracking-tight"
            style={{ fontSize: 'clamp(2.25rem, 6vw, 4rem)', lineHeight: 1.02 }}
          >
            Votre établissement,
            <br className="hidden sm:block" />{' '}
            <span className="hero-gradient-text">piloté au plat près.</span>
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-[17px] leading-relaxed text-[var(--text2)]">
            DishRank Pro réunit votre fiche, votre carte avec ses allergènes, le QR de table et
            les avis de vos clients dans un seul espace. Simple, en français, pensé pour le service.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href={primaryHref}
              className="cta-shadow inline-flex items-center gap-2 rounded-full bg-[var(--primary)] px-7 py-3.5 text-base font-bold text-white hover:bg-[var(--primary-light)]"
            >
              {primaryLabel}
            </Link>
            {!authed ? (
              <Link
                href="/pro/login"
                className="inline-flex items-center gap-2 rounded-full border border-[var(--border2)] px-7 py-3.5 text-base font-semibold text-[var(--text)] transition-colors hover:border-[var(--primary)]"
              >
                Se connecter
              </Link>
            ) : null}
          </div>

          <p className="mt-5 text-sm font-semibold text-[var(--accent-success)]">
            Gratuit, sans carte bancaire. Premium à 19,99 €/mois, sans engagement.
          </p>
        </section>

        {/* ── Bénéfices ── */}
        <section id="fonctionnalites" className="mx-auto max-w-[1280px] px-4 py-8 sm:px-8 sm:py-12 lg:px-14">
          <h2
            className="text-center font-extrabold tracking-tight"
            style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)' }}
          >
            Tout ce qu’il faut pour rayonner
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-[15px] text-[var(--text2)]">
            L’essentiel est gratuit. Le Premium garde vos allergènes à jour et traduit votre carte.
          </p>

          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {BENEFITS.map((b) => (
              <div
                key={b.title}
                className="feature-card surface-card p-5"
                style={featColor(b.color)}
              >
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-xl text-xl"
                  style={{ backgroundColor: `color-mix(in srgb, ${b.color} 14%, transparent)` }}
                >
                  <span aria-hidden>{b.emoji}</span>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <h3 className="text-[15px] font-extrabold tracking-tight">{b.title}</h3>
                </div>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--text2)]">{b.body}</p>
                <span
                  className={
                    'mt-3 inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold ' +
                    (b.tag === 'Premium'
                      ? 'bg-[var(--primary-container)] text-[var(--primary)]'
                      : 'bg-[color-mix(in_srgb,var(--accent-success)_16%,transparent)] text-[var(--accent-success)]')
                  }
                >
                  {b.tag}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Comment ça marche ── */}
        <section className="mx-auto max-w-[1280px] px-4 py-12 sm:px-8 sm:py-16 lg:px-14">
          <h2
            className="text-center font-extrabold tracking-tight"
            style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)' }}
          >
            Commencez en trois étapes
          </h2>
          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="surface-card p-6">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--primary-container)] text-base font-extrabold text-[var(--primary)]">
                  {s.n}
                </div>
                <h3 className="mt-4 text-lg font-extrabold tracking-tight">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[var(--text2)]">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Offre de lancement ── */}
        <section className="mx-auto max-w-[1200px] px-4 py-12 sm:px-8 sm:py-16">
          <div className="surface-card overflow-hidden p-8 sm:p-12">
            <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-2">
              <div>
                <h2
                  className="font-extrabold tracking-tight"
                  style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)' }}
                >
                  L’essentiel reste gratuit
                </h2>
                <p className="mt-3 max-w-md text-[15px] leading-relaxed text-[var(--text2)]">
                  Fiche, menu numérique, QR de table, allergènes par plat et réponse aux avis :
                  gratuits, sans carte bancaire ni limite de durée. Le Premium (19,99 €/mois, sans
                  engagement) tient vos allergènes à jour quand votre carte change et traduit votre
                  carte en 5 langues.
                </p>
                <Link
                  href={primaryHref}
                  className="cta-shadow mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--primary)] px-6 py-3 text-[15px] font-bold text-white hover:bg-[var(--primary-light)]"
                >
                  {primaryLabel}
                </Link>
              </div>

              <div>
                <p className="mb-3 font-bold text-[var(--text)]">Avec le Premium, 19,99 €/mois</p>
                <ul className="space-y-2.5">
                  {PREMIUM_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2.5 text-[15px] text-[var(--text)]">
                    <span className="mt-0.5 font-extrabold text-[var(--primary)]" aria-hidden>
                      ✓
                    </span>
                    <span>{f}</span>
                  </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ── Séparation utilisateur / restaurateur ── */}
        <section className="mx-auto max-w-[1200px] px-4 pb-4 sm:px-8">
          <p className="text-center text-sm text-[var(--text3)]">
            Vous cherchez l’appli pour noter des plats et sortir entre amis ?{' '}
            <Link href="/" className="font-semibold text-[var(--text2)] underline hover:text-[var(--text)]">
              C’est par ici
            </Link>
            .
          </p>
        </section>
      </main>

      {/* ── Footer slim (pas le footer grand public, pour ne pas rebrouiller la
           séparation avec villes/catégories) ── */}
      <footer className="mt-8 border-t border-[var(--border2)]">
        <div className="mx-auto flex max-w-[1280px] flex-col items-center justify-between gap-3 px-4 py-8 text-sm text-[var(--text3)] sm:flex-row sm:px-8 lg:px-14">
          <span>© {new Date().getFullYear()} DishRank Pro</span>
          <nav className="flex items-center gap-5">
            <Link href="/pro/login" className="footer-link hover:text-[var(--text2)]">
              Se connecter
            </Link>
            <Link href="/?page=terms" className="footer-link hover:text-[var(--text2)]">
              Conditions
            </Link>
            <Link href="/?page=privacy" className="footer-link hover:text-[var(--text2)]">
              Confidentialité
            </Link>
            <Link href="/" className="footer-link hover:text-[var(--text2)]">
              Site DishRank
            </Link>
          </nav>
        </div>
      </footer>
    </>
  );
}
