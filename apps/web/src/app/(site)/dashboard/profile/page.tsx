'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox, Input } from '@/components/ui/forms';
import { ErrorState, Spinner } from '@/components/ui/feedback';
import { apiClient } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { indianMobile } from '@/lib/auth/form';
import { useToast } from '@/components/providers/toast-provider';
import type { AuthUser } from '@/lib/properties/types';
import styles from '../dashboard.module.css';

export default function ProfilePage() {
  const { notify } = useToast();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // Phone verification. A verified number is the only one WhatsApp updates go to.
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [whatsappOptIn, setWhatsappOptIn] = useState(false);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<AuthUser>('/api/auth/me')
      .then((result) => {
        setUser(result);
        setName(result.name);
        setPhone(result.phone ?? '');
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load profile.'))
      .finally(() => setLoading(false));
  }, []);

  const mobile = indianMobile(phone);
  // Verified means the number in the box is the one that was proven, unchanged.
  const verified = Boolean(user?.phoneVerified && mobile && mobile === user.phone);

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (phone.trim() && !mobile) {
        setError('Enter a valid 10-digit Indian mobile number, or leave it blank.');
        return;
      }
      const result = await apiClient.patch<AuthUser>('/api/auth/me', {
        name: name.trim(),
        ...(mobile ? { phone: mobile } : {}),
      });
      setUser(result);
      notify(
        mobile && !result.phoneVerified ? 'Profile saved. Verify your mobile number below.' : 'Profile saved.',
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save profile.');
    } finally {
      setBusy(false);
    }
  }

  async function sendCode() {
    if (!mobile) {
      setVerifyError('Enter a valid 10-digit Indian mobile number first.');
      return;
    }
    setVerifyBusy(true);
    setVerifyError(null);
    try {
      await apiClient.post('/api/auth/me/phone/request', { phone: mobile });
      setCodeSent(true);
      notify('Code sent by SMS.');
    } catch (err) {
      setVerifyError(err instanceof ApiError ? err.message : 'Could not send the code.');
    } finally {
      setVerifyBusy(false);
    }
  }

  async function verifyCode() {
    if (!mobile) return;
    setVerifyBusy(true);
    setVerifyError(null);
    try {
      await apiClient.post('/api/auth/me/phone/verify', {
        phone: mobile,
        code: code.trim(),
        whatsappOptIn,
      });
      const refreshed = await apiClient.get<AuthUser>('/api/auth/me');
      setUser(refreshed);
      setPhone(refreshed.phone ?? '');
      setCodeSent(false);
      setCode('');
      notify(whatsappOptIn ? 'Mobile verified. Booking updates will come on WhatsApp.' : 'Mobile verified.');
    } catch (err) {
      setVerifyError(err instanceof ApiError ? err.message : 'Could not verify the code.');
    } finally {
      setVerifyBusy(false);
    }
  }

  if (loading) return <Spinner label="Loading profile" />;
  if (error && !user) return <ErrorState description={error} />;

  return (
    <div>
      <p className="t-label">Account</p>
      <h1 className="t-h2">Profile</h1>
      <form className={styles.panel} onSubmit={(event) => void save(event)} style={{ maxWidth: '32rem' }}>
        {error ? (
          <p className="t-body-small" role="alert">
            {error}
          </p>
        ) : null}
        <Input id="profile-name" label="Name" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input id="profile-email" label="Email" value={user?.email ?? ''} disabled />
        <Input
          id="profile-phone"
          label="Mobile"
          inputMode="numeric"
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value);
            setCodeSent(false);
          }}
        />
        {mobile ? (
          <p className="t-caption" style={{ marginTop: 'calc(var(--space-2) * -1)' }}>
            <span className={styles.badge}>{verified ? 'Verified' : 'Not verified'}</span>
          </p>
        ) : null}
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </Button>
      </form>

      {mobile && !verified ? (
        <section className={styles.panel} style={{ maxWidth: '32rem', marginTop: 'var(--space-6)' }}>
          <h2 className="t-h3">Verify your mobile</h2>
          <p className="t-body-small">
            We&apos;ll text a 6-digit code to {mobile}. A verified number can get your booking confirmations and
            updates on WhatsApp.
          </p>
          {codeSent ? (
            <>
              <Input
                id="profile-otp"
                label="Code"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              />
              <Checkbox
                id="profile-whatsapp"
                label="Send my booking updates on WhatsApp"
                checked={whatsappOptIn}
                onChange={(e) => setWhatsappOptIn(e.target.checked)}
              />
            </>
          ) : null}
          {verifyError ? (
            <p className="t-body-small" role="alert" style={{ color: 'var(--color-error)' }}>
              {verifyError}
            </p>
          ) : null}
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', marginTop: 'var(--space-3)' }}>
            {codeSent ? (
              <>
                <Button onClick={() => void verifyCode()} disabled={verifyBusy || code.length < 6}>
                  {verifyBusy ? 'Verifying…' : 'Verify'}
                </Button>
                <Button variant="ghost" onClick={() => void sendCode()} disabled={verifyBusy}>
                  Resend code
                </Button>
              </>
            ) : (
              <Button onClick={() => void sendCode()} disabled={verifyBusy}>
                {verifyBusy ? 'Sending…' : 'Send code'}
              </Button>
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
