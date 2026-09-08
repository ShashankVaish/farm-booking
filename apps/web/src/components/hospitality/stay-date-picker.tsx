'use client';

import { useEffect, useMemo, useState } from 'react';
import { getAvailability } from '@/lib/properties/api';
import {
  applyDateClick,
  compactInr,
  isPastDate,
  isUnavailableStatus,
  monthGrid,
  nightlyPrice,
  todayIso,
} from '@/lib/bookings/date-picker';
import { cn } from '@/lib/cn';
import styles from './hospitality.module.css';

type Props = {
  propertyId: string;
  checkIn: string;
  checkOut: string;
  basePrice: number;
  weekendPrice?: number | null;
  onChange: (next: { checkIn: string; checkOut: string; error?: string }) => void;
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function StayDatePicker({
  propertyId,
  checkIn,
  checkOut,
  basePrice,
  weekendPrice,
  onChange,
}: Props) {
  const [month, setMonth] = useState(() => new Date());
  const [days, setDays] = useState<Array<{ date: string; status: string }>>([]);
  const [loading, setLoading] = useState(true);
  const today = todayIso();

  const currentMonthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const atCurrentMonth = month.getFullYear() === currentMonthStart.getFullYear()
    && month.getMonth() === currentMonthStart.getMonth();

  useEffect(() => {
    const start = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-01`;
    const endDate = new Date(month.getFullYear(), month.getMonth() + 1, 1);
    const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-01`;
    let cancelled = false;
    setLoading(true);
    getAvailability(propertyId, start, end)
      .then((result) => {
        if (!cancelled) setDays(result);
      })
      .catch(() => {
        if (!cancelled) setDays([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [month, propertyId]);

  const statusByDate = useMemo(() => new Map(days.map((day) => [day.date, day.status])), [days]);
  const cells = monthGrid(month);
  const label = month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  function inRange(date: string) {
    if (!checkIn) return false;
    if (!checkOut) return date === checkIn;
    return date >= checkIn && date < checkOut;
  }

  return (
    <div>
      <div className={styles.calendarHead}>
        <p className={styles.calendarMonth}>{label}</p>
        <div className={styles.calendarNav}>
          <button
            type="button"
            className={styles.monthNav}
            aria-label="Previous month"
            disabled={atCurrentMonth}
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </button>
          <button
            type="button"
            className={styles.monthNav}
            aria-label="Next month"
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
              <path d="m6 3 5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </button>
        </div>
      </div>

      <div className={styles.calendar} role="grid" aria-label="Select stay dates">
        {WEEKDAYS.map((day, index) => (
          <span key={`${day}-${index}`} className={styles.weekdayHead} aria-hidden="true">
            {day.slice(0, 1)}
          </span>
        ))}
        {cells.map((cell) => {
          const status = statusByDate.get(cell.date) ?? 'AVAILABLE';
          const past = isPastDate(cell.date, today);
          const unavailable = past || isUnavailableStatus(status);
          const selected = inRange(cell.date);
          const price = nightlyPrice(cell.date, basePrice, weekendPrice);
          const showPrice = cell.inMonth && !unavailable && !loading && price > 0;
          return (
            <button
              key={cell.date}
              type="button"
              disabled={unavailable || !cell.inMonth}
              className={cn(
                styles.day,
                !cell.inMonth && styles.dayOutside,
                cell.inMonth && status === 'AVAILABLE' && !past && styles.dayAvailable,
                cell.inMonth && status === 'BLOCKED' && styles.dayBlocked,
                cell.inMonth && status === 'BOOKED' && styles.dayBooked,
                cell.inMonth && past && styles.dayPast,
                selected && styles.daySelected,
              )}
              aria-pressed={selected}
              aria-label={`${cell.date}, ${
                past ? 'in the past' : status.toLowerCase()
              }${showPrice ? `, ${price} rupees per night` : ''}`}
              onClick={() => onChange(applyDateClick({ checkIn, checkOut }, cell.date, statusByDate, today))}
            >
              <span className={styles.dayNumber}>{Number(cell.date.slice(8, 10))}</span>
              <span className={styles.dayPrice}>{showPrice ? compactInr(price) : ''}</span>
            </button>
          );
        })}
      </div>

      <div className={styles.dayLegend}>
        <span className={styles.legendSwatch}>
          <span className={`${styles.legendDot} ${styles.dayAvailable}`} /> Available
        </span>
        <span className={styles.legendSwatch}>
          <span className={`${styles.legendDot} ${styles.dayBooked}`} /> Booked
        </span>
        <span className={styles.legendSwatch}>
          <span className={`${styles.legendDot} ${styles.dayBlocked}`} /> Blocked
        </span>
      </div>
      {weekendPrice && weekendPrice !== basePrice ? (
        <p className="t-caption" style={{ marginTop: 'var(--space-2)', color: 'var(--color-text-muted)' }}>
          Saturday and Sunday nights are priced at the weekend rate.
        </p>
      ) : null}
    </div>
  );
}
