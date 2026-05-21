'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

const APP_DEEP_LINK = 'dishrank://';

function ConfirmContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    // Supabase sometimes reports verification failures directly in the URL
    // **hash** (#error=...&error_code=...) on the implicit flow, and sometimes
    // in the query string. Catch those first so we never call the API for a
    // link Supabase already rejected.
    const hash = typeof window !== 'undefined' ? window.location.hash.replace(/^#/, '') : '';
    const hashParams = new URLSearchParams(hash);
    const errorCode =
      searchParams.get('error_code') || searchParams.get('error') ||
      hashParams.get('error_code') || hashParams.get('error');
    const errorDesc =
      searchParams.get('error_description') || hashParams.get('error_description');

    if (errorCode) {
      setStatus('error');
      const human = (errorDesc || '').replace(/\+/g, ' ');
      setErrorMsg(
        /expired|otp_expired/i.test(errorCode + ' ' + human)
          ? 'Le lien a expiré. Reconnecte-toi dans l\'app pour recevoir un nouveau lien.'
          : (human || 'Lien invalide ou expiré.'),
      );
      return;
    }

    // The link carries `token_hash` (standard Supabase template) or, on legacy
    // setups, `token`. We hand it to our server route which calls
    // `verifyOtp` — a normal POST that ALWAYS resolves. This avoids the old bug
    // where a top-level navigation to GoTrue's GET /verify dead-ended on a 400
    // for `token_hash` (no redirect to follow → page frozen forever).
    const tokenHash = searchParams.get('token_hash');
    const token = searchParams.get('token');
    const type = searchParams.get('type') || 'signup';
    const tokenValue = tokenHash || token;
    if (!tokenValue) {
      setStatus('error');
      setErrorMsg('Lien invalide ou expiré.');
      return;
    }

    let cancelled = false;
    // Safety net : never let the page hang on the spinner. If the request
    // doesn't come back in time (flaky network, in-app webview blocking the
    // fetch…), surface a clear error instead of an infinite "Vérification en
    // cours…".
    const watchdog = setTimeout(() => {
      if (cancelled) return;
      cancelled = true;
      setStatus('error');
      setErrorMsg('La vérification a pris trop de temps. Ouvre ce lien dans Safari ou Chrome, ou réessaie depuis l\'app.');
    }, 8000);

    const apiUrl =
      `/api/auth/confirm-email?token_hash=${encodeURIComponent(tokenValue)}` +
      `&type=${encodeURIComponent(type)}`;
    fetch(apiUrl, { cache: 'no-store' })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        clearTimeout(watchdog);
        if (res.ok && body?.ok) {
          setStatus('success');
          // Best-effort : opens the app on mobile, harmless no-op on desktop.
          setTimeout(() => { window.location.href = APP_DEEP_LINK; }, 400);
        } else {
          setStatus('error');
          setErrorMsg(body?.message || 'Lien invalide ou expiré.');
        }
      })
      .catch(() => {
        if (cancelled) return;
        clearTimeout(watchdog);
        setStatus('error');
        setErrorMsg('Connexion impossible. Réessaie dans un instant.');
      });
    return () => { cancelled = true; clearTimeout(watchdog); };
  }, [searchParams]);

  return (
    <Card>
      {status === 'verifying' && (
        <>
          <Spinner />
          <h1 style={S.title}>Vérification en cours…</h1>
          <p style={S.body}>Nous confirmons ton email, un instant.</p>
        </>
      )}
      {status === 'success' && (
        <>
          <IconBadge variant="success" />
          <h1 style={S.title}>Email confirmé&nbsp;!</h1>
          <p style={S.body}>
            Ton compte DishRank est activé. Ouvre l&apos;app pour commencer à noter tes plats.
          </p>
          <a href={APP_DEEP_LINK} className="dr-cta" style={S.cta}>Ouvrir DishRank</a>
          <a href="https://dishrank.fr" className="dr-link" style={S.secondary}>Retour sur dishrank.fr</a>
        </>
      )}
      {status === 'error' && (
        <>
          <IconBadge variant="error" />
          <h1 style={S.title}>Lien expiré</h1>
          <p style={S.body}>{errorMsg}</p>
          <a href="https://dishrank.fr" className="dr-link" style={{ ...S.secondary, marginTop: 24 }}>
            Retour sur dishrank.fr
          </a>
        </>
      )}
    </Card>
  );
}

// ── Brand palette (mirrors globals.css tokens — this page renders outside the
//    [locale] layout, so it can't read the CSS vars and inlines them) ──
const C = {
  bg: '#0D0B1A',
  surface: '#1E1B35',
  border: '#2E2A4A',
  text: '#F8F7FC',
  text2: '#B2BEC3',
  primary: '#6C5CE7',
  primaryLight: '#A29BFE',
  success: '#5FD39A',
  warm: '#FF7A3D',
};

const FONT = "var(--font-outfit), 'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

const S: Record<string, React.CSSProperties> = {
  title: { fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em', margin: '0 0 10px', color: C.text },
  body: { fontSize: 15, color: C.text2, lineHeight: 1.6, margin: 0, maxWidth: 320 },
  cta: {
    display: 'inline-block', marginTop: 28,
    background: `linear-gradient(135deg, ${C.primary}, ${C.primaryLight})`,
    color: '#fff', fontSize: 16, fontWeight: 700, textDecoration: 'none',
    padding: '15px 38px', borderRadius: 999,
    boxShadow: `0 10px 30px -8px ${C.primary}`,
  },
  secondary: {
    display: 'inline-block', marginTop: 16, color: C.text2,
    fontSize: 14, fontWeight: 500, textDecoration: 'none',
  },
};

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="dr-card"
      style={{
        position: 'relative', zIndex: 1,
        maxWidth: 420, width: '100%',
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 24,
        padding: '44px 32px 40px',
        boxShadow: `0 24px 60px -20px rgba(108,92,231,0.45), 0 2px 8px rgba(0,0,0,0.4)`,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/img/icon.webp" alt="DishRank" width={56} height={56}
        style={{ borderRadius: 16, marginBottom: 24, boxShadow: `0 8px 20px -6px ${C.primary}` }}
      />
      {children}
    </div>
  );
}

function Spinner() {
  return <div className="dr-spinner" aria-label="Chargement" role="status" />;
}

function IconBadge({ variant }: { variant: 'success' | 'error' }) {
  const isSuccess = variant === 'success';
  return (
    <div
      className="dr-badge"
      style={{
        width: 72, height: 72, borderRadius: '50%', marginBottom: 22,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: isSuccess
          ? `linear-gradient(135deg, ${C.success}, #3FB985)`
          : `linear-gradient(135deg, ${C.warm}, #E85C2B)`,
        boxShadow: isSuccess
          ? '0 12px 30px -8px rgba(95,211,154,0.55)'
          : '0 12px 30px -8px rgba(255,122,61,0.55)',
      }}
    >
      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
        {isSuccess ? <polyline points="20 6 9 17 4 12" /> : (<><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>)}
      </svg>
    </div>
  );
}

export default function ConfirmPage() {
  return (
    <main
      style={{
        margin: 0, padding: '40px 20px', minHeight: '100vh',
        fontFamily: FONT, color: C.text, textAlign: 'center',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `radial-gradient(900px 500px at 50% -10%, rgba(108,92,231,0.28), transparent 60%), ${C.bg}`,
      }}
    >
      <style>{`
        .dr-card { animation: dr-up 0.5s cubic-bezier(0.16,1,0.3,1) both; }
        .dr-cta { transition: transform 0.15s ease, box-shadow 0.15s ease; }
        .dr-cta:hover { transform: translateY(-2px); box-shadow: 0 16px 38px -8px ${C.primary}; }
        .dr-cta:active { transform: translateY(0); }
        .dr-link:hover { color: ${C.primaryLight}; }
        .dr-spinner {
          width: 56px; height: 56px; margin-bottom: 24px; border-radius: 50%;
          border: 4px solid rgba(162,155,254,0.18);
          border-top-color: ${C.primaryLight};
          animation: dr-spin 0.8s linear infinite;
        }
        .dr-badge { animation: dr-pop 0.45s cubic-bezier(0.34,1.56,0.64,1) both; }
        @keyframes dr-spin { to { transform: rotate(360deg); } }
        @keyframes dr-up { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes dr-pop { 0% { opacity: 0; transform: scale(0.5); } 100% { opacity: 1; transform: scale(1); } }
        @media (prefers-reduced-motion: reduce) {
          .dr-card, .dr-badge { animation: none; }
          .dr-spinner { animation-duration: 1.4s; }
        }
      `}</style>
      <Suspense fallback={
        <Card>
          <Spinner />
          <h1 style={S.title}>Vérification en cours…</h1>
        </Card>
      }>
        <ConfirmContent />
      </Suspense>
    </main>
  );
}
