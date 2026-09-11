import { describe, expect, it } from 'vitest';
import {
  applyDateClick,
  isSelectableDate,
  nightsBetween,
  rangeHasUnavailable,
} from '@/lib/bookings/date-picker';

describe('stay date picker', () => {
  const today = '2026-09-06';
  const status = new Map([
    ['2026-09-10', 'AVAILABLE'],
    ['2026-09-11', 'BLOCKED'],
    ['2026-09-12', 'BOOKED'],
    ['2026-09-13', 'AVAILABLE'],
  ]);

  it('rejects past dates and unavailable days', () => {
    expect(applyDateClick({ checkIn: '', checkOut: '' }, '2026-09-01', status, today).error).toMatch(/Past/);
    expect(applyDateClick({ checkIn: '', checkOut: '' }, '2026-09-11', status, today).error).toMatch(/booked or blocked/);
  });

  it('requires check-out after check-in', () => {
    const afterIn = applyDateClick({ checkIn: '', checkOut: '' }, '2026-09-10', status, today);
    const sameDay = applyDateClick(afterIn, '2026-09-10', status, today);
    expect(sameDay.checkOut).toBe('');
    expect(sameDay.checkIn).toBe('2026-09-10');
  });

  it('blocks ranges that include booked or blocked nights', () => {
    expect(rangeHasUnavailable('2026-09-10', '2026-09-13', status)).toBe(true);
    expect(nightsBetween('2026-09-10', '2026-09-13')).toEqual(['2026-09-10', '2026-09-11', '2026-09-12']);
    const started = applyDateClick({ checkIn: '', checkOut: '' }, '2026-09-10', status, today);
    const result = applyDateClick(started, '2026-09-13', status, today);
    expect(result.error).toMatch(/unavailable/);
  });
});

describe('a one-night stay ending on a booked day', () => {
  /*
    Reproduces what a client hit on a live listing: the 16th was the only free
    night in a run, with the 15th and the 17th both BOOKED. The only check-out
    that can end a stay on the 16th is the 17th — and the calendar disabled it,
    so the free night could not be booked at all. The server has always priced
    this stay happily, because a stay occupies [checkIn, checkOut) and the
    departure day is never occupied.
  */
  const today = '2026-09-11';
  const status = new Map([
    ['2026-09-15', 'BOOKED'],
    ['2026-09-16', 'AVAILABLE'],
    ['2026-09-17', 'BOOKED'],
    ['2026-09-18', 'BOOKED'],
  ]);
  const start = { checkIn: '2026-09-16', checkOut: '' };

  it('lets a booked day be picked as check-out', () => {
    const result = applyDateClick(start, '2026-09-17', status, today);
    expect(result).toEqual({ checkIn: '2026-09-16', checkOut: '2026-09-17' });
    expect(nightsBetween(result.checkIn, result.checkOut)).toEqual(['2026-09-16']);
  });

  it('marks that day clickable in the calendar', () => {
    expect(isSelectableDate('2026-09-17', start, status, today)).toBe(true);
  });

  it('still refuses it as a check-in, since nobody can sleep there', () => {
    const fresh = { checkIn: '', checkOut: '' };
    expect(isSelectableDate('2026-09-17', fresh, status, today)).toBe(false);
    expect(applyDateClick(fresh, '2026-09-17', status, today).error).toMatch(/booked or blocked/);
  });

  it('refuses a check-out that would sleep through a booked night', () => {
    // The 18th means occupying the 17th, which is taken.
    expect(isSelectableDate('2026-09-18', start, status, today)).toBe(false);
    expect(applyDateClick(start, '2026-09-18', status, today).error).toMatch(/unavailable/);
  });

  it('restarts the selection when an earlier day is clicked', () => {
    const earlier = applyDateClick(start, '2026-09-14', status, today);
    expect(earlier).toEqual({ checkIn: '2026-09-14', checkOut: '' });
  });

  it('never allows a past day, even as check-out', () => {
    expect(isSelectableDate('2026-09-01', start, status, today)).toBe(false);
  });

  it('treats a day with no availability row as free', () => {
    // Most listings have no rows at all until something is booked or blocked.
    expect(isSelectableDate('2026-09-20', { checkIn: '', checkOut: '' }, new Map(), today)).toBe(true);
  });
});
