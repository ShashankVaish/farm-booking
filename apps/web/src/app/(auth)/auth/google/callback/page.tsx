'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/feedback';
import { memoryTokenStore } from '@/lib/api/token-store';

export default function GoogleCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  // React Strict Mode runs effects twice in development. The first pass clears
  // the token out of the URL, so a second pass would find an empty hash and
  // report a false failure — this makes the handover run exactly once.
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const token = params.get('accessToken');
    const next = params.get('next');

    if (!token) {
      setError('Google sign-in could not be completed. Please try again.');
      return;
    }

    memoryTokenStore.setAccessToken(token);
    // Drop the token out of the address bar and the history entry before moving on.
    window.history.replaceState(null, '', window.location.pathname);
    router.replace(next && next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard');
  }, [router]);

  if (error) {
    return (
      <div style={{ padding: 'var(--space-12) 0', textAlign: 'center' }}>
        <h1 className="t-h3">Sign-in did not complete</h1>
        <p className="t-body-small" style={{ margin: 'var(--space-3) auto var(--space-6)', maxWidth: '28rem' }}>
          {error}
        </p>
        <Button href="/auth/login">Back to sign in</Button>
      </div>
    );
  }

  return <Spinner label="Completing Google sign-in" />;
}
