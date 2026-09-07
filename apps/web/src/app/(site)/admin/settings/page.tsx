'use client';

import { adminUi } from '@/components/admin/admin-kit';
import { QueryGate, useAdminQuery } from '@/components/admin/use-admin-query';
import { adminApi } from '@/lib/admin/api';
import type { AdminSettings } from '@/lib/admin/types';

export default function AdminSettingsPage() {
  const { data, error, loading, reload } = useAdminQuery<AdminSettings>(() => adminApi.settings(), []);

  return (
    <div>
      <p className="t-label">Platform</p>
      <h1 className="t-h2">Settings</h1>
      <p className="t-body-small">
        Runtime configuration from the server. Payment secrets and webhook keys are never exposed to this panel.
      </p>
      <QueryGate loading={loading} error={error} onRetry={reload} label="Loading settings">
        {data ? (
          <section className={adminUi.panel} style={{ marginTop: 'var(--space-6)', maxWidth: '36rem' }}>
            <dl className={adminUi.dl}>
              <dt className="t-caption">Environment</dt>
              <dd>{data.environment ?? '—'}</dd>
              <dt className="t-caption">Platform fee</dt>
              <dd>
                {data.platformFeePercent}% ({data.platformFeeBps} bps)
              </dd>
              <dt className="t-caption">Booking hold</dt>
              <dd>{data.bookingExpireMinutes} minutes</dd>
              <dt className="t-caption">Payment provider</dt>
              <dd>{data.paymentProvider}</dd>
              <dt className="t-caption">Razorpay</dt>
              <dd>{data.razorpayConfigured ? 'Key configured on server' : 'Not configured'}</dd>
            </dl>
          </section>
        ) : null}
      </QueryGate>
    </div>
  );
}
