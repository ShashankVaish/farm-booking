import { describe, expect, it } from 'vitest';
import { applyDateClick, nightsBetween, rangeHasUnavailable } from '@/lib/bookings/date-picker';

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
