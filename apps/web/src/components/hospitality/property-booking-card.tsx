'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/forms';
import { memoryTokenStore } from '@/lib/api/token-store';
import { ApiError, NetworkError } from '@/lib/api/errors';
import { bookingApi } from '@/lib/bookings/api';
import { openBookingKey } from '@/lib/bookings/types';
import type { PriceQuote } from '@/lib/bookings/types';
import type { ApiProperty } from '@/lib/properties/types';
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
  const submitting = useRef(false);

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
      router.push(`/booking/${result.booking.id}`);
    } catch (err) {
      setError(err instanceof ApiError || err instanceof NetworkError ? err.message : 'Could not start this booking.');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  const nightly = Number(property.basePrice);

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
          This is a sample stay. Live dates and checkout are available on published listings.
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
      <form onSubmit={onReserve}>
        <StayDatePicker
          propertyId={property.id}
          checkIn={checkIn}
          checkOut={checkOut}
          onChange={(next) => {
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
        <Button type="submit" block loading={busy} disabled={busy || quoting || !checkIn || !checkOut}>
          {busy ? 'Reserving…' : 'Reserve'}
        </Button>
      </form>
    </aside>
  );
}
