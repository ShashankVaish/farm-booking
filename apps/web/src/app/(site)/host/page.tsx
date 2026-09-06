'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, Spinner } from '@/components/ui/feedback';
import { hostApi, type HostNotification, type OwnerOverview } from '@/lib/host/host-api';
import { ApiError } from '@/lib/api/errors';
import styles from './host.module.css';

function money(value: string | number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value));
}

export default function HostDashboardPage() {
  const [data, setData] = useState<OwnerOverview | null>(null);
  const [notes, setNotes] = useState<HostNotification[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    setError(null);
    Promise.all([hostApi.overview(), hostApi.notifications().catch(() => ({ items: [] as HostNotification[] }))])
      .then(([overview, notifications]) => {
        setData(overview);
        setNotes(notifications.items);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load the dashboard.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) return <Spinner label="Loading dashboard" />;
  if (error) return <ErrorState description={error} onRetry={load} />;
  if (!data) return null;

  return (
    <div>
      <p className="t-label">Host</p>
      <h1 className="t-h2">Overview</h1>
      <div className={styles.stats} style={{ marginTop: 'var(--space-6)' }}>
        <article className={styles.stat}>
          <p className="t-caption">Properties</p>
          <p className={styles.statValue}>{data.propertyCount}</p>
        </article>
        <article className={styles.stat}>
          <p className="t-caption">Pending approval</p>
          <p className={styles.statValue}>{data.pendingApproval}</p>
        </article>
        <article className={styles.stat}>
          <p className="t-caption">Earnings (net)</p>
          <p className={styles.statValue}>{money(data.netAmount)}</p>
        </article>
        <article className={styles.stat}>
          <p className="t-caption">Occupancy (30d)</p>
          <p className={styles.statValue}>{Math.round(data.occupancy * 100)}%</p>
        </article>
      </div>
      <div className={styles.stats} style={{ marginTop: 'var(--space-4)' }}>
        <article className={styles.stat}>
          <p className="t-caption">Upcoming bookings</p>
          <p className={styles.statValue}>{data.upcomingBookings.length}</p>
        </article>
        <article className={styles.stat}>
          <p className="t-caption">Reviews</p>
          <p className={styles.statValue}>{data.reviewCount}</p>
          <p className="t-caption">Avg {Number(data.averageRating).toFixed(1)}</p>
        </article>
        <article className={styles.stat}>
          <p className="t-caption">Unread notices</p>
          <p className={styles.statValue}>{data.unreadNotifications}</p>
        </article>
      </div>

      <section className={styles.panel} style={{ marginTop: 'var(--space-8)' }}>
        <h2 className="t-h3">Upcoming stays</h2>
        {data.upcomingBookings.length === 0 ? (
          <EmptyState title="No upcoming bookings" description="Confirmed guest stays will appear here." />
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {data.upcomingBookings.map((booking) => (
              <li key={booking.id} className={styles.listRow}>
                <div>
                  <p className="t-body">{booking.property.title}</p>
                  <p className="t-caption">
                    {booking.checkInDate.slice(0, 10)} → {booking.checkOutDate.slice(0, 10)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
        <Button href="/host/bookings" variant="ghost" size="sm">
          All bookings
        </Button>
      </section>

      <section className={styles.panel} style={{ marginTop: 'var(--space-6)' }}>
        <h2 className="t-h3">Notifications</h2>
        {notes.length === 0 ? (
          <EmptyState title="You are all caught up" description="Approvals, bookings, and payouts will show here." />
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {notes.map((note) => (
              <li key={note.id} className={styles.listRow}>
                <div>
                  <p className="t-body">{note.title}</p>
                  <p className="t-caption">{note.body}</p>
                </div>
                {!note.readAt ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      void hostApi.markNotificationRead(note.id).then(() => load());
                    }}
                  >
                    Mark read
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="t-body-small" style={{ marginTop: 'var(--space-6)' }}>
        <Link href="/host/properties/new">Create a listing</Link>
      </p>
    </div>
  );
}
