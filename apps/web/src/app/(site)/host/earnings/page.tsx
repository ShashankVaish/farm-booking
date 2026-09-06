'use client';

import { useEffect, useState } from 'react';
import { EmptyState, ErrorState, Spinner } from '@/components/ui/feedback';
import { hostApi, type OwnerOverview } from '@/lib/host/host-api';
import { ApiError } from '@/lib/api/errors';
import styles from '../host.module.css';

function money(value: string | number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value));
}

export default function HostEarningsPage() {
  const [data, setData] = useState<OwnerOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    hostApi
      .earnings()
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load earnings.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) return <Spinner label="Loading earnings" />;
  if (error) return <ErrorState description={error} onRetry={load} />;
  if (!data) return <EmptyState title="No earnings yet" description="Completed stays will add to this summary." />;

  return (
    <div>
      <p className="t-label">Payouts</p>
      <h1 className="t-h2">Earnings</h1>
      <div className={styles.stats} style={{ marginTop: 'var(--space-6)' }}>
        <article className={styles.stat}>
          <p className="t-caption">Gross</p>
          <p className={styles.statValue}>{money(data.grossAmount)}</p>
        </article>
        <article className={styles.stat}>
          <p className="t-caption">Platform fees</p>
          <p className={styles.statValue}>{money(data.platformFees)}</p>
        </article>
        <article className={styles.stat}>
          <p className="t-caption">Net</p>
          <p className={styles.statValue}>{money(data.netAmount)}</p>
        </article>
        <article className={styles.stat}>
          <p className="t-caption">Bookings</p>
          <p className={styles.statValue}>{data.bookingCount}</p>
        </article>
      </div>
      <section className={styles.panel} style={{ marginTop: 'var(--space-6)' }}>
        <h2 className="t-h3">Listings by status</h2>
        {data.propertyStatus?.length ? (
          <ul>
            {data.propertyStatus.map((row) => (
              <li key={row.status}>
                {row.status.replaceAll('_', ' ')} · {row.count}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No listing totals" description="Your properties will group here by review status." />
        )}
      </section>
    </div>
  );
}
