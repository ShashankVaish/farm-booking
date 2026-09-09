'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/forms';
import { EmptyState, ErrorState, Spinner } from '@/components/ui/feedback';
import { PriceBreakdown } from '@/components/hospitality/price-breakdown';
import { bookingApi } from '@/lib/bookings/api';
import { paymentStatusLabel, type CustomerBooking, type PriceQuote } from '@/lib/bookings/types';
import { ApiError, NetworkError } from '@/lib/api/errors';
import { useToast } from '@/components/providers/toast-provider';
import styles from '../../dashboard.module.css';

function quoteFromBooking(booking: CustomerBooking): PriceQuote {
  return {
    nights: 1,
    baseAmount: String(booking.baseAmount),
    weekendAmount: String(booking.weekendAmount),
    extraGuestAmount: String(booking.extraGuestAmount),
    platformFee: String(booking.platformFee),
    discountAmount: String(booking.discountAmount),
    totalAmount: String(booking.totalAmount),
  };
}

export default function TripDetailPage() {
  const params = useParams<{ id: string }>();
  const { notify } = useToast();
  const [booking, setBooking] = useState<CustomerBooking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  function load() {
    setLoading(true);
    bookingApi
      .get(params.id)
      .then(setBooking)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load this trip.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function cancel() {
    if (!booking) return;
    setBusy(true);
    try {
      await bookingApi.cancel(booking.id, reason || undefined);
      notify('Booking cancelled.');
      load();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof NetworkError ? err.message : 'Could not cancel.');
    } finally {
      setBusy(false);
    }
  }

  async function submitReview(event: FormEvent) {
    event.preventDefault();
    if (!booking) return;
    setBusy(true);
    try {
      await bookingApi.review(booking.property.id, { bookingId: booking.id, rating, comment: comment || undefined });
      notify('Review submitted.');
      load();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof NetworkError ? err.message : 'Could not submit review.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Spinner label="Loading trip" />;
  if (error && !booking) return <ErrorState description={error} onRetry={load} />;
  if (!booking) return <EmptyState title="Trip not found" description="This booking is not in your account." />;

  const canCancel = ['PENDING', 'PAYMENT_PENDING', 'CONFIRMED'].includes(booking.status);
  const canReview = booking.status === 'COMPLETED' && !booking.review;
  const canPay = booking.status === 'PENDING' || booking.status === 'PAYMENT_PENDING';

  return (
    <div className={styles.panel}>
      <p className="t-label">Trip</p>
      <h1 className="t-h2">{booking.property.title}</h1>
      <p className={styles.badge}>{paymentStatusLabel(booking)}</p>
      <p className="t-body-small">Booking ID {booking.id}</p>
      <p className="t-body-small">
        {booking.checkInDate.slice(0, 10)} → {booking.checkOutDate.slice(0, 10)} · {booking.guestCount} guests
      </p>
      <PriceBreakdown quote={quoteFromBooking(booking)} disclaimer={false} />
      <h2 className="t-h3">Cancellation policy</h2>
      <p className="t-body-small">{booking.property.cancellationPolicy || 'See the property listing for cancellation terms.'}</p>
      {error ? (
        <p className="t-body-small" role="alert" style={{ color: 'var(--color-error)' }}>
          {error}
        </p>
      ) : null}
      {canPay ? (
        <div style={{ marginTop: 'var(--space-4)' }}>
          <Button href={`/booking/${booking.id}`}>Continue payment</Button>
        </div>
      ) : null}
      {canCancel ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void cancel();
          }}
          style={{ marginTop: 'var(--space-6)' }}
        >
          <Textarea id="reason" label="Cancel reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
          <Button type="submit" variant="danger" disabled={busy}>
            {busy ? 'Cancelling…' : 'Cancel booking'}
          </Button>
        </form>
      ) : null}
      {canReview ? (
        <form onSubmit={submitReview} style={{ marginTop: 'var(--space-6)' }}>
          <h2 className="t-h3">Write a review</h2>
          <Input id="rating" label="Rating" type="number" min={1} max={5} value={rating} onChange={(e) => setRating(Number(e.target.value))} />
          <Textarea id="comment" label="Comment" value={comment} onChange={(e) => setComment(e.target.value)} rows={4} />
          <Button type="submit" disabled={busy}>
            Submit review
          </Button>
        </form>
      ) : null}
    </div>
  );
}
