'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, Spinner } from '@/components/ui/feedback';
import { PriceBreakdown } from '@/components/hospitality/price-breakdown';
import { bookingApi } from '@/lib/bookings/api';
import { payErrorMessage } from '@/lib/bookings/payment-errors';
import {
  PAYMENT_OUTCOME_MESSAGE,
  paymentStatusLabel,
  type CheckoutForm,
  type CustomerBooking,
  type PaymentOutcome,
  type PriceQuote,
} from '@/lib/bookings/types';
import { ApiError } from '@/lib/api/errors';
import { brand } from '@/lib/config/brand';
import styles from '@/app/(site)/dashboard/dashboard.module.css';

/*
  How often the page asks the server whether an open payment has landed.

  Six seconds is fast enough that a guest returning from the gateway sees the
  confirmation within one tick, and slow enough that a page left open for an
  hour stays well inside the API's rate limit. On any failure the wait doubles,
  up to a minute, so a struggling server is not made worse by its own clients.
*/
const POLL_MS = 6_000;
const POLL_MAX_MS = 60_000;

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

function isAwaitingPayment(booking: CustomerBooking | null): boolean {
  return !booking || booking.status === 'PENDING' || booking.status === 'PAYMENT_PENDING';
}

/** The `?payment=` flag the gateway return URL appends, read once on arrival. */
function outcomeFromUrl(): PaymentOutcome | null {
  if (typeof window === 'undefined') return null;
  const value = new URLSearchParams(window.location.search).get('payment');
  return value && value in PAYMENT_OUTCOME_MESSAGE ? (value as PaymentOutcome) : null;
}

/**
 * Sends the browser to the gateway's hosted page.
 *
 * A form POST rather than a fetch: the gateway must receive the request from
 * the browser itself, with a full navigation, so that it can later send the
 * browser back to us. The form is created, submitted and never rendered.
 */
function submitCheckout(checkout: CheckoutForm): void {
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = checkout.action;
  form.style.display = 'none';
  for (const [name, value] of Object.entries(checkout.fields)) {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}

export function BookingExperience({ bookingId, confirmation }: { bookingId: string; confirmation?: boolean }) {
  const router = useRouter();
  const [booking, setBooking] = useState<CustomerBooking | null>(null);
  const [error, setError] = useState<string | null>(null);
  /*
    The gateway's verdict, kept apart from `error`. `load()` clears `error`
    whenever the booking loads cleanly, and it resolves a beat after this page
    mounts — so a verdict stored in `error` was wiped before anyone read it.
    This one survives until the guest acts.
  */
  const [notice, setNotice] = useState<string | null>(null);
  /*
    Two separate flags on purpose. The old single `loading` flag was set on
    every background refresh, which swapped the whole page for a spinner and
    back — the flicker. Only the very first load is allowed to blank the page.
  */
  const [initialLoading, setInitialLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const paying = useRef(false);

  const load = useCallback(async () => {
    try {
      const next = await bookingApi.get(bookingId);
      setBooking(next);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load this booking.');
    } finally {
      setInitialLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    void load();
  }, [load]);

  // A message from the gateway return, shown once and then cleared from the URL.
  useEffect(() => {
    const outcome = outcomeFromUrl();
    if (!outcome) return;
    setNotice(PAYMENT_OUTCOME_MESSAGE[outcome]);
    window.history.replaceState(null, '', window.location.pathname);
  }, []);

  const awaiting = isAwaitingPayment(booking);

  /*
    Polls the server while a payment is open.

    This effect depends on `awaiting` — a boolean — and never on `booking`
    itself. The previous version listed the booking object, so every poll
    response, being a new object, restarted the effect, which polled again
    immediately: 600+ requests in twenty seconds, a 429 from the API, and a
    page that reloaded itself into a spinner on every one of them.
  */
  useEffect(() => {
    if (!awaiting) return;

    let stopped = false;
    let delay = POLL_MS;
    let timer: number | undefined;

    async function tick() {
      if (stopped) return;
      // Nothing changes while the tab is hidden; do not spend requests on it.
      if (document.visibilityState === 'hidden') {
        schedule();
        return;
      }
      try {
        const latest = await bookingApi.reconcile(bookingId);
        if (stopped) return;
        // Only adopt a payload that carries what this screen renders; a thinner
        // one would blank the property and crash on the next paint.
        if (latest?.property?.title) {
          setBooking(latest);
        } else if (latest) {
          setBooking((current) => (current ? { ...current, ...latest, property: current.property } : current));
        }
        delay = POLL_MS;
      } catch {
        // Back off rather than retry hard; the next tick will try again.
        delay = Math.min(delay * 2, POLL_MAX_MS);
      }
      schedule();
    }

    function schedule() {
      if (stopped) return;
      timer = window.setTimeout(() => void tick(), delay);
    }

    // First tick is immediate so a guest returning from the gateway is not
    // left staring at "awaiting payment" for six seconds.
    void tick();

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        window.clearTimeout(timer);
        void tick();
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [awaiting, bookingId]);

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
    setNotice(null);
    try {
      const order = await bookingApi.createOrder(booking.id);
      if (!order.checkout) {
        setError('Payments are not configured on the server. Your booking is saved — please contact support.');
        return;
      }
      // The page navigates away here; `busy` stays true so the button cannot
      // be pressed twice while the browser is leaving.
      submitCheckout(order.checkout);
    } catch (err) {
      setError(payErrorMessage(err, 'Could not start payment.'));
      void load();
      paying.current = false;
      setBusy(false);
    }
  }

  if (initialLoading) return <Spinner label="Loading booking" />;
  if (error && !booking) return <ErrorState description={error} onRetry={() => void load()} />;
  if (!booking) return null;

  const awaitingPay = booking.status === 'PENDING' || booking.status === 'PAYMENT_PENDING';
  const confirmed = booking.status === 'CONFIRMED' || booking.status === 'COMPLETED';
  const showConfirmation = confirmation || confirmed;

  return (
    <article className={styles.panel}>
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

      {notice ? (
        <p className="t-body-small" role="alert" style={{ color: 'var(--color-error)' }}>
          {notice}
        </p>
      ) : null}
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
        <div style={{ marginTop: 'var(--space-5)' }}>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <Button onClick={() => void pay()} disabled={busy}>
              {busy ? 'Taking you to PayU…' : 'Pay now'}
            </Button>
            <Button href={`/properties/${booking.property.id}`} variant="ghost">
              Back to property
            </Button>
          </div>
          <p className="t-caption" style={{ marginTop: 'var(--space-3)' }}>
            You will be taken to PayU to pay securely, then brought back to {brand.name}.
          </p>
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
