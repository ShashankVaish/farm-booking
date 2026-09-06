'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/forms';
import { apiClient } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import { memoryTokenStore } from '@/lib/api/token-store';
import { authErrorMessage, indianMobile, isStrongPassword } from '@/lib/auth/form';
import type { AuthUser } from '@/lib/properties/types';
import styles from './auth.module.css';

type Mode = 'email' | 'otp';

function otpMessage(code: string, fallback: string) {
  if (code === 'OTP_INVALID') return 'That code is incorrect. Try again.';
  if (code === 'OTP_EXPIRED') return 'This code has expired. Request a new one.';
  if (code === 'OTP_COOLDOWN') return 'Please wait before requesting another code.';
  if (code === 'OTP_LOCKED') return 'Too many attempts. Request a new code.';
  if (code === 'OTP_RATE_LIMITED') return 'Too many OTP requests. Try again later.';
  return fallback;
}

export function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get('next') || '/dashboard';
  const [mode, setMode] = useState<Mode>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = window.setTimeout(() => setSeconds((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [seconds]);

  async function submitEmail(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await apiClient.post<{ user: AuthUser; accessToken: string }>(
        '/api/auth/login',
        { email: email.trim().toLowerCase(), password },
        { auth: false },
      );
      memoryTokenStore.setAccessToken(result.accessToken);
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(authErrorMessage(err, 'Unable to sign in.'));
    } finally {
      setBusy(false);
    }
  }

  async function requestOtp() {
    setBusy(true);
    setError(null);
    try {
      const mobile = indianMobile(phone);
      if (!mobile) {
        setError('Enter a valid 10-digit Indian mobile number.');
        return;
      }
      const result = await apiClient.post<{ resendAvailableAt: string }>(
        '/api/auth/otp/request',
        { phone: mobile, purpose: 'LOGIN' },
        { auth: false },
      );
      setOtpSent(true);
      const wait = Math.max(0, Math.ceil((new Date(result.resendAvailableAt).getTime() - Date.now()) / 1000));
      setSeconds(wait || 60);
    } catch (err) {
      setError(err instanceof ApiError ? otpMessage(err.code, err.message) : authErrorMessage(err, 'Could not send OTP.'));
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const mobile = indianMobile(phone);
      if (!mobile) {
        setError('Enter a valid 10-digit Indian mobile number.');
        return;
      }
      const result = await apiClient.post<{ user: AuthUser; accessToken: string }>(
        '/api/auth/otp/verify',
        { phone: mobile, code: code.trim(), purpose: 'LOGIN' },
        { auth: false },
      );
      memoryTokenStore.setAccessToken(result.accessToken);
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? otpMessage(err.code, err.message) : authErrorMessage(err, 'Could not verify OTP.'));
    } finally {
      setBusy(false);
    }
  }

  const canResend = seconds === 0;

  return (
    <div className={styles.panel}>
      <p className="t-label">Account</p>
      <h1 className="t-h2">Sign in</h1>
      <div className={styles.tabs}>
        <Button variant={mode === 'email' ? 'primary' : 'secondary'} size="sm" type="button" onClick={() => setMode('email')}>
          Email
        </Button>
        <Button variant={mode === 'otp' ? 'primary' : 'secondary'} size="sm" type="button" onClick={() => setMode('otp')}>
          Mobile OTP
        </Button>
      </div>
      {error ? (
        <p className={`${styles.alert} t-body-small`} role="alert">
          {error}
        </p>
      ) : null}
      {mode === 'email' ? (
        <form className={styles.stack} onSubmit={submitEmail}>
          <Input id="email" label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input
            id="password"
            label="Password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit" disabled={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      ) : (
        <form className={styles.stack} onSubmit={otpSent ? verifyOtp : (event) => { event.preventDefault(); void requestOtp(); }}>
          <Input
            id="phone"
            label="Mobile number"
            inputMode="numeric"
            pattern="[6-9][0-9]{9}"
            placeholder="10-digit Indian mobile"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          {otpSent ? (
            <Input
              id="otp"
              label="OTP"
              inputMode="numeric"
              pattern="[0-9]{6}"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          ) : null}
          <Button type="submit" disabled={busy}>
            {busy ? 'Please wait…' : otpSent ? 'Verify OTP' : 'Send OTP'}
          </Button>
          {otpSent ? (
            <Button type="button" variant="ghost" disabled={!canResend || busy} onClick={() => void requestOtp()}>
              {canResend ? 'Resend code' : `Resend in ${seconds}s`}
            </Button>
          ) : null}
        </form>
      )}
      <p className="t-body-small" style={{ marginTop: 'var(--space-5)' }}>
        New here? <Link href="/auth/register">Create an account</Link>
      </p>
    </div>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const search = useSearchParams();
  const asHost = search.get('role') === 'OWNER';
  const [mode, setMode] = useState<Mode>('email');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = window.setTimeout(() => setSeconds((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [seconds]);

  const passwordHint = useMemo(
    () => (/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(password) ? undefined : 'Use at least 8 characters with a letter and a number.'),
    [password],
  );

  async function submitEmail(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (!isStrongPassword(password)) {
        setError('Use at least 8 characters with a letter and a number.');
        return;
      }
      const mobile = indianMobile(phone);
      if (phone.trim() && !mobile) {
        setError('Enter a valid 10-digit Indian mobile number, or leave it blank.');
        return;
      }
      const result = await apiClient.post<{ accessToken: string }>(
        '/api/auth/register',
        {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          phone: mobile,
          role: asHost ? 'OWNER' : 'CUSTOMER',
        },
        { auth: false },
      );
      memoryTokenStore.setAccessToken(result.accessToken);
      router.push(asHost ? '/host' : '/dashboard');
      router.refresh();
    } catch (err) {
      setError(authErrorMessage(err, 'Could not create account.'));
    } finally {
      setBusy(false);
    }
  }

  async function requestOtp() {
    setBusy(true);
    setError(null);
    try {
      const mobile = indianMobile(phone);
      if (!mobile) {
        setError('Enter a valid 10-digit Indian mobile number.');
        return;
      }
      if (name.trim().length < 2) {
        setError('Enter your full name.');
        return;
      }
      const result = await apiClient.post<{ resendAvailableAt: string }>(
        '/api/auth/otp/request',
        { phone: mobile, purpose: 'REGISTER' },
        { auth: false },
      );
      setOtpSent(true);
      const wait = Math.max(0, Math.ceil((new Date(result.resendAvailableAt).getTime() - Date.now()) / 1000));
      setSeconds(wait || 60);
    } catch (err) {
      setError(err instanceof ApiError ? otpMessage(err.code, err.message) : authErrorMessage(err, 'Could not send OTP.'));
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const mobile = indianMobile(phone);
      if (!mobile) {
        setError('Enter a valid 10-digit Indian mobile number.');
        return;
      }
      const result = await apiClient.post<{ accessToken: string }>(
        '/api/auth/otp/verify',
        { phone: mobile, code: code.trim(), purpose: 'REGISTER', name: name.trim() },
        { auth: false },
      );
      memoryTokenStore.setAccessToken(result.accessToken);
      router.push(asHost ? '/host' : '/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? otpMessage(err.code, err.message) : authErrorMessage(err, 'Could not verify OTP.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.panel}>
      <p className="t-label">Account</p>
      <h1 className="t-h2">{asHost ? 'Create host account' : 'Create account'}</h1>
      <div className={styles.tabs}>
        <Button variant={mode === 'email' ? 'primary' : 'secondary'} size="sm" type="button" onClick={() => setMode('email')}>
          Email
        </Button>
        <Button variant={mode === 'otp' ? 'primary' : 'secondary'} size="sm" type="button" onClick={() => setMode('otp')}>
          Mobile OTP
        </Button>
      </div>
      {error ? (
        <p className={`${styles.alert} t-body-small`} role="alert">
          {error}
        </p>
      ) : null}
      {mode === 'email' ? (
        <form className={styles.stack} onSubmit={submitEmail}>
          <Input id="name" label="Full name" required value={name} onChange={(e) => setName(e.target.value)} />
          <Input id="reg-email" label="Email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input
            id="reg-phone"
            label="Mobile (optional)"
            inputMode="numeric"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Input
            id="reg-password"
            label="Password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            hint={passwordHint}
          />
          <Button type="submit" disabled={busy}>
            {busy ? 'Creating…' : 'Create account'}
          </Button>
        </form>
      ) : (
        <form
          className={styles.stack}
          onSubmit={otpSent ? verifyOtp : (event) => { event.preventDefault(); void requestOtp(); }}
        >
          <Input id="otp-name" label="Full name" required value={name} onChange={(e) => setName(e.target.value)} />
          <Input
            id="otp-phone"
            label="Mobile number"
            required
            inputMode="numeric"
            pattern="[6-9][0-9]{9}"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          {otpSent ? (
            <Input id="otp-code" label="OTP" required inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} />
          ) : null}
          <Button type="submit" disabled={busy}>
            {busy ? 'Please wait…' : otpSent ? 'Verify and continue' : 'Send OTP'}
          </Button>
          {otpSent ? (
            <Button type="button" variant="ghost" disabled={seconds > 0 || busy} onClick={() => void requestOtp()}>
              {seconds > 0 ? `Resend in ${seconds}s` : 'Resend code'}
            </Button>
          ) : null}
        </form>
      )}
      <p className="t-body-small" style={{ marginTop: 'var(--space-5)' }}>
        Already have an account? <Link href="/auth/login">Sign in</Link>
      </p>
    </div>
  );
}
