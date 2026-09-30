import { describe, expect, it } from 'vitest';
import { parseGuests } from './guest-stepper';

describe('parseGuests', () => {
  it('reads what was typed, so clearing the box and typing 7 gives 7 (it used to give 15)', () => {
    expect(parseGuests('', 15)).toBeNull();
    expect(parseGuests('7', 15)).toBe(7);
  });

  it('caps at the listing capacity and never goes below 1', () => {
    expect(parseGuests('40', 15)).toBe(15);
    expect(parseGuests('0', 15)).toBe(1);
  });

  it('ignores anything that is not a digit', () => {
    expect(parseGuests('1a2', 15)).toBe(12);
  });
});
