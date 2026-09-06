'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, Spinner } from '@/components/ui/feedback';
import { hostApi, type OwnerBooking } from '@/lib/host/host-api';
import { ApiError } from '@/lib/api/errors';
import styles from '../host.module.css';

function money(value: string | number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value));
}

export default function HostBookingsPage() {
  const [items, setItems] = useState<OwnerBooking[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  function load() {
    setLoading(true);
    hostApi
      .bookings()
      .then((result) => setItems(result.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load bookings.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) return <Spinner label="Loading bookings" />;
  if (error) return <ErrorState description={error} onRetry={load} />;

  return (
    <div>
      <p className="t-label">Guests</p>
      <h1 className="t-h2">Bookings</h1>
      <p className="t-body-small">Booking status is managed by the platform. You can mark a stay complete after check-out.</p>
      {message ? <p className="t-body-small">{message}</p> : null}
      {items.length === 0 ? (
        <EmptyState title="No bookings yet" description="Confirmed reservations will appear here." />
      ) : (
        <div style={{ overflowX: 'auto', marginTop: 'var(--space-6)' }}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Stay</th>
                <th>Guest</th>
                <th>Dates</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((booking) => (
                <tr key={booking.id}>
                  <td>{booking.property.title}</td>
                  <td>
                    {booking.customer.name}
                    <div className="t-caption">{booking.customer.email}</div>
                  </td>
                  <td>
                    {booking.checkInDate.slice(0, 10)} → {booking.checkOutDate.slice(0, 10)}
                  </td>
                  <td>{money(booking.totalAmount)}</td>
                  <td>
                    <span className={styles.badge}>{booking.status.replaceAll('_', ' ')}</span>
                    {booking.status === 'CONFIRMED' ? (
                      <div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setMessage(null);
                            hostApi
                              .completeBooking(booking.id)
                              .then(() => load())
                              .catch((err) =>
                                setMessage(err instanceof ApiError ? err.message : 'Could not complete this booking.'),
                              );
                          }}
                        >
                          Mark complete
                        </Button>
                      </div>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
