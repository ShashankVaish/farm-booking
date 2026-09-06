'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/forms';
import { ErrorState, Spinner } from '@/components/ui/feedback';
import { hostApi, type OwnerProfile } from '@/lib/host/host-api';
import { ApiError } from '@/lib/api/errors';
import { useToast } from '@/components/providers/toast-provider';
import styles from '../host.module.css';

export default function HostSettingsPage() {
  const { notify } = useToast();
  const [profile, setProfile] = useState<OwnerProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [panNumber, setPanNumber] = useState('');

  useEffect(() => {
    hostApi
      .profile()
      .then((result) => {
        setProfile(result);
        setName(result.name);
        setBusinessName(result.ownerProfile?.businessName ?? '');
        setGstNumber(result.ownerProfile?.gstNumber ?? '');
        setPanNumber(result.ownerProfile?.panNumber ?? '');
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load settings.'))
      .finally(() => setLoading(false));
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await hostApi.updateProfile({ name, businessName, gstNumber, panNumber });
      setProfile(result);
      notify('Host profile saved.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save settings.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Spinner label="Loading settings" />;
  if (error && !profile) return <ErrorState description={error} />;

  return (
    <div>
      <p className="t-label">Account</p>
      <h1 className="t-h2">Settings</h1>
      <form className={styles.panel} onSubmit={(event) => void save(event)} style={{ maxWidth: '32rem' }}>
        {error ? (
          <p className="t-body-small" role="alert">
            {error}
          </p>
        ) : null}
        <Input id="host-name" label="Name" value={name} onChange={(e) => setName(e.target.value)} />
        <Input id="business" label="Business name" value={businessName} onChange={(e) => setBusinessName(e.target.value)} />
        <Input id="gst" label="GST number" value={gstNumber} onChange={(e) => setGstNumber(e.target.value)} />
        <Input id="pan" label="PAN" value={panNumber} onChange={(e) => setPanNumber(e.target.value)} />
        <p className="t-caption">
          KYC: {profile?.ownerProfile?.kycVerified ? 'Verified' : 'Pending review'} · Email {profile?.email}
        </p>
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </Button>
      </form>
    </div>
  );
}
