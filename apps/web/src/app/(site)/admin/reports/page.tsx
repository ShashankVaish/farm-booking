'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/forms';
import { FilterForm, adminUi } from '@/components/admin/admin-kit';
import { QueryGate, useAdminQuery } from '@/components/admin/use-admin-query';
import { adminApi } from '@/lib/admin/api';
import { formatInr, statusLabel } from '@/lib/admin/format';
import type { AdminReports } from '@/lib/admin/types';
import styles from '../admin.module.css';

function monthStart() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function AdminReportsPage() {
  const [draft, setDraft] = useState({ from: monthStart(), to: today() });
  const [applied, setApplied] = useState(draft);

  const { data, error, loading, reload } = useAdminQuery<AdminReports>(
    () => adminApi.reports({ from: applied.from, to: applied.to }),
    [applied],
  );

  return (
    <div>
      <p className="t-label">Insights</p>
      <h1 className="t-h2">Reports</h1>
      <FilterForm onSubmit={() => setApplied(draft)}>
        <Input id="from" label="From" type="date" value={draft.from} onChange={(e) => setDraft({ ...draft, from: e.target.value })} />
        <Input id="to" label="To" type="date" value={draft.to} onChange={(e) => setDraft({ ...draft, to: e.target.value })} />
      </FilterForm>
      <QueryGate loading={loading} error={error} onRetry={reload} label="Loading reports">
        {data ? (
          <>
            <p className="t-caption">
              {data.from} → {data.to}
            </p>
            <div className={styles.stats} style={{ marginTop: 'var(--space-4)' }}>
              <article className={styles.stat}>
                <p className="t-caption">Confirmed bookings</p>
                <p className={styles.statValue}>{data.confirmedBookings}</p>
              </article>
              <article className={styles.stat}>
                <p className="t-caption">Revenue</p>
                <p className={styles.statValue}>{formatInr(data.revenue)}</p>
              </article>
              <article className={styles.stat}>
                <p className="t-caption">Commission</p>
                <p className={styles.statValue}>{formatInr(data.platformCommission)}</p>
              </article>
              <article className={styles.stat}>
                <p className="t-caption">Refunded</p>
                <p className={styles.statValue}>{formatInr(data.refundedAmount)}</p>
              </article>
              <article className={styles.stat}>
                <p className="t-caption">Completed refunds</p>
                <p className={styles.statValue}>{data.completedRefunds}</p>
              </article>
              <article className={styles.stat}>
                <p className="t-caption">New users</p>
                <p className={styles.statValue}>{data.newUsers}</p>
              </article>
              <article className={styles.stat}>
                <p className="t-caption">New properties</p>
                <p className={styles.statValue}>{data.newProperties}</p>
              </article>
            </div>
            <section className={adminUi.panel} style={{ marginTop: 'var(--space-6)' }}>
              <h2 className="t-h3">Bookings by status</h2>
              <table className={adminUi.table}>
                <thead>
                  <tr>
                    <th>Status</th>
                    <th>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {data.bookings.map((row) => (
                    <tr key={row.status}>
                      <td>{statusLabel(row.status)}</td>
                      <td>{row.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </>
        ) : null}
      </QueryGate>
    </div>
  );
}
