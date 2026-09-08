'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/forms';
import { toQueryString } from '@/lib/api/query';
import styles from './hospitality.module.css';

const MAX_GUESTS = 60;

function todayKey(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function StaySearch({
  defaults,
}: {
  defaults?: { location?: string; checkIn?: string; checkOut?: string; guests?: string };
}) {
  const router = useRouter();
  const [location, setLocation] = useState(defaults?.location ?? '');
  const [checkIn, setCheckIn] = useState(defaults?.checkIn ?? '');
  const [checkOut, setCheckOut] = useState(defaults?.checkOut ?? '');
  const [guests, setGuests] = useState(() => {
    const parsed = Number(defaults?.guests);
    return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, MAX_GUESTS) : 2;
  });
  const [error, setError] = useState<string | null>(null);
  // A transition keeps the pending state tied to the actual navigation, so the
  // button cannot stay stuck on "Searching…" when the guest navigates back.
  const [busy, startTransition] = useTransition();

  const minDate = todayKey();

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (checkIn && checkOut && checkOut <= checkIn) {
      setError('Check-out must be after check-in.');
      return;
    }
    setError(null);
    const query = toQueryString({
      location: location.trim() || undefined,
      checkIn: checkIn || undefined,
      checkOut: checkOut || undefined,
      guests: guests > 0 ? guests : undefined,
    });
    startTransition(() => router.push(`/explore${query}`));
  }

  return (
    <form className={styles.search} onSubmit={onSubmit} aria-label="Search stays">
      <div className={styles.searchField}>
        <Input
          id="search-where"
          label="Where are you going?"
          placeholder="City, hill station, or neighbourhood"
          value={location}
          onChange={(event) => setLocation(event.target.value)}
          autoComplete="off"
        />
      </div>
      <div className={styles.searchField}>
        <Input
          id="search-check-in"
          label="Check-in"
          type="date"
          min={minDate}
          value={checkIn}
          onChange={(event) => {
            setCheckIn(event.target.value);
            // Keep the range coherent rather than letting it go backwards.
            if (checkOut && event.target.value && checkOut <= event.target.value) {
              setCheckOut('');
            }
            setError(null);
          }}
        />
      </div>
      <div className={styles.searchField}>
        <Input
          id="search-check-out"
          label="Check-out"
          type="date"
          min={checkIn || minDate}
          value={checkOut}
          error={error ?? undefined}
          onChange={(event) => {
            setCheckOut(event.target.value);
            setError(null);
          }}
        />
      </div>
      <div className={styles.guestField}>
        <p className={styles.guestLabel} id="search-guests-label">
          Guests
        </p>
        <div className={styles.stepper} role="group" aria-labelledby="search-guests-label">
          <button
            type="button"
            aria-label="Decrease guests"
            disabled={guests <= 1}
            onClick={() => setGuests((value) => Math.max(1, value - 1))}
          >
            −
          </button>
          <span aria-live="polite">{guests}</span>
          <button
            type="button"
            aria-label="Increase guests"
            disabled={guests >= MAX_GUESTS}
            onClick={() => setGuests((value) => Math.min(MAX_GUESTS, value + 1))}
          >
            +
          </button>
        </div>
      </div>
      <Button type="submit" loading={busy} className={styles.searchSubmit}>
        {busy ? 'Searching…' : 'Search'}
      </Button>
    </form>
  );
}
