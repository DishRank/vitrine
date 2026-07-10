'use client';
import { useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabaseBrowser';

// ─── « ☆ Noter » — notation rapide SANS COMPTE depuis le menu web ───────────
//
// Tap → feuille de notation in-page (pas de navigation, pas d'app requise) :
// 5 étoiles + commentaire optionnel. La session est ANONYME (Supabase
// signInAnonymously) → vrai auth.uid(), donc RLS + cooldown 30 j/plat +
// rate-limit + contrainte carte (trigger 092) s'appliquent tels quels. La note
// est écrite `source = 'in_venue_scan'` (§5.4) avec le NOM CANONIQUE (fr) du
// plat — la clé des agrégats — même si le menu affiché est traduit.
// La note rapide alimente les 4 sous-notes avec la même valeur (le détail
// goût/présentation/prix/quantité reste la richesse du parcours in-app).
// Un lien « Ouvrir dans l'app » reste proposé pour l'expérience complète.

export interface RateDishLabels {
  action: string;
  publish: string;
  commentPh: string;
  thanks: string;
  anonHint: string;
  already: string;
  error: string;
  openApp: string;
}

export interface RateDishTheme {
  accent: string;
  text: string;
  sub: string;
  card: string;
  line: string;
  dark: boolean;
}

const BRAND = '#6C5CE7';
const BRAND_DARK = '#A29BFE';

export default function RateDish({
  restaurantId,
  dishName,
  displayName,
  theme,
  labels,
  appHref,
}: {
  restaurantId: string;
  /** Nom CANONIQUE (fr) — clé des avis et du trigger carte. */
  dishName: string;
  /** Nom affiché (éventuellement traduit). */
  displayName: string;
  theme: RateDishTheme;
  labels: RateDishLabels;
  appHref: string;
}) {
  // `mounted` garde la feuille dans le DOM pendant l'animation de sortie ;
  // `visible` pilote la transition (slide-up + fade du backdrop).
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const violet = theme.dark ? BRAND_DARK : BRAND;

  const openSheet = () => {
    setMounted(true);
    // Monter d'abord à translateY(100%), puis flipper à 0 au frame suivant
    // pour déclencher la transition d'entrée (double rAF = paint garanti).
    requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
  };
  const closeSheet = () => {
    if (state === 'sending') return;
    setVisible(false);
    setTimeout(() => {
      setMounted(false);
      setStars(0);
      setComment('');
      setState('idle');
      setErrorMsg(null);
    }, 280);
  };

  const submit = async () => {
    if (stars < 1 || state === 'sending') return;
    setState('sending');
    setErrorMsg(null);
    try {
      const sb = getSupabaseBrowser();
      if (!sb) throw new Error('client_unavailable');
      // Session anonyme au premier envoi — persistée dans le navigateur, donc
      // le même appareil garde la même identité (dédup naturelle, §5.4).
      let {
        data: { session },
      } = await sb.auth.getSession();
      if (!session) {
        const { data, error } = await sb.auth.signInAnonymously();
        if (error || !data.session) throw error ?? new Error('anon_failed');
        session = data.session;
      }
      const { error: insertError } = await sb.from('reviews').insert({
        user_id: session.user.id,
        restaurant_id: restaurantId,
        dish_name: dishName,
        rating_taste: stars,
        rating_presentation: stars,
        rating_value: stars,
        rating_quantity: stars,
        comment: comment.trim() || null,
        source: 'in_venue_scan',
      });
      if (insertError) throw insertError;
      setState('done');
      // La note doit apparaître sur le menu (cache 5 min) — purge best-effort.
      fetch('/api/revalidate-menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restaurantId }),
      }).catch(() => {});
    } catch (e) {
      const msg = String((e as { message?: string })?.message ?? '');
      setErrorMsg(/déjà noté|cooldown/i.test(msg) ? labels.already : labels.error);
      setState('error');
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={openSheet}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          fontSize: 12,
          fontWeight: 700,
          color: violet,
          opacity: 0.9,
        }}
      >
        ☆ {labels.action}
      </button>

      {mounted ? (
        <div
          onClick={closeSheet}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            background: visible ? 'rgba(10,8,24,0.55)' : 'rgba(10,8,24,0)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            transition: 'background 260ms ease',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 560,
              background: theme.card,
              borderTopLeftRadius: 22,
              borderTopRightRadius: 22,
              padding: '22px 22px 30px',
              border: `1px solid ${theme.line}`,
              borderBottom: 'none',
              transform: visible ? 'translateY(0)' : 'translateY(100%)',
              transition: 'transform 300ms cubic-bezier(.22,1,.36,1)',
              willChange: 'transform',
            }}
          >
            {state === 'done' ? (
              <div style={{ textAlign: 'center', padding: '18px 0 10px' }}>
                <div style={{ fontSize: 34, marginBottom: 8 }}>
                  {'★'.repeat(stars)}
                </div>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: theme.text }}>
                  {labels.thanks}
                </p>
                <a
                  href={appHref}
                  style={{
                    display: 'inline-block',
                    marginTop: 14,
                    fontSize: 13,
                    fontWeight: 700,
                    color: violet,
                    textDecoration: 'none',
                  }}
                >
                  {labels.openApp} →
                </a>
              </div>
            ) : (
              <>
                <p
                  style={{
                    margin: 0,
                    fontSize: 16,
                    fontWeight: 700,
                    color: theme.text,
                    lineHeight: 1.3,
                  }}
                >
                  {displayName}
                </p>
                <div style={{ display: 'flex', gap: 6, margin: '14px 0 4px' }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setStars(n)}
                      aria-label={`${n}/5`}
                      style={{
                        background: 'none',
                        border: 'none',
                        padding: 2,
                        cursor: 'pointer',
                        fontSize: 30,
                        lineHeight: 1,
                        color: n <= stars ? theme.accent : theme.line,
                      }}
                    >
                      {n <= stars ? '★' : '☆'}
                    </button>
                  ))}
                </div>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder={labels.commentPh}
                  maxLength={500}
                  rows={2}
                  style={{
                    width: '100%',
                    marginTop: 10,
                    padding: 10,
                    borderRadius: 10,
                    border: `1px solid ${theme.line}`,
                    background: 'transparent',
                    color: theme.text,
                    fontSize: 13.5,
                    fontFamily: 'inherit',
                    resize: 'none',
                    boxSizing: 'border-box',
                  }}
                />
                {state === 'error' && errorMsg ? (
                  <p style={{ margin: '8px 0 0', fontSize: 12.5, color: '#C0604E' }}>{errorMsg}</p>
                ) : null}
                <button
                  type="button"
                  onClick={submit}
                  disabled={stars < 1 || state === 'sending'}
                  style={{
                    width: '100%',
                    marginTop: 12,
                    padding: '12px 0',
                    borderRadius: 12,
                    border: 'none',
                    cursor: stars < 1 ? 'default' : 'pointer',
                    background: violet,
                    color: '#fff',
                    fontSize: 14,
                    fontWeight: 800,
                    opacity: stars < 1 || state === 'sending' ? 0.55 : 1,
                  }}
                >
                  {state === 'sending' ? '…' : labels.publish}
                </button>
                <p
                  style={{
                    margin: '10px 0 0',
                    fontSize: 11.5,
                    color: theme.sub,
                    textAlign: 'center',
                  }}
                >
                  {labels.anonHint}{' '}
                  <a href={appHref} style={{ color: violet, textDecoration: 'none', fontWeight: 700 }}>
                    {labels.openApp}
                  </a>
                </p>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
