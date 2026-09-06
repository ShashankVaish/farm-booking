'use client';

import { useEffect, useMemo, useState } from 'react';
import { getAvailability } from '@/lib/properties/api';
import {
  applyDateClick,
  isPastDate,
  isUnavailableStatus,
  monthGrid,
  todayIso,
} from '@/lib/bookings/date-picker';
import { cn } from '@/lib/cn';
import styles from './hospitality.module.css';

type Props = {
  propertyId: string;
  checkIn: string;
  checkOut: string;
  onChange: (next: { checkIn: string; checkOut: string; error?: string }) => void;
};

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function StayDatePicker({ propertyId, checkIn, checkOut, onChange }: Props) {
  const [month, setMonth] = useState(() => new Date());
  const [days, setDays] = useState<Array<{ date: string; status: string }>>([]);
  const today = todayIso();

  useEffect(() => {
    const start = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-01`;
    const endDate = new Date(month.getFullYear(), month.getMonth() + 1, 1);
    const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-01`;
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
      <div className={styles.calendar} role="grid" aria-label="Select stay dates">
        {WEEKDAYS.map((day, index) => (
          <span key={`${day}-${index}`} className="t-caption" style={{ textAlign: 'center' }}>
            {day}
          </span>
        ))}
        {cells.map((cell) => {
          const status = statusByDate.get(cell.date) ?? 'AVAILABLE';
          const past = isPastDate(cell.date, today);
          const unavailable = past || isUnavailableStatus(status);
          const selected = inRange(cell.date);
          return (
            <button
              key={cell.date}
              type="button"
              disabled={unavailable || !cell.inMonth}
              className={cn(
                styles.day,
                cell.inMonth && status === 'AVAILABLE' && !past && styles.dayAvailable,
                status === 'BLOCKED' && styles.dayBlocked,
                status === 'BOOKED' && styles.dayBooked,
                selected && styles.daySelected,
              )}
              aria-pressed={selected}
              aria-label={`${cell.date} ${status}${selected ? ' selected' : ''}`}
              onClick={() => onChange(applyDateClick({ checkIn, checkOut }, cell.date, statusByDate, today))}
            >
              {Number(cell.date.slice(8, 10))}
            </button>
          );
        })}
      </div>
      <div className={styles.dayLegend}>
        <span className={styles.legendSwatch}>
          <span className={`${styles.legendDot} ${styles.dayAvailable}`} /> AVAILABLE
        </span>
        <span className={styles.legendSwatch}>
          <span className={`${styles.legendDot} ${styles.dayBooked}`} /> BOOKED
        </span>
        <span className={styles.legendSwatch}>
          <span className={`${styles.legendDot} ${styles.dayBlocked}`} /> BLOCKED
        </span>
        <span className={styles.legendSwatch}>
          <span className={`${styles.legendDot} ${styles.daySelected}`} /> SELECTED
        </span>
      </div>
    </div>
  );
}
