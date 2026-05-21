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
    <div style={{
      maxWidth: 400, width: '100%', background: '#1A1A2E', borderRadius: 16, padding: '40px 24px',
    }}>
      {status === 'verifying' && (
        <>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
          <h1 style={{ fontSize: 22, margin: '0 0 12px' }}>Vérification en cours...</h1>
          <p style={{ fontSize: 15, color: '#9B97B0', lineHeight: 1.6, margin: 0 }}>
            Nous vérifions ton email, un instant.
          </p>
        </>
      )}
      {status === 'success' && (
        <>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <h1 style={{ fontSize: 22, margin: '0 0 12px' }}>Email confirmé !</h1>
          <p style={{ fontSize: 15, color: '#9B97B0', lineHeight: 1.6, margin: '0 0 20px' }}>
            Ton compte DishRank est activé. Ouvre l&apos;app pour commencer.
          </p>
          <a
            href={APP_DEEP_LINK}
            style={{
              display: 'inline-block', background: '#6C5CE7', color: '#fff',
              fontSize: 16, fontWeight: 700, textDecoration: 'none',
              padding: '14px 32px', borderRadius: 60,
            }}
          >
            Ouvrir DishRank
          </a>
        </>
      )}
      {status === 'error' && (
        <>
          <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
          <h1 style={{ fontSize: 22, margin: '0 0 12px' }}>Lien expiré</h1>
          <p style={{ fontSize: 15, color: '#9B97B0', lineHeight: 1.6, margin: 0 }}>
            {errorMsg}
          </p>
        </>
      )}
    </div>
  );
}

export default function ConfirmPage() {
  return (
    <div style={{
      margin: 0, padding: '40px 20px', background: '#0F0D1A', fontFamily: '-apple-system, sans-serif',
      color: '#fff', textAlign: 'center', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <Suspense fallback={
        <div style={{ maxWidth: 400, width: '100%', background: '#1A1A2E', borderRadius: 16, padding: '40px 24px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
          <h1 style={{ fontSize: 22, margin: '0 0 12px' }}>Vérification en cours...</h1>
        </div>
      }>
        <ConfirmContent />
      </Suspense>
    </div>
  );
}
