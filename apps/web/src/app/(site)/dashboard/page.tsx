'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, Spinner } from '@/components/ui/feedback';
import { bookingApi } from '@/lib/bookings/api';
import { isUpcoming, paymentStatusLabel, type CustomerBooking } from '@/lib/bookings/types';
import { ApiError } from '@/lib/api/errors';
import { hostApi, type HostNotification } from '@/lib/host/host-api';
import styles from './dashboard.module.css';

export default function DashboardPage() {
  const [trips, setTrips] = useState<CustomerBooking[]>([]);
  const [notes, setNotes] = useState<HostNotification[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    Promise.all([
      bookingApi.mine(),
      hostApi.notifications().catch(() => ({ items: [] as HostNotification[] })),
    ])
      .then(([bookings, notifications]) => {
        setTrips(bookings.items);
        setNotes(notifications.items);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load your account.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) return <Spinner label="Loading dashboard" />;
  if (error) return <ErrorState description={error} onRetry={load} />;

  const upcoming = trips.filter((trip) => isUpcoming(trip));

  return (
    <div>
      <p className="t-label">Account</p>
      <h1 className="t-h2">Your stays</h1>
      <section className={styles.panel} style={{ marginTop: 'var(--space-6)' }}>
        <h2 className="t-h3">Upcoming</h2>
        {upcoming.length === 0 ? (
          <EmptyState title="No upcoming trips" description="Find a farmhouse and reserve dates when you are ready." actionHref="/explore" actionLabel="Explore stays" />
        ) : (
          <ul className={styles.list}>
            {upcoming.slice(0, 3).map((trip) => (
              <li key={trip.id} className={styles.row}>
                <div>
                  <Link href={`/dashboard/trips/${trip.id}`}>{trip.property.title}</Link>
                  <p className="t-caption">
                    {trip.checkInDate.slice(0, 10)} → {trip.checkOutDate.slice(0, 10)} · {paymentStatusLabel(trip)}
                  </p>
                </div>
                <Button href={`/booking/${trip.id}`} size="sm" variant="secondary">
                  Open
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className={styles.panel} style={{ marginTop: 'var(--space-6)' }}>
        <h2 className="t-h3">Notifications</h2>
        {notes.length === 0 ? (
          <p className="t-body-small">No notifications yet.</p>
        ) : (
          <ul className={styles.list}>
            {notes.slice(0, 4).map((note) => (
              <li key={note.id} className={styles.row}>
                <div>
                  <p className="t-body">{note.title}</p>
                  <p className="t-caption">{note.body}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
        <Button href="/dashboard/notifications" variant="ghost" size="sm">
          All notifications
        </Button>
      </section>
    </div>
  );
}
