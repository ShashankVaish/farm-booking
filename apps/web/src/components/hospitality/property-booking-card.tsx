'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/forms';
import { memoryTokenStore } from '@/lib/api/token-store';
import { ApiError, NetworkError } from '@/lib/api/errors';
import { bookingApi } from '@/lib/bookings/api';
import { openBookingKey } from '@/lib/bookings/types';
import { handOffBooking } from '@/lib/bookings/booking-handoff';
import type { PriceQuote } from '@/lib/bookings/types';
import type { ApiProperty } from '@/lib/properties/types';
import { getAvailability } from '@/lib/properties/api';
import {
  addDaysIso,
  nightsBetween,
  shortStayLabel,
  suggestOneNight,
  todayIso,
} from '@/lib/bookings/date-picker';
import { cn } from '@/lib/cn';
import { PriceBreakdown } from './price-breakdown';
import { StayDatePicker } from './stay-date-picker';
import styles from './hospitality.module.css';

export function PropertyBookingCard({
  property,
  bookable = true,
}: {
  property: ApiProperty;
  bookable?: boolean;
}) {
  const router = useRouter();
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guestCount, setGuestCount] = useState(2);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState('');
  const [quote, setQuote] = useState<PriceQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [couponMessage, setCouponMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // True while the dates are the ones we picked, not the guest.
  const [suggested, setSuggested] = useState(false);
  const submitting = useRef(false);
  const guestPicked = useRef(false);

  /*
    Load the checkout page's code while the guest is still reading the
    listing, so Reserve navigates without waiting for it. The page renders the
    same shell for any id (the booking itself comes from the client), so a
    placeholder id warms exactly what the real navigation will need.
  */
  useEffect(() => {
    if (bookable) router.prefetch('/booking/00000000-0000-4000-8000-000000000000');
  }, [bookable, router]);

  /*
    Pre-fill one free night so a guest on a phone can reserve in one tap from
    the sticky bar. Only ever fills an empty card: if the guest has already
    touched the calendar by the time availability arrives, their choice stands.
  */
  useEffect(() => {
    if (!bookable) return;
    let cancelled = false;
    const today = todayIso();
    getAvailability(property.id, today, addDaysIso(today, 32))
      .then((days) => {
        if (cancelled || guestPicked.current) return;
        const stay = suggestOneNight(days, { today });
        if (!stay) return;
        setCheckIn(stay.checkIn);
        setCheckOut(stay.checkOut);
        setSuggested(true);
      })
      .catch(() => {
        // No suggestion is fine; the guest picks from the calendar.
      });
    return () => {
      cancelled = true;
    };
  }, [bookable, property.id]);

  useEffect(() => {
    if (!bookable || !checkIn || !checkOut) {
      setQuote(null);
      setQuoting(false);
      return;
    }
    let cancelled = false;
    async function load() {
      setQuoting(true);
      try {
        const result = await bookingApi.quote({
          propertyId: property.id,
          checkInDate: checkIn,
          checkOutDate: checkOut,
          guestCount,
          couponCode: appliedCoupon || undefined,
        });
        if (!cancelled) {
          setQuote(result);
          setError(null);
          if (appliedCoupon) {
            setCouponMessage(Number(result.discountAmount) > 0 ? 'Coupon applied to this quote.' : 'Coupon did not change this total.');
          } else {
            setCouponMessage(null);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setQuote(null);
          setCouponMessage(null);
          setError(err instanceof ApiError || err instanceof NetworkError ? err.message : 'Those dates are not available.');
        }
      } finally {
        if (!cancelled) setQuoting(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [checkIn, checkOut, guestCount, appliedCoupon, property.id, bookable]);

  async function onReserve(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    if (!memoryTokenStore.getAccessToken()) {
      router.push(`/auth/login?next=/properties/${property.id}`);
      return;
    }
    if (!checkIn || !checkOut) {
      setError('Choose check-in and check-out dates.');
      return;
    }
    if (checkOut <= checkIn) {
      setError('Check-out must be after check-in.');
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      const storedKey = openBookingKey(property.id, checkIn, checkOut, guestCount);
      const existingId = sessionStorage.getItem(storedKey);
      if (existingId) {
        router.push(`/booking/${existingId}`);
        return;
      }
      const result = await bookingApi.create({
        propertyId: property.id,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        guestCount,
        couponCode: appliedCoupon || undefined,
      });
      sessionStorage.setItem(storedKey, result.booking.id);
      handOffBooking(result.booking);
      router.push(`/booking/${result.booking.id}`);
      // Stay on "Reserving…" until the checkout page replaces this one;
      // resetting here flashed "Reserve" again during the navigation, which
      // read as if the tap had not worked.
    } catch (err) {
      setError(err instanceof ApiError || err instanceof NetworkError ? err.message : 'Could not start this booking.');
      submitting.current = false;
      setBusy(false);
    }
  }

  const nightly = Number(property.basePrice);
  const inr = (amount: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
  const nights = checkIn && checkOut && checkOut > checkIn ? nightsBetween(checkIn, checkOut).length : 0;
  const barTotal = quote ? Number(quote.totalAmount) : nights ? nightly * nights : nightly;

  function showCard() {
    document.getElementById('book-in')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  if (!bookable) {
    return (
      <aside className={styles.booking} aria-label="Booking">
        <p className="t-price">
          {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(
            nightly,
          )}{' '}
          <span className="t-caption">/ night</span>
        </p>
        <p className="t-body-small">
          {property.status && property.status !== 'APPROVED'
            ? 'This property is awaiting admin approval. Live dates and checkout will open after approval.'
            : 'This is a sample stay. Live dates and checkout are available on published listings.'}
        </p>
        <Button href="/explore" block>
          Browse live stays
        </Button>
      </aside>
    );
  }

  return (
    <aside className={styles.booking} aria-label="Booking">
      <p className="t-price">
        {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(nightly)}{' '}
        <span className="t-caption">/ night</span>
      </p>
      <form id="book-form" onSubmit={onReserve}>
        <StayDatePicker
          propertyId={property.id}
          checkIn={checkIn}
          checkOut={checkOut}
          basePrice={Number(property.basePrice) || 0}
          weekendPrice={property.weekendPrice ? Number(property.weekendPrice) : null}
          onChange={(next) => {
            guestPicked.current = true;
            setSuggested(false);
            setCheckIn(next.checkIn);
            setCheckOut(next.checkOut);
            if (next.error) setError(next.error);
          }}
        />
        <p className="t-caption">
          {checkIn ? `Check-in ${checkIn}` : 'Select check-in'}
          {checkOut ? ` · Check-out ${checkOut}` : ''}
        </p>
        <Input
          id="book-guests"
          label="Guests"
          type="number"
          min={1}
          max={property.guestCapacity}
          value={guestCount}
          disabled={busy}
          onChange={(e) => setGuestCount(Math.min(property.guestCapacity, Math.max(1, Number(e.target.value) || 1)))}
        />
        <Input
          id="coupon"
          label="Coupon"
          value={couponCode}
          onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
          success={couponMessage ?? undefined}
          disabled={busy}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy || !couponCode.trim()}
          onClick={() => setAppliedCoupon(couponCode.trim())}
        >
          Apply coupon
        </Button>
        {quoting ? <p className="t-caption" role="status">Updating price…</p> : null}
        {quote ? <PriceBreakdown quote={quote} /> : null}
        {error ? (
          <p className="t-body-small" role="alert" style={{ color: 'var(--color-error)' }}>
            {error}
          </p>
        ) : null}
        {suggested && nights ? (
          <p className={styles.suggestNote} role="status">
            We picked {shortStayLabel(checkIn, checkOut)} for you — tap any other date to change it.
          </p>
        ) : null}
        <Button type="submit" block loading={busy} disabled={busy || quoting || !checkIn || !checkOut}>
          {busy ? 'Reserving…' : 'Reserve'}
        </Button>
      </form>

      {/*
        Phones only (hidden from 1024px up, where the card itself is sticky).
        Tapping the summary scrolls to the calendar to change the date; Reserve
        submits the card's own form, so both paths share one set of checks.
      */}
      <div className={styles.reserveBar} role="region" aria-label="Reserve this stay">
        <button type="button" className={styles.reserveSummary} onClick={showCard}>
          <span key={barTotal} className={cn(styles.reservePrice, quoting && styles.reservePriceLoading)}>
            {inr(barTotal)}
            {!nights ? <span className={styles.reservePer}> / night</span> : null}
          </span>
          <span className={styles.reserveDates}>
            {nights
              ? `For ${nights} ${nights === 1 ? 'night' : 'nights'} · ${shortStayLabel(checkIn, checkOut)}`
              : 'Add dates to see the total'}
          </span>
          <span className={styles.reserveChip}>
            <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true">
              <rect x="2" y="3" width="12" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            {suggested ? 'Suggested · change' : nights ? 'Change dates' : 'Pick dates'}
          </span>
        </button>
        {nights ? (
          <button
            type="submit"
            form="book-form"
            className={styles.reserveButton}
            disabled={busy || quoting}
            aria-busy={busy || undefined}
            onClick={() => navigator.vibrate?.(10)}
          >
            {busy ? <span className={styles.reserveSpinner} aria-hidden="true" /> : null}
            {busy ? 'Reserving' : 'Reserve'}
          </button>
        ) : (
          <button type="button" className={styles.reserveButton} onClick={showCard}>
            Check dates
          </button>
        )}
      </div>
    </aside>
  );
}
