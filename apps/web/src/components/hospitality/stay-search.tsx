'use client';

import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/forms';
import { toQueryString } from '@/lib/api/query';
import styles from './hospitality.module.css';

export function StaySearch({
  defaults,
}: {
  defaults?: { location?: string; checkIn?: string; checkOut?: string; guests?: string };
}) {
  const router = useRouter();
  const [location, setLocation] = useState(defaults?.location ?? '');
  const [checkIn, setCheckIn] = useState(defaults?.checkIn ?? '');
  const [checkOut, setCheckOut] = useState(defaults?.checkOut ?? '');
  const [guests, setGuests] = useState(Number(defaults?.guests ?? 2));

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const query = toQueryString({
      location: location.trim() || undefined,
      checkIn: checkIn || undefined,
      checkOut: checkOut || undefined,
      guests: guests > 0 ? guests : undefined,
    });
    router.push(`/explore${query}`);
  }

  return (
    <form className={styles.search} onSubmit={onSubmit} aria-label="Search stays">
      <Input
        id="search-where"
        label="Where"
        placeholder="City, hill station, or neighbourhood"
        value={location}
        onChange={(event) => setLocation(event.target.value)}
        autoComplete="off"
      />
      <Input
        id="search-check-in"
        label="Check-in"
        type="date"
        value={checkIn}
        onChange={(event) => setCheckIn(event.target.value)}
      />
      <Input
        id="search-check-out"
        label="Check-out"
        type="date"
        value={checkOut}
        onChange={(event) => setCheckOut(event.target.value)}
      />
      <div className={styles.guestField}>
        <p className={styles.guestLabel}>Guests</p>
        <div className={styles.stepper}>
          <button
            type="button"
            aria-label="Decrease guests"
            onClick={() => setGuests((value) => Math.max(1, value - 1))}
          >
            −
          </button>
          <span aria-live="polite">{guests}</span>
          <button type="button" aria-label="Increase guests" onClick={() => setGuests((value) => value + 1)}>
            +
          </button>
        </div>
      </div>
      <Button type="submit">Search</Button>
    </form>
  );
}
