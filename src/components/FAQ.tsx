'use client';
import { useState } from 'react';

/**
 * 5 questions courantes sur DishRank, en accordéon.
 * Le `+` pivote en `×` quand l'item est ouvert (classe `faq-open` qui pilote
 * la transform via globals.css).
 */

const QUESTIONS: Array<{ q: string; a: string }> = [
  {
    q: 'Comment fonctionne DishRank ?',
    a: "Tu ouvres l'app, tu cherches un plat (burger, sushi, ramen…) et tu vois le classement des meilleurs dans ta ville, basé sur les notes de la communauté. Tu peux noter en 10 secondes : photo + 4 critères (goût, présentation, prix, quantité). Et avec tes amis, tu crées des groupes pour décider d'une sortie sans débat WhatsApp.",
  },
  {
    q: "Comment ça marche les groupes et les sorties entre amis ?",
    a: "Tu ajoutes tes potes par pseudo, QR code ou lien, puis tu crées un groupe (famille, collègues, bande de potes). Vos listes de favoris sont fusionnées automatiquement, vous discutez dans le chat intégré, et au moment de sortir vous fixez date + type (resto / bar / café) + préférences (végé, prix, ambiance). DishRank propose les meilleures adresses parmi les favoris du groupe — vote, sondage ou tirage au sort, c'est réglé en 30 secondes.",
  },
  {
    q: "Mes amis voient-ils tout ce que je fais sur l'app ?",
    a: "Non, tu contrôles tout. Tes amis voient uniquement les avis que tu publies (comme avant) et les groupes où vous êtes ensemble. Les messages d'un groupe restent dans ce groupe — ils ne sont jamais partagés ailleurs ni vendus. Tu peux quitter un groupe ou bloquer quelqu'un à tout moment depuis son profil.",
  },
  {
    q: "C'est vraiment gratuit ?",
    a: "Oui, 100% gratuit. Pas de pub, pas d'abonnement, pas d'achat in-app, et pas non plus le social en mode \"premium\". Le projet est porté par un dev solo qui veut rendre les choix resto plus simples — la monétisation viendra plus tard, et jamais au détriment des utilisateurs.",
  },
  {
    q: 'Pourquoi noter les plats et pas les restos ?',
    a: "Un resto à 4,2★ sur Google peut servir une excellente salade et un plat de pâtes catastrophique. La note moyenne ne te dit rien sur ce que TOI tu vas commander. DishRank note chaque plat individuellement — tu sais exactement quoi prendre, et tu peux comparer les choix de tes amis dans un groupe.",
  },
  {
    q: "Sur quelles villes l'app est dispo ?",
    a: "L'app fonctionne partout, mais le contenu est principalement à Lyon au lancement. Plus la communauté et tes groupes d'amis grandissent, plus les villes se remplissent. Tu peux contribuer dès aujourd'hui où que tu sois — chaque avis compte.",
  },
  {
    q: "L'app Android est dispo quand ?",
    a: "L'app est déjà live sur iOS et en bêta ouverte sur Android : tu peux la télécharger librement depuis Google Play dès maintenant. Le passage en production complète est en cours.",
  },
];

export default function FAQ({ nonce }: { nonce?: string }) {
  const [open, setOpen] = useState<number | null>(0);

  const faqJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: QUESTIONS.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };

  return (
    <section id="faq" className="max-w-[800px] mx-auto px-4 sm:px-8 py-16 sm:py-20">
      <script type="application/ld+json" nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }} />
      <h2
        className="font-black tracking-tight text-center mb-3"
        style={{ fontSize: 'clamp(1.75rem, 4.5vw, 2.75rem)' }}
      >
        Questions fréquentes
      </h2>
      <p className="text-center text-[var(--text2)] mb-10 sm:mb-12 text-sm sm:text-base">
        Tout ce qu&apos;on nous demande le plus souvent.
      </p>
      <div className="space-y-3">
        {QUESTIONS.map((item, i) => {
          const isOpen = open === i;
          return (
            <div
              key={i}
              className={`rounded-2xl bg-[var(--surface)] border overflow-hidden transition-all duration-300 ${
                isOpen
                  ? 'border-[var(--primary)]/40 faq-open shadow-lg shadow-[var(--card-shadow)]'
                  : 'border-[var(--border2)] hover:border-[var(--primary)]/30 hover:-translate-y-0.5 hover:shadow-md hover:shadow-[var(--card-shadow)]'
              }`}
            >
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
                className="w-full flex items-center justify-between gap-4 px-5 sm:px-6 py-5 text-left"
              >
                <span className="font-semibold text-[var(--text)] text-base sm:text-lg pr-2">
                  {item.q}
                </span>
                <span
                  className="faq-icon text-2xl text-[var(--primary)] font-light leading-none shrink-0"
                  aria-hidden="true"
                >
                  +
                </span>
              </button>
              {/* Animated collapse using grid-rows 0fr→1fr transition (CSS) */}
              <div className={`faq-collapse ${isOpen ? 'is-open' : ''}`}>
                <div className="faq-collapse-inner">
                  <div className="px-5 sm:px-6 pb-5 -mt-1 text-[var(--text2)] text-sm sm:text-base leading-relaxed">
                    {item.a}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
