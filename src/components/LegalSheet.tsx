'use client';
import { useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';

const LEGAL_CONTENT: Record<string, string> = {
  privacy: `<h3>Politique de confidentialité</h3><p class="text-xs text-[var(--text3)] italic mb-4">Dernière mise à jour : 19 mars 2026</p><h4>1. Responsable du traitement</h4><p>DishRank SAS est responsable du traitement de vos données personnelles.</p><p>Contact DPO : <a href="mailto:contact@dishrank.fr">contact@dishrank.fr</a></p><h4>2. Données collectées</h4><ul><li><strong>Inscription :</strong> email, nom d'utilisateur, mot de passe (chiffré), photo de profil.</li><li><strong>Contenu :</strong> avis, notes, photos de plats, commentaires.</li><li><strong>Localisation :</strong> position géographique (avec consentement).</li><li><strong>Techniques :</strong> type d'appareil, OS, jeton de notification.</li></ul><h4>3. Finalités</h4><ul><li>Gestion de votre compte</li><li>Publication et affichage de vos avis</li><li>Recommandation de plats à proximité</li><li>Notifications (likes, commentaires)</li><li>Amélioration du service</li></ul><h4>4. Durée de conservation</h4><ul><li>Données de compte : supprimées sous 30 jours après suppression</li><li>Localisation : non stockée, utilisée en temps réel</li><li>Logs techniques : 12 mois maximum</li></ul><h4>5. Partage des données</h4><ul><li><strong>Supabase</strong> (hébergement) — serveurs en Europe</li><li><strong>Google</strong> (notifications push, Places API)</li></ul><p><strong>Nous ne vendons jamais vos données.</strong></p><h4>6. Vos droits (RGPD)</h4><ul><li>Accès, rectification, effacement, portabilité (export JSON)</li><li>Opposition, limitation, retrait du consentement</li></ul><p>Exerçables depuis Paramètres > Données personnelles ou par email.</p><h4>7. Contact</h4><p><a href="mailto:contact@dishrank.fr">contact@dishrank.fr</a> — DishRank SAS, Paris</p>`,

  terms: `<h3>Conditions Générales d'Utilisation</h3><p class="text-xs text-[var(--text3)] italic mb-4">Dernière mise à jour : 19 mars 2026</p><h4>1. Acceptation</h4><p>En utilisant DishRank, vous acceptez les présentes CGU.</p><h4>2. Description du service</h4><p>DishRank permet de noter et partager des avis sur des plats spécifiques dans des restaurants.</p><h4>3. Inscription</h4><p>Vous devez avoir au moins 16 ans. Vous êtes responsable de vos identifiants.</p><h4>4. Contenu utilisateur</h4><ul><li>Vous êtes l'auteur original du contenu</li><li>Licence non exclusive d'affichage accordée à DishRank</li><li>Suppression possible à tout moment</li></ul><h4>5. Comportement</h4><ul><li>Utilisation honnête et respectueuse</li><li>Pas de faux avis</li><li>Pas de harcèlement</li></ul><h4>6. Droit applicable</h4><p>Droit français. Tribunaux de Paris.</p><h4>7. Contact</h4><p><a href="mailto:contact@dishrank.fr">contact@dishrank.fr</a></p>`,

  delete: `<h3>Suppression de compte</h3><h4>1. Depuis l'application</h4><p>Profil > Paramètres > Données personnelles > Supprimer mon compte</p><h4>2. Par email</h4><p>Envoyez à <a href="mailto:contact@dishrank.fr">contact@dishrank.fr</a> avec l'objet "Suppression de compte".</p><h4>Données supprimées</h4><ul><li>Profil, avis, photos, commentaires, likes, favoris, paramètres, notifications</li></ul><p>Délai de <strong>30 jours</strong> avant suppression définitive.</p>`,
};

const TABS = ['privacy', 'terms', 'delete'] as const;

export default function LegalSheet({ initialPage }: { initialPage: string }) {
  const t = useTranslations('legal');
  const [open, setOpen] = useState(!!initialPage && initialPage in LEGAL_CONTENT);
  const [tab, setTab] = useState<string>(initialPage || 'privacy');
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      const page = (e as CustomEvent).detail;
      setTab(page);
      setOpen(true);
    };
    window.addEventListener('open-legal', handler);
    return () => window.removeEventListener('open-legal', handler);
  }, []);

  const close = () => {
    setClosing(true);
    setTimeout(() => {
      setOpen(false);
      setClosing(false);
      const params = new URLSearchParams(window.location.search);
      params.delete('page');
      const qs = params.toString();
      window.history.replaceState(null, '', qs ? '?' + qs : window.location.pathname);
    }, 300);
  };

  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 z-[300] bg-black/50 backdrop-blur-sm flex items-end justify-center ${closing ? 'animate-[fadeOut_0.3s_ease_forwards]' : 'animate-[fadeIn_0.2s_ease]'}`}
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="legal-title" className={`bg-[var(--surface)] rounded-t-3xl w-full max-w-[680px] max-h-[85vh] flex flex-col ${closing ? 'animate-[sheetDown_0.3s_ease_forwards]' : 'animate-[sheetUp_0.35s_ease]'}`}>
        {/* Header */}
        <div className="px-5 pt-3 shrink-0 relative">
          <div className="w-9 h-1 bg-[var(--border2)] rounded-full mx-auto mb-3" />
          <button onClick={close} className="absolute top-3 right-4 w-8 h-8 flex items-center justify-center bg-[var(--surface-var)] rounded-full text-[var(--text2)] hover:text-[var(--text)]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
          </button>
          <div className="flex gap-1 pb-3 border-b border-[var(--border)]">
            {TABS.map((tb) => (
              <button
                key={tb}
                onClick={() => setTab(tb)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${tb === tab ? 'bg-[var(--primary-container)] text-[var(--primary)] font-semibold' : 'text-[var(--text3)] hover:text-[var(--text)]'}`}
              >
                {t(tb)}
              </button>
            ))}
          </div>
        </div>
        {/* Body */}
        <div
          className="legal-scroll flex-1 overflow-y-auto px-6 py-5 text-sm [&_h3]:text-lg [&_h3]:font-extrabold [&_h3]:mb-1 [&_h4]:text-sm [&_h4]:font-bold [&_h4]:mt-5 [&_h4]:mb-1 [&_p]:text-[var(--text2)] [&_p]:leading-relaxed [&_p]:mb-2 [&_a]:text-[var(--primary)] [&_a]:underline [&_ul]:pl-4 [&_ul]:mb-2 [&_li]:text-[var(--text2)] [&_li]:leading-relaxed [&_li]:mb-1"
          dangerouslySetInnerHTML={{ __html: LEGAL_CONTENT[tab] || '' }}
        />
      </div>
    </div>
  );
}
