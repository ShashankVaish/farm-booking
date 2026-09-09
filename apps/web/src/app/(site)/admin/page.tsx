'use client';

import Link from 'next/link';
import { formatDateTime, formatInr, occupancyPercent, statusLabel } from '@/lib/admin/format';
import { adminApi } from '@/lib/admin/api';
import type { AdminOverview } from '@/lib/admin/types';
import { QueryGate, useAdminQuery } from '@/components/admin/use-admin-query';
import styles from './admin.module.css';

const STATS: Array<{ key: keyof AdminOverview; label: string; format?: (value: AdminOverview) => string }> = [
  { key: 'totalBookings', label: 'Total bookings' },
  { key: 'todaysBookings', label: "Today's bookings" },
  { key: 'revenue', label: 'Revenue', format: (d) => formatInr(d.revenue) },
  { key: 'platformCommission', label: 'Platform commission', format: (d) => formatInr(d.platformCommission) },
  { key: 'pendingPayments', label: 'Pending payments' },
  { key: 'refunds', label: 'Refunds' },
  { key: 'users', label: 'Users' },
  { key: 'owners', label: 'Owners' },
  { key: 'properties', label: 'Properties' },
  { key: 'occupancy', label: 'Occupancy (30d)', format: (d) => occupancyPercent(d.occupancy) },
];

export default function AdminDashboardPage() {
  const { data, error, loading, reload } = useAdminQuery(() => adminApi.overview(), []);

  return (
    <QueryGate loading={loading} error={error} onRetry={reload} label="Loading dashboard">
      {data ? (
        <div>
          <p className="t-label">Operations</p>
          <h1 className="t-h2">Admin overview</h1>
          <div className={styles.stats} style={{ marginTop: 'var(--space-6)' }}>
            {STATS.map((stat) => (
              <article key={stat.key} className={styles.stat}>
                <p className="t-caption">{stat.label}</p>
                <p className={styles.statValue}>
                  {stat.format ? stat.format(data) : String(data[stat.key])}
                </p>
              </article>
            ))}
          </div>

          <section className={styles.panel} style={{ marginTop: 'var(--space-8)' }}>
            <h2 className="t-h3">Recent activity</h2>
            <p className="t-caption">Audit log of moderation, payments, and account changes.</p>
            {data.recentActivity.length === 0 ? (
              <p className="t-body-small" style={{ marginTop: 'var(--space-4)' }}>
                No audited actions yet.
              </p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, marginTop: 'var(--space-4)' }}>
                {data.recentActivity.map((event) => (
                  <li key={event.id} className={styles.listRow}>
                    <div>
                      <p className="t-body">{statusLabel(event.action)}</p>
                      <p className="t-caption">
                        {event.entityType}
                        {event.entityId ? ` · ${event.entityId}` : ''}
                        {event.actor ? ` · ${event.actor.email}` : ''}
                      </p>
                    </div>
                    <p className="t-caption">{formatDateTime(event.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
            <p className="t-body-small" style={{ marginTop: 'var(--space-4)' }}>
              <Link href="/admin/reports">Open reports</Link>
            </p>
          </section>
        </div>
      ) : null}
    </QueryGate>
  );
}
