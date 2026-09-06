'use client';

import Script from 'next/script';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, Spinner } from '@/components/ui/feedback';
import { PriceBreakdown } from '@/components/hospitality/price-breakdown';
import { bookingApi } from '@/lib/bookings/api';
import { paymentStatusLabel, type CustomerBooking, type PriceQuote } from '@/lib/bookings/types';
import { ApiError, NetworkError } from '@/lib/api/errors';
import { brand } from '@/lib/config/brand';
import styles from '@/app/(site)/dashboard/dashboard.module.css';

type RazorpaySuccess = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayCtor = new (options: Record<string, unknown>) => { open: () => void };

declare global {
  interface Window {
    Razorpay?: RazorpayCtor;
  }
}

function quoteFromBooking(booking: CustomerBooking): PriceQuote {
  return {
    nights: Math.max(
      1,
      Math.round(
        (new Date(booking.checkOutDate).getTime() - new Date(booking.checkInDate).getTime()) / 86400000,
      ),
    ),
    baseAmount: String(booking.baseAmount),
    weekendAmount: String(booking.weekendAmount),
    extraGuestAmount: String(booking.extraGuestAmount),
    platformFee: String(booking.platformFee),
    discountAmount: String(booking.discountAmount),
    totalAmount: String(booking.totalAmount),
    currency: booking.currency,
  };
}

export function BookingExperience({ bookingId, confirmation }: { bookingId: string; confirmation?: boolean }) {
  const router = useRouter();
  const [booking, setBooking] = useState<CustomerBooking | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const paying = useRef(false);

  const load = useCallback(() => {
    setLoading(true);
    bookingApi
      .get(bookingId)
      .then(setBooking)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load this booking.'))
      .finally(() => setLoading(false));
  }, [bookingId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (confirmation && booking && (booking.status === 'PENDING' || booking.status === 'PAYMENT_PENDING')) {
      router.replace(`/booking/${booking.id}`);
    }
  }, [confirmation, booking, router]);

  async function pay() {
    if (!booking || paying.current) return;
    paying.current = true;
    setBusy(true);
    setError(null);
    try {
      const order = await bookingApi.createOrder(booking.id);
      if (!order.keyId || !window.Razorpay) {
        setError(
          order.keyId
            ? 'Payment checkout is still loading. Try again in a moment.'
            : 'Payment is temporarily unavailable. Your booking is saved — refresh this page to retry.',
        );
        return;
      }
      const checkout = new window.Razorpay({
        key: order.keyId,
        amount: Math.round(Number(order.amount) * 100),
        currency: order.currency,
        name: brand.name,
        description: booking.property.title,
        order_id: order.providerOrderId,
        handler: async (response: RazorpaySuccess) => {
          try {
            await bookingApi.verify({
              providerOrderId: response.razorpay_order_id,
              providerPaymentId: response.razorpay_payment_id,
              signature: response.razorpay_signature,
            });
            router.replace(`/booking/${booking.id}/confirmation`);
            router.refresh();
          } catch (err) {
            setError(err instanceof ApiError || err instanceof NetworkError ? err.message : 'Payment could not be verified.');
            load();
          }
        },
        modal: {
          ondismiss: () => {
            setError('Payment was interrupted. You can try again without creating a new booking.');
            load();
          },
        },
      });
      checkout.open();
    } catch (err) {
      setError(err instanceof ApiError || err instanceof NetworkError ? err.message : 'Could not start payment.');
      load();
    } finally {
      paying.current = false;
      setBusy(false);
    }
  }

  if (loading) return <Spinner label="Loading booking" />;
  if (error && !booking) return <ErrorState description={error} onRetry={load} />;
  if (!booking) return null;

  const awaitingPay = booking.status === 'PENDING' || booking.status === 'PAYMENT_PENDING';
  const confirmed = booking.status === 'CONFIRMED' || booking.status === 'COMPLETED';
  const showConfirmation = confirmation || confirmed;

  return (
    <article className={styles.panel}>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
      <p className="t-label">Booking</p>
      <h1 className="t-h2">{showConfirmation ? 'Booking confirmed' : booking.property.title}</h1>
      <p className={styles.badge}>{paymentStatusLabel(booking)}</p>
      <p className="t-body-small">Booking ID {booking.id}</p>
      <p className="t-body">
        {booking.property.title}
        {booking.property.city ? ` · ${booking.property.city}` : ''}
      </p>
      <p className="t-body-small">
        {booking.checkInDate.slice(0, 10)} → {booking.checkOutDate.slice(0, 10)} · {booking.guestCount} guests
      </p>
      {booking.coupon?.code ? <p className="t-caption">Coupon {booking.coupon.code}</p> : null}
      <PriceBreakdown quote={quoteFromBooking(booking)} disclaimer={awaitingPay} />
      <h2 className="t-h3">Cancellation</h2>
      <p className="t-body-small">
        {booking.property.cancellationPolicy || booking.cancellationPolicy || 'Standard cancellation applies as shown on the property page.'}
      </p>

      {error ? (
        <p className="t-body-small" role="alert" style={{ color: 'var(--color-error)' }}>
          {error}
        </p>
      ) : null}

      {booking.status === 'EXPIRED' ? (
        <EmptyState
          title="This reservation expired"
          description="Unpaid bookings expire so dates can be offered to someone else. Start a new stay on the property page."
          actionHref={`/properties/${booking.property.id}`}
          actionLabel="View property"
        />
      ) : null}

      {booking.status === 'CANCELLED' ? (
        <EmptyState title="Cancelled" description="This stay is no longer active." actionHref="/dashboard/trips" actionLabel="Back to trips" />
      ) : null}

      {awaitingPay ? (
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: 'var(--space-5)' }}>
          <Button onClick={() => void pay()} disabled={busy}>
            {busy ? 'Opening payment…' : 'Pay now'}
          </Button>
          <Button href={`/properties/${booking.property.id}`} variant="ghost">
            Back to property
          </Button>
        </div>
      ) : null}

      {showConfirmation && confirmed ? (
        <div style={{ marginTop: 'var(--space-5)' }}>
          <Button href="/dashboard/trips" variant="secondary">
            View trips
          </Button>
        </div>
      ) : null}
    </article>
  );
}
