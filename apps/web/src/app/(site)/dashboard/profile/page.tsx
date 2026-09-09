'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/forms';
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

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const mobile = indianMobile(phone);
      if (phone.trim() && !mobile) {
        setError('Enter a valid 10-digit Indian mobile number, or leave it blank.');
        return;
      }
      const result = await apiClient.patch<AuthUser>('/api/auth/me', {
        name: name.trim(),
        ...(mobile ? { phone: mobile } : {}),
      });
      setUser(result);
      notify('Profile saved.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save profile.');
    } finally {
      setBusy(false);
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
        <Input id="profile-phone" label="Mobile" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </Button>
      </form>
    </div>
  );
}
