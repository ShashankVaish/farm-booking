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
import {
  AccountTypeChooser,
  AuthShell,
  Divider,
  GoogleButton,
  PasswordField,
  Segmented,
} from './auth-chrome';
import styles from './auth.module.css';

type Mode = 'email' | 'otp';

const METHODS = [
  { value: 'email' as const, label: 'Email' },
  { value: 'otp' as const, label: 'Mobile OTP' },
];

const GOOGLE_ERRORS: Record<string, string> = {
  access_denied: 'You cancelled Google sign-in.',
  google_admin: 'Admin accounts must sign in from the admin page.',
  account_disabled: 'This account has been disabled.',
  google_email_unverified: 'Verify your email with Google, then try again.',
  google_not_configured: 'Google sign-in is not configured on the server yet.',
  google_state: 'Google sign-in timed out. Please try again.',
  redirect_uri_mismatch:
    'Google rejected the redirect URL for this app. An administrator needs to add it in the Google Cloud console.',
};

function googleErrorMessage(code: string) {
  return (
    GOOGLE_ERRORS[code] ?? 'Google sign-in could not be completed. Please try again.'
  );
}

function otpMessage(code: string, fallback: string) {
  if (code === 'OTP_INVALID') return 'That code is incorrect. Try again.';
  if (code === 'OTP_EXPIRED') return 'This code has expired. Request a new one.';
  if (code === 'OTP_COOLDOWN') return 'Please wait before requesting another code.';
  if (code === 'OTP_LOCKED') return 'Too many attempts. Request a new code.';
  if (code === 'OTP_RATE_LIMITED') return 'Too many OTP requests. Try again later.';
  return fallback;
}

function Alert({ children }: { children: React.ReactNode }) {
  return (
    <p className={styles.alert} role="alert">
      <span aria-hidden="true">⚠</span>
      <span>{children}</span>
    </p>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className={styles.success} role="status">
      <span aria-hidden="true">✓</span>
      <span>{children}</span>
    </p>
  );
}

export function LoginForm({ adminOnly = false, onAuthenticated }: { adminOnly?: boolean; onAuthenticated?: () => void }) {
  const router = useRouter();
  const search = useSearchParams();
  const next = search.get('next') || (adminOnly ? '/admin' : '/dashboard');
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

  useEffect(() => {
    const googleError = search.get('error');
    if (googleError) setError(googleErrorMessage(googleError));
  }, [search]);

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
      if (!adminOnly && result.user.role === 'ADMIN') {
        await apiClient.post('/api/auth/logout', undefined, { auth: false });
        setError('Admin accounts must sign in from /admin.');
        return;
      }
      memoryTokenStore.setAccessToken(result.accessToken);
      onAuthenticated?.();
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
      if (!adminOnly && result.user.role === 'ADMIN') {
        await apiClient.post('/api/auth/logout', undefined, { auth: false });
        setError('Admin accounts must sign in from /admin.');
        return;
      }
      memoryTokenStore.setAccessToken(result.accessToken);
      onAuthenticated?.();
      router.push(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? otpMessage(err.code, err.message) : authErrorMessage(err, 'Could not verify OTP.'));
    } finally {
      setBusy(false);
    }
  }

  const canResend = seconds === 0;

  const body = (
    <>
      <Segmented label="Sign-in method" value={mode} options={METHODS} onChange={setMode} />

      {error ? <Alert>{error}</Alert> : null}
      {otpSent && mode === 'otp' && !error ? (
        <Notice>Code sent. Enter it below to continue.</Notice>
      ) : null}

      {mode === 'email' ? (
        <form className={styles.stack} onSubmit={submitEmail} style={{ marginTop: 'var(--space-5)' }}>
          <Input
            id="email"
            label={adminOnly ? 'Admin email' : 'Email'}
            type="text"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <PasswordField
            id="password"
            label="Password"
            autoComplete="current-password"
            minLength={8}
            value={password}
            onChange={setPassword}
          />
          <Button className={styles.submit} type="submit" block disabled={busy} loading={busy}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      ) : (
        <form
          className={styles.stack}
          style={{ marginTop: 'var(--space-5)' }}
          onSubmit={otpSent ? verifyOtp : (event) => { event.preventDefault(); void requestOtp(); }}
        >
          <Input
            id="phone"
            label="Mobile number"
            inputMode="numeric"
            autoComplete="tel-national"
            pattern="[6-9][0-9]{9}"
            placeholder="10-digit Indian mobile"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          {otpSent ? (
            <Input
              id="otp"
              label="One-time code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          ) : null}
          <Button className={styles.submit} type="submit" block disabled={busy} loading={busy}>
            {busy ? 'Please wait…' : otpSent ? 'Verify and sign in' : 'Send code'}
          </Button>
          {otpSent ? (
            <Button type="button" variant="ghost" block disabled={!canResend || busy} onClick={() => void requestOtp()}>
              {canResend ? 'Resend code' : `Resend in ${seconds}s`}
            </Button>
          ) : null}
        </form>
      )}

      {!adminOnly ? (
        <>
          <Divider>or</Divider>
          <GoogleButton
            label="Continue with Google"
            disabled={busy}
            onClick={() => window.location.assign(`/api/auth/google?next=${encodeURIComponent(next)}`)}
          />

          <div className={styles.foot}>
            New to {"Baagly"}? <Link href="/auth/register">Create an account</Link>
          </div>

          <div className={styles.hostCta}>
            <p className={styles.hostCtaTitle}>Have a property to rent out?</p>
            <p className={styles.hostCtaNote}>
              List a farmhouse, villa or party house and take bookings from verified guests.
            </p>
            <Button href="/auth/register?role=OWNER" variant="secondary" size="sm">
              Become a host
            </Button>
          </div>
        </>
      ) : null}
    </>
  );

  // Inside the admin panel the form is embedded, so it renders without the
  // marketing column or its own page container.
  if (adminOnly) {
    return (
      <div className={styles.card} style={{ maxWidth: '27rem', margin: 'var(--space-10) auto' }}>
        <p className={styles.kicker}>Restricted</p>
        <h1 className={styles.title}>Admin sign in</h1>
        <p className={styles.subtitle}>Access is enforced by the API, not by hiding screens.</p>
        {body}
      </div>
    );
  }

  return (
    <AuthShell kicker="Welcome back" title="Sign in" subtitle="Pick up where you left off.">
      {body}
    </AuthShell>
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

  /** Keeps the choice in the URL so a refresh or shared link lands the same way. */
  function chooseRole(role: 'CUSTOMER' | 'OWNER') {
    router.replace(role === 'OWNER' ? '/auth/register?role=OWNER' : '/auth/register', {
      scroll: false,
    });
  }

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
    <AuthShell
      kicker="Get started"
      title={asHost ? 'Create a host account' : 'Create your account'}
      subtitle={
        asHost
          ? 'List your property and start taking bookings.'
          : 'Book private farmhouses, villas and party houses across India.'
      }
    >
      <AccountTypeChooser value={asHost ? 'OWNER' : 'CUSTOMER'} onChange={chooseRole} />

      <Segmented label="Sign-up method" value={mode} options={METHODS} onChange={setMode} />

      {error ? <Alert>{error}</Alert> : null}
      {otpSent && mode === 'otp' && !error ? (
        <Notice>Code sent. Enter it below to continue.</Notice>
      ) : null}

      {mode === 'email' ? (
        <form className={styles.stack} onSubmit={submitEmail} style={{ marginTop: 'var(--space-5)' }}>
          <Input
            id="name"
            label="Full name"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            id="reg-email"
            label="Email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            id="reg-phone"
            label="Mobile (optional)"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="10-digit Indian mobile"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <PasswordField
            id="reg-password"
            label="Password"
            autoComplete="new-password"
            value={password}
            onChange={setPassword}
            hint={passwordHint}
          />
          <Button className={styles.submit} type="submit" block disabled={busy} loading={busy}>
            {busy ? 'Creating…' : asHost ? 'Create host account' : 'Create account'}
          </Button>
        </form>
      ) : (
        <form
          className={styles.stack}
          style={{ marginTop: 'var(--space-5)' }}
          onSubmit={otpSent ? verifyOtp : (event) => { event.preventDefault(); void requestOtp(); }}
        >
          <Input
            id="otp-name"
            label="Full name"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            id="otp-phone"
            label="Mobile number"
            required
            inputMode="numeric"
            autoComplete="tel-national"
            pattern="[6-9][0-9]{9}"
            placeholder="10-digit Indian mobile"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          {otpSent ? (
            <Input
              id="otp-code"
              label="One-time code"
              required
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
          ) : null}
          <Button className={styles.submit} type="submit" block disabled={busy} loading={busy}>
            {busy ? 'Please wait…' : otpSent ? 'Verify and continue' : 'Send code'}
          </Button>
          {otpSent ? (
            <Button type="button" variant="ghost" block disabled={seconds > 0 || busy} onClick={() => void requestOtp()}>
              {seconds > 0 ? `Resend in ${seconds}s` : 'Resend code'}
            </Button>
          ) : null}
        </form>
      )}

      <Divider>or</Divider>
      <GoogleButton
        label="Continue with Google"
        disabled={busy}
        onClick={() =>
          window.location.assign(
            `/api/auth/google?next=${encodeURIComponent(asHost ? '/host' : '/dashboard')}`,
          )
        }
      />

      <div className={styles.foot}>
        Already have an account? <Link href="/auth/login">Sign in</Link>
        <p className={styles.footNote}>
          {asHost
            ? 'Hosts verify a mobile number and submit Aadhaar and PAN before a listing goes live.'
            : 'You can switch to hosting later from your account.'}
        </p>
      </div>
    </AuthShell>
  );
}
