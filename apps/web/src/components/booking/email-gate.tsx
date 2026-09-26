'use client';

import { FormEvent, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/forms';
import { Modal } from '@/components/ui/overlays';
import { apiClient } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function gateMessage(err: unknown, fallback: string): string {
  if (!(err instanceof ApiError)) return fallback;
  if (err.code === 'OTP_INVALID') return 'That code is incorrect. Try again.';
  if (err.code === 'OTP_EXPIRED') return 'This code has expired. Send a new one.';
  if (err.code === 'OTP_LOCKED') return 'Too many attempts. Send a new code.';
  if (err.code === 'OTP_COOLDOWN') return 'Please wait a moment before asking for another code.';
  if (err.code === 'OTP_RATE_LIMITED') return 'Too many codes requested. Try again later.';
  if (err.code === 'EMAIL_SEND_FAILED') return 'We could not send the email just now. Please try again shortly.';
  return err.message || fallback;
}

/**
 * Asks a phone sign-up for an email and confirms it with a code, before their
 * first booking. Confirmations, the exact address, receipts and refund notices
 * are all emailed, so a booking without an inbox behind it would lose them.
 */
export function EmailGate({
  open,
  onClose,
  onVerified,
}: {
  open: boolean;
  onClose: () => void;
  onVerified: (email: string) => void;
}) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Portalled to <body>: the booking card is `position: sticky` on desktop,
  // which would otherwise trap the dialog under the site header.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = window.setTimeout(() => setSeconds((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [seconds]);

  async function sendCode() {
    const address = email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(address)) {
      setError('Enter a valid email address.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await apiClient.post<{ resendAvailableAt: string }>('/api/auth/me/email/request', {
        email: address,
      });
      setSentTo(address);
      setCode('');
      const wait = Math.ceil((new Date(result.resendAvailableAt).getTime() - Date.now()) / 1000);
      setSeconds(wait > 0 ? wait : 60);
    } catch (err) {
      setError(gateMessage(err, 'Could not send the code.'));
    } finally {
      setBusy(false);
    }
  }

  async function verify(event: FormEvent) {
    event.preventDefault();
    if (!sentTo) return;
    setBusy(true);
    setError(null);
    try {
      await apiClient.post('/api/auth/me/email/verify', { email: sentTo, code: code.trim() });
      onVerified(sentTo);
    } catch (err) {
      setError(gateMessage(err, 'Could not verify the code.'));
    } finally {
      setBusy(false);
    }
  }

  function changeEmail() {
    setSentTo(null);
    setCode('');
    setSeconds(0);
    setError(null);
  }

  if (!mounted) return null;

  return createPortal(
    <Modal open={open} title="Add your email" onClose={onClose}>
      <p className="t-body-small" style={{ marginBottom: 'var(--space-4)' }}>
        We&apos;ll send your booking confirmation, the exact address and your receipt here. Confirm it with a
        6-digit code first.
      </p>
      {error ? (
        <p className="t-body-small" role="alert" style={{ color: 'var(--color-error)', marginBottom: 'var(--space-3)' }}>
          {error}
        </p>
      ) : null}

      {!sentTo ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void sendCode();
          }}
          style={{ display: 'grid', gap: 'var(--space-3)' }}
        >
          <Input
            id="gate-email"
            label="Email address"
            type="email"
            autoComplete="email"
            autoFocus
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Button type="submit" block disabled={busy} loading={busy}>
            {busy ? 'Sending…' : 'Send code'}
          </Button>
        </form>
      ) : (
        <form onSubmit={verify} style={{ display: 'grid', gap: 'var(--space-3)' }}>
          <p className="t-body-small">
            Code sent to <strong>{sentTo}</strong>.{' '}
            <button
              type="button"
              onClick={changeEmail}
              style={{ background: 'none', border: 0, padding: 0, color: 'var(--color-primary-text)', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Change email
            </button>
          </p>
          <Input
            id="gate-code"
            label="6-digit code"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            maxLength={6}
            required
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
          <Button type="submit" block disabled={busy || code.length < 6} loading={busy}>
            {busy ? 'Verifying…' : 'Verify and continue'}
          </Button>
          <Button type="button" variant="ghost" block disabled={busy || seconds > 0} onClick={() => void sendCode()}>
            {seconds > 0 ? `Resend code in ${seconds}s` : 'Resend code'}
          </Button>
        </form>
      )}
    </Modal>,
    document.body,
  );
}
