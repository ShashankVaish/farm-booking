'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/feedback';
import { ApiError } from '@/lib/api/errors';
import { hostApi } from '@/lib/host/host-api';
import type { AvailabilityDay } from '@/lib/properties/types';
import { cn } from '@/lib/cn';
import styles from './availability-calendar.module.css';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Local calendar date as `YYYY-MM-DD`, avoiding the UTC shift of toISOString. */
function toKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, delta: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + delta, 1);
}

function daysInMonth(month: Date): number {
  return new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
}

type Status = AvailabilityDay['status'];

export function AvailabilityCalendar({ propertyId }: { propertyId?: string }) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [days, setDays] = useState<AvailabilityDay[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [anchor, setAnchor] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(propertyId));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: 'error' | 'ok' } | null>(null);

  const todayKey = toKey(new Date());
  const currentMonthStart = startOfMonth(new Date());
  const atCurrentMonth = month.getTime() <= currentMonthStart.getTime();

  const range = useMemo(() => {
    const next = addMonths(month, 1);
    return { from: toKey(month), to: toKey(next) };
  }, [month]);

  const load = useCallback(async () => {
    if (!propertyId) return;
    setLoading(true);
    try {
      setDays(await hostApi.availability(propertyId, range.from, range.to));
    } catch (err) {
      setDays([]);
      setMessage({
        text: err instanceof ApiError ? err.message : 'Could not load this calendar.',
        tone: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [propertyId, range.from, range.to]);

  useEffect(() => {
    void load();
  }, [load]);

  // Selections belong to the month they were made in.
  useEffect(() => {
    setSelected([]);
    setAnchor(null);
  }, [month, propertyId]);

  const statusByDate = useMemo(() => {
    const map = new Map<string, Status>();
    for (const day of days) map.set(day.date.slice(0, 10), day.status);
    return map;
  }, [days]);

  const cells = useMemo(() => {
    const total = daysInMonth(month);
    return Array.from({ length: total }, (_, index) => {
      const date = new Date(month.getFullYear(), month.getMonth(), index + 1);
      const key = toKey(date);
      return {
        key,
        day: index + 1,
        status: statusByDate.get(key) ?? 'AVAILABLE',
        isPast: key < todayKey,
        isToday: key === todayKey,
      };
    });
  }, [month, statusByDate, todayKey]);

  const selectableKeys = useMemo(
    () => cells.filter((cell) => !cell.isPast && cell.status !== 'BOOKED').map((cell) => cell.key),
    [cells],
  );

  function toggle(key: string, extend: boolean) {
    setMessage(null);
    if (extend && anchor) {
      const from = selectableKeys.indexOf(anchor);
      const to = selectableKeys.indexOf(key);
      if (from !== -1 && to !== -1) {
        const span = selectableKeys.slice(Math.min(from, to), Math.max(from, to) + 1);
        setSelected((current) => Array.from(new Set([...current, ...span])));
        return;
      }
    }
    setAnchor(key);
    setSelected((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key],
    );
  }

  async function apply(kind: 'block' | 'unblock') {
    if (!propertyId || selected.length === 0) return;
    setBusy(true);
    setMessage(null);
    try {
      if (kind === 'block') await hostApi.blockDates(propertyId, selected);
      else await hostApi.unblockDates(propertyId, selected);
      setSelected([]);
      setAnchor(null);
      await load();
      setMessage({
        text: `${selected.length} ${selected.length === 1 ? 'date' : 'dates'} ${
          kind === 'block' ? 'blocked' : 'reopened'
        }.`,
        tone: 'ok',
      });
    } catch (err) {
      setMessage({
        text: err instanceof ApiError ? err.message : 'Could not update availability.',
        tone: 'error',
      });
    } finally {
      setBusy(false);
    }
  }

  if (!propertyId) {
    return (
      <EmptyState
        title="Save the listing first"
        description="Availability can be blocked once the draft has been created."
      />
    );
  }

  const counts = cells.reduce(
    (totals, cell) => {
      if (cell.isPast) return totals;
      if (cell.status === 'BOOKED') totals.booked += 1;
      else if (cell.status === 'BLOCKED') totals.blocked += 1;
      else totals.available += 1;
      return totals;
    },
    { available: 0, blocked: 0, booked: 0 },
  );

  const leadingBlanks = new Date(month.getFullYear(), month.getMonth(), 1).getDay();

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <div>
          <h2 className={styles.month}>
            {month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
          </h2>
          <p className={styles.monthSub}>
            {counts.available} open · {counts.blocked} blocked · {counts.booked} booked
          </p>
        </div>
        <div className={styles.nav}>
          <button
            type="button"
            className={styles.todayButton}
            onClick={() => setMonth(currentMonthStart)}
            disabled={atCurrentMonth}
          >
            Today
          </button>
          <button
            type="button"
            className={styles.navButton}
            aria-label="Previous month"
            disabled={atCurrentMonth}
            onClick={() => setMonth((value) => addMonths(value, -1))}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
          <button
            type="button"
            className={styles.navButton}
            aria-label="Next month"
            onClick={() => setMonth((value) => addMonths(value, 1))}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path d="m6 3 5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
        </div>
      </div>

      <div className={styles.grid}>
        {WEEKDAYS.map((label) => (
          <div key={label} className={styles.weekday} aria-hidden="true">
            {label.slice(0, 1)}
          </div>
        ))}

        {loading
          ? Array.from({ length: 35 }, (_, index) => (
              <div key={`skeleton-${index}`} className={styles.skeletonDay} />
            ))
          : (
            <>
              {Array.from({ length: leadingBlanks }, (_, index) => (
                <div key={`pad-${index}`} className={styles.pad} />
              ))}
              {cells.map((cell) => {
                const isSelected = selected.includes(cell.key);
                const locked = cell.isPast || cell.status === 'BOOKED';
                const label = new Date(
                  month.getFullYear(),
                  month.getMonth(),
                  cell.day,
                ).toLocaleDateString('en-IN', { day: 'numeric', month: 'long' });
                return (
                  <button
                    key={cell.key}
                    type="button"
                    disabled={locked || busy}
                    aria-pressed={isSelected}
                    aria-label={`${label} — ${
                      cell.isPast ? 'in the past' : cell.status.toLowerCase()
                    }`}
                    className={cn(
                      styles.day,
                      cell.status === 'AVAILABLE' && styles.available,
                      cell.status === 'BLOCKED' && styles.blocked,
                      cell.status === 'BOOKED' && styles.booked,
                      cell.isPast && styles.past,
                      cell.isToday && styles.today,
                      isSelected && styles.selected,
                    )}
                    onClick={(event) => toggle(cell.key, event.shiftKey)}
                  >
                    <span className={styles.dayNumber}>{cell.day}</span>
                    <span className={styles.dot} aria-hidden="true" />
                  </button>
                );
              })}
            </>
          )}
      </div>

      {message ? (
        <p
          className={cn(
            styles.message,
            message.tone === 'error' ? styles.messageError : styles.messageOk,
          )}
          role={message.tone === 'error' ? 'alert' : 'status'}
        >
          {message.text}
        </p>
      ) : null}

      <div className={styles.footer}>
        <div className={styles.legend}>
          <span className={styles.legendItem}>
            <span className={cn(styles.swatch, styles.swatchAvailable)} />
            Open
          </span>
          <span className={styles.legendItem}>
            <span className={cn(styles.swatch, styles.swatchBlocked)} />
            Blocked
          </span>
          <span className={styles.legendItem}>
            <span className={cn(styles.swatch, styles.swatchBooked)} />
            Booked · locked
          </span>
        </div>
        <div className={styles.actions}>
          <span className={styles.count} aria-live="polite">
            {selected.length === 0
              ? 'No dates selected'
              : `${selected.length} selected`}
          </span>
          <Button size="sm" disabled={selected.length === 0 || busy} onClick={() => void apply('block')}>
            Block
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={selected.length === 0 || busy}
            onClick={() => void apply('unblock')}
          >
            Reopen
          </Button>
        </div>
      </div>
    </div>
  );
}
