'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

const SUPABASE_URL = 'https://yztbhdvrvgozhyaujtjz.supabase.co';

function ConfirmContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const tokenHash = searchParams.get('token_hash') || searchParams.get('token');
    const type = searchParams.get('type') || 'signup';

    if (!tokenHash) {
      setStatus('error');
      setErrorMsg('Lien invalide ou expiré.');
      return;
    }

    fetch(`${SUPABASE_URL}/auth/v1/verify?type=${type}&token_hash=${tokenHash}&redirect_to=dishrank://`, {
      method: 'GET',
      redirect: 'manual',
    })
      .then((res) => {
        if (res.type === 'opaqueredirect' || res.status === 303 || res.status === 302 || res.ok) {
          setStatus('success');
          window.location.href = 'dishrank://';
        } else {
          setStatus('error');
          setErrorMsg('Le lien a expiré. Reconnecte-toi dans l\'app pour recevoir un nouveau lien.');
        }
      })
      .catch(() => {
        setStatus('success');
        window.location.href = `${SUPABASE_URL}/auth/v1/verify?type=${type}&token_hash=${tokenHash}&redirect_to=dishrank://`;
      });
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
            href="dishrank://"
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
