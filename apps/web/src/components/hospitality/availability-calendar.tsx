'use client';

import { useEffect, useState } from 'react';
import { getAvailability } from '@/lib/properties/api';
import { cn } from '@/lib/cn';
import styles from './hospitality.module.css';

function pad(value: number) {
  return String(value).padStart(2, '0');
}

function monthRange(date: Date) {
  const start = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-01`;
  const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  const end = `${endDate.getFullYear()}-${pad(endDate.getMonth() + 1)}-01`;
  return { start, end };
}

export function AvailabilityCalendar({ propertyId }: { propertyId: string }) {
  const [month, setMonth] = useState(() => new Date());
  const [days, setDays] = useState<Array<{ date: string; status: string }>>([]);

  useEffect(() => {
    const { start, end } = monthRange(month);
    let cancelled = false;
    getAvailability(propertyId, start, end)
      .then((result) => {
        if (!cancelled) setDays(result);
      })
      .catch(() => {
        if (!cancelled) setDays([]);
      });
    return () => {
      cancelled = true;
    };
  }, [month, propertyId]);

  const label = month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const byDate = new Map(days.map((day) => [day.date, day.status]));

  return (
    <div>
      <div className={styles.sectionHead}>
        <p className="t-label">{label}</p>
        <div>
          <button type="button" className={styles.day} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
            Prev
          </button>
          <button type="button" className={styles.day} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
            Next
          </button>
        </div>
      </div>
      <div className={styles.calendar} role="grid" aria-label="Availability calendar">
        {days.map((day) => (
          <span
            key={day.date}
            className={cn(
              styles.day,
              byDate.get(day.date) === 'BLOCKED' && styles.dayBlocked,
              byDate.get(day.date) === 'BOOKED' && styles.dayBooked,
            )}
          >
            {Number(day.date.slice(8, 10))}
          </span>
        ))}
      </div>
    </div>
  );
}
