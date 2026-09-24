import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CustomerBooking } from './types';
import { handOffBooking, peekHandedOffBooking } from './booking-handoff';

const booking = { id: 'b1', property: { title: 'Lake House' } } as unknown as CustomerBooking;

afterEach(() => vi.useRealTimers());

describe('booking hand-off', () => {
  it('gives the checkout page the booking Reserve just created', () => {
    handOffBooking(booking);
    expect(peekHandedOffBooking('b1')).toBe(booking);
    // A second read (React's double initialiser in development) still gets it.
    expect(peekHandedOffBooking('b1')).toBe(booking);
  });

  it('ignores a payload without the property the page draws', () => {
    handOffBooking({ id: 'b2' } as unknown as CustomerBooking);
    expect(peekHandedOffBooking('b2')).toBeNull();
  });

  it('expires after a minute', () => {
    vi.useFakeTimers();
    handOffBooking({ ...booking, id: 'b3' } as CustomerBooking);
    vi.advanceTimersByTime(61_000);
    expect(peekHandedOffBooking('b3')).toBeNull();
  });
});
