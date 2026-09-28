'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/forms';
import { Switch } from '@/components/ui/switch';
import { adminUi } from '@/components/admin/admin-kit';
import { QueryGate, useAdminQuery } from '@/components/admin/use-admin-query';
import { useToast } from '@/components/providers/toast-provider';
import { adminApi } from '@/lib/admin/api';
import type { AdminSettings } from '@/lib/admin/types';
import { ApiError } from '@/lib/api/errors';

const FEE_MIN = 0;
const FEE_MAX = 3000;
const HOLD_MIN = 5;
const HOLD_MAX = 1440;

export default function AdminSettingsPage() {
  const { notify } = useToast();
  const { data, error, loading, reload, setData } = useAdminQuery<AdminSettings>(
    () => adminApi.settings(),
    [],
  );

  const [feeBps, setFeeBps] = useState('');
  const [holdMinutes, setHoldMinutes] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [kycBusy, setKycBusy] = useState(false);

  // Saved on its own, the moment it is switched: it is a policy decision, not
  // a number to fine-tune alongside the others.
  async function setKycRequired(required: boolean) {
    setKycBusy(true);
    try {
      const next = await adminApi.updateSettings({ hostKycRequired: required });
      setData(next);
      notify(
        required
          ? 'Hosts must now submit Aadhaar and PAN before listing. This is audited.'
          : 'Aadhaar and PAN are now optional for hosts. This is audited.',
      );
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not change the setting.', 'error');
    } finally {
      setKycBusy(false);
    }
  }

  // Seed the inputs once the current values arrive.
  useEffect(() => {
    if (!data) return;
    setFeeBps(String(data.platformFeeBps));
    setHoldMinutes(String(data.bookingExpireMinutes));
  }, [data]);

  const fee = Number(feeBps);
  const hold = Number(holdMinutes);
  const feeValid = Number.isInteger(fee) && fee >= FEE_MIN && fee <= FEE_MAX;
  const holdValid = Number.isInteger(hold) && hold >= HOLD_MIN && hold <= HOLD_MAX;
  const dirty =
    data !== null &&
    (fee !== data.platformFeeBps || hold !== data.bookingExpireMinutes);

  async function save() {
    if (!feeValid || !holdValid) {
      setFormError('Fix the highlighted fields before saving.');
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      const next = await adminApi.updateSettings({
        platformFeeBps: fee,
        bookingExpireMinutes: hold,
      });
      setData(next);
      notify('Settings saved. New bookings use these values immediately.');
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not save settings.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="t-label">Platform</p>
      <h1 className="t-h2">Settings</h1>
      <p className="t-body-small" style={{ marginTop: 'var(--space-2)', maxWidth: '46rem' }}>
        Changes apply to new quotes and bookings straight away; bookings already in progress keep
        the values they were created with. Payment secrets and webhook keys live in the server
        environment and are never editable here.
      </p>

      <QueryGate loading={loading} error={error} onRetry={reload} label="Loading settings">
        {data ? (
          <>
            <section
              className={adminUi.panel}
              style={{ marginTop: 'var(--space-6)', maxWidth: '40rem' }}
            >
              <h2 className="t-h4" style={{ marginBottom: 'var(--space-4)' }}>
                Editable
              </h2>

              <Input
                id="platform-fee"
                label="Platform fee (basis points)"
                type="number"
                inputMode="numeric"
                min={FEE_MIN}
                max={FEE_MAX}
                step={25}
                value={feeBps}
                onChange={(event) => setFeeBps(event.target.value)}
                hint={
                  feeValid
                    ? `${(fee / 100).toFixed(2)}% commission on each booking`
                    : undefined
                }
                error={
                  feeValid ? undefined : `Enter a whole number between ${FEE_MIN} and ${FEE_MAX}.`
                }
              />

              <div style={{ marginTop: 'var(--space-4)' }}>
                <Input
                  id="booking-hold"
                  label="Booking hold (minutes)"
                  type="number"
                  inputMode="numeric"
                  min={HOLD_MIN}
                  max={HOLD_MAX}
                  step={5}
                  value={holdMinutes}
                  onChange={(event) => setHoldMinutes(event.target.value)}
                  hint={
                    holdValid
                      ? 'How long an unpaid booking holds its dates before expiring'
                      : undefined
                  }
                  error={
                    holdValid
                      ? undefined
                      : `Enter a whole number between ${HOLD_MIN} and ${HOLD_MAX}.`
                  }
                />
              </div>

              {formError ? (
                <p
                  className="t-body-small"
                  role="alert"
                  style={{ color: 'var(--color-error)', marginTop: 'var(--space-3)' }}
                >
                  {formError}
                </p>
              ) : null}

              <div className={adminUi.actions} style={{ marginTop: 'var(--space-5)' }}>
                <Button onClick={() => void save()} disabled={busy || !dirty}>
                  {busy ? 'Saving…' : 'Save changes'}
                </Button>
                <Button
                  variant="ghost"
                  disabled={busy || !dirty}
                  onClick={() => {
                    setFeeBps(String(data.platformFeeBps));
                    setHoldMinutes(String(data.bookingExpireMinutes));
                    setFormError(null);
                  }}
                >
                  Reset
                </Button>
              </div>
            </section>

            <section
              className={adminUi.panel}
              style={{ marginTop: 'var(--space-5)', maxWidth: '40rem' }}
            >
              <h2 className="t-h4" style={{ marginBottom: 'var(--space-2)' }}>
                Host verification
              </h2>
              <p className="t-body-small" style={{ marginBottom: 'var(--space-4)' }}>
                When on, a host must submit their Aadhaar and PAN before a listing can be sent for
                review. When off, the documents are optional; hosts can still add them, and a
                verified mobile number is always required. Changes apply immediately and are recorded
                in the audit log.
              </p>
              <Switch
                label="Require Aadhaar and PAN from hosts"
                checked={data.hostKycRequired !== false}
                disabled={kycBusy}
                onCheckedChange={(checked) => void setKycRequired(checked)}
              />
              <p className="t-caption" style={{ marginTop: 'var(--space-2)' }}>
                {data.hostKycRequired !== false
                  ? 'Required: listings cannot be submitted without them.'
                  : 'Optional: hosts can list without submitting them.'}
              </p>
            </section>

            <section
              className={adminUi.panel}
              style={{ marginTop: 'var(--space-5)', maxWidth: '40rem' }}
            >
              <h2 className="t-h4" style={{ marginBottom: 'var(--space-4)' }}>
                From the server environment
              </h2>
              <dl className={adminUi.dl}>
                <dt className="t-caption">Environment</dt>
                <dd>{data.environment ?? '—'}</dd>
                <dt className="t-caption">Payment provider</dt>
                <dd>{data.paymentProvider}</dd>
                <dt className="t-caption">Gateway credentials</dt>
                <dd>
                  {data.paymentConfigured ? 'API key and token configured on server' : 'Not configured'}
                  {data.paymentConfigured && !data.webhookVerification
                    ? ' · no webhook username/password, so webhooks cannot be verified'
                    : ''}
                </dd>
                <dt className="t-caption">SMS provider</dt>
                <dd>
                  {data.smsProvider}
                  {data.smsConfigured ? '' : ' — codes are only logged, not sent'}
                </dd>
                <dt className="t-caption">WhatsApp</dt>
                <dd>
                  {data.whatsappConfigured
                    ? 'Meta Cloud API — sent to opted-in, verified phones'
                    : 'Not configured — nothing is sent on WhatsApp'}
                </dd>
                {/*
                  A mail transport that logs instead of sending looks identical
                  to a working one from the outside, which is how OTP delivery
                  stayed broken unnoticed. Say it plainly here.
                */}
                <dt className="t-caption">Email</dt>
                <dd>
                  {data.mailProvider}
                  {data.mailConfigured
                    ? data.mailFrom
                      ? ` — sending as ${data.mailFrom}`
                      : ''
                    : ' — emails are only logged, not sent'}
                </dd>
              </dl>
            </section>
          </>
        ) : null}
      </QueryGate>
    </div>
  );
}
