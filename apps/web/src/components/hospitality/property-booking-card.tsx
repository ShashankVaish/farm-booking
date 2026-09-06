'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/forms';
import { apiClient } from '@/lib/api/client';
import { memoryTokenStore } from '@/lib/api/token-store';
import { ApiError } from '@/lib/api/errors';
import type { ApiProperty } from '@/lib/properties/types';
import styles from './hospitality.module.css';

type Quote = {
  nights: number;
  baseAmount: string;
  weekendAmount: string;
  extraGuestAmount: string;
  platformFee: string;
  discountAmount: string;
  totalAmount: string;
};

export function PropertyBookingCard({ property }: { property: ApiProperty }) {
  const router = useRouter();
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guestCount, setGuestCount] = useState(2);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!checkIn || !checkOut) {
      setQuote(null);
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        const result = await apiClient.post<Quote>(
          '/api/bookings/quote',
          {
            propertyId: property.id,
            checkInDate: checkIn,
            checkOutDate: checkOut,
            guestCount,
          },
          { auth: false },
        );
        if (!cancelled) {
          setQuote(result);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setQuote(null);
          setError(err instanceof ApiError ? err.message : 'Those dates are not available.');
        }
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [checkIn, checkOut, guestCount, property.id]);

  async function onReserve(event: FormEvent) {
    event.preventDefault();
    if (!memoryTokenStore.getAccessToken()) {
      router.push(`/auth/login?next=/properties/${property.id}`);
      return;
    }
    if (!checkIn || !checkOut) {
      setError('Choose check-in and check-out dates.');
      return;
    }
    setBusy(true);
    try {
      const result = await apiClient.post<{ booking: { id: string } }>('/api/bookings', {
        propertyId: property.id,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        guestCount,
      });
      router.push(`/booking/${result.booking.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not start this booking.');
    } finally {
      setBusy(false);
    }
  }

  const nightly = Number(property.basePrice);

  return (
    <aside className={styles.booking} aria-label="Booking">
      <p className="t-price">
        {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(
          nightly,
        )}{' '}
        <span className="t-caption">/ night</span>
      </p>
      <form onSubmit={onReserve}>
        <Input id="book-in" label="Check-in" type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
        <Input
          id="book-out"
          label="Check-out"
          type="date"
          value={checkOut}
          onChange={(e) => setCheckOut(e.target.value)}
        />
        <Input
          id="book-guests"
          label="Guests"
          type="number"
          min={1}
          max={property.guestCapacity}
          value={guestCount}
          onChange={(e) => setGuestCount(Number(e.target.value) || 1)}
        />
        {quote ? (
          <div className="t-body-small">
            <p>{quote.nights} night(s)</p>
            <p>Stay: ₹{quote.baseAmount}</p>
            {Number(quote.weekendAmount) > 0 ? <p>Weekend: ₹{quote.weekendAmount}</p> : null}
            <p>Taxes &amp; fees: ₹{quote.platformFee}</p>
            <p className="t-price">Total ₹{quote.totalAmount}</p>
          </div>
        ) : null}
        {error ? (
          <p className="t-body-small" role="alert" style={{ color: 'var(--color-error)' }}>
            {error}
          </p>
        ) : null}
        <Button type="submit" block disabled={busy}>
          {busy ? 'Reserving…' : 'Reserve'}
        </Button>
      </form>
    </aside>
  );
}
