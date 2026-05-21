'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

const SUPABASE_URL = 'https://yztbhdvrvgozhyaujtjz.supabase.co';
const APP_DEEP_LINK = 'dishrank://';
// Where Supabase bounces back to once the token is verified. Must be on
// the SiteURL domain (dishrank.fr) so it's an allowed redirect target.
const RETURN_URL = 'https://dishrank.fr/auth/confirm?done=1';

function ConfirmContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    // Supabase reports verification failures in the URL **hash**
    // (#error=...&error_code=...&error_description=...) on the implicit
    // flow, and sometimes in the query string. Parse both.
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

    // Second hop : Supabase already verified the token and redirected us
    // back here with ?done=1. Show success + try the deep link.
    if (searchParams.get('done') === '1') {
      setStatus('success');
      // Best-effort : opens the app on mobile, harmless no-op on desktop.
      const tid = setTimeout(() => { window.location.href = APP_DEEP_LINK; }, 400);
      return () => clearTimeout(tid);
    }

    // First hop : a fresh confirmation link. Hand the token off to
    // Supabase's verify endpoint via a TOP-LEVEL navigation (not a
    // cross-origin fetch — that was the bug : `fetch(..., {redirect:
    // 'manual'})` could leave the promise pending forever on some
    // browsers, freezing the page on "Vérification en cours…").
    // Supabase verifies server-side and 302-redirects back to RETURN_URL
    // (?done=1) on success, or appends ?error=… on failure.
    const tokenHash = searchParams.get('token_hash') || searchParams.get('token');
    const type = searchParams.get('type') || 'signup';
    if (!tokenHash) {
      setStatus('error');
      setErrorMsg('Lien invalide ou expiré.');
      return;
    }
    const verifyUrl =
      `${SUPABASE_URL}/auth/v1/verify` +
      `?type=${encodeURIComponent(type)}` +
      `&token_hash=${encodeURIComponent(tokenHash)}` +
      `&redirect_to=${encodeURIComponent(RETURN_URL)}`;
    window.location.replace(verifyUrl);
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
