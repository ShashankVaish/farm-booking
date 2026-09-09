'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, Spinner } from '@/components/ui/feedback';
import { bookingApi } from '@/lib/bookings/api';
import { isPastTrip, isUpcoming, paymentStatusLabel, type CustomerBooking } from '@/lib/bookings/types';
import { ApiError } from '@/lib/api/errors';
import styles from '../dashboard.module.css';

type Tab = 'upcoming' | 'past' | 'cancelled';

export default function TripsPage() {
  const [items, setItems] = useState<CustomerBooking[]>([]);
  const [tab, setTab] = useState<Tab>('upcoming');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    bookingApi
      .mine()
      .then((result) => setItems(result.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load trips.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (tab === 'cancelled') return items.filter((item) => item.status === 'CANCELLED' || item.status === 'EXPIRED');
    if (tab === 'past') return items.filter((item) => isPastTrip(item));
    return items.filter((item) => isUpcoming(item));
  }, [items, tab]);

  if (loading) return <Spinner label="Loading trips" />;
  if (error) return <ErrorState description={error} onRetry={load} />;

  return (
    <div>
      <p className="t-label">Account</p>
      <h1 className="t-h2">Trips</h1>
      <div className={styles.tabs}>
        {(['upcoming', 'past', 'cancelled'] as Tab[]).map((value) => (
          <Button key={value} size="sm" variant={tab === value ? 'primary' : 'secondary'} onClick={() => setTab(value)}>
            {value}
          </Button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <EmptyState title="Nothing here yet" description="Reservations will appear in the matching tab." actionHref="/explore" actionLabel="Find a stay" />
      ) : (
        <ul className={styles.list}>
          {filtered.map((trip) => (
            <li key={trip.id} className={styles.row}>
              <div>
                <Link href={`/dashboard/trips/${trip.id}`}>{trip.property.title}</Link>
                <p className="t-caption">
                  {trip.checkInDate.slice(0, 10)} → {trip.checkOutDate.slice(0, 10)} · {trip.guestCount} guests
                </p>
                <span className={styles.badge}>{paymentStatusLabel(trip)}</span>
              </div>
              <Button href={`/dashboard/trips/${trip.id}`} size="sm" variant="ghost">
                Details
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
