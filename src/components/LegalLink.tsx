'use client';

/**
 * Lien vers une page légale (confidentialité, CGU, avis…) qui ouvre le
 * panneau <LegalSheet /> sans quitter la page. L'href garde un vrai lien
 * (`/?page=…`) pour l'accès direct, le clic du milieu et les robots.
 */
export default function LegalLink({
  page,
  className = '',
  children,
}: {
  page: 'privacy' | 'terms' | 'delete' | 'reviews';
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={`/?page=${page}`}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('open-legal', { detail: page }));
      }}
      className={className}
    >
      {children}
    </a>
  );
}
