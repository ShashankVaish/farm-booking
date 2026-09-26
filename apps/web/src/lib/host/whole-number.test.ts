import { describe, expect, it } from 'vitest';
import { shownNumber, wholeNumber } from './whole-number';

describe('whole-number fields', () => {
  it('never keeps a leading zero', () => {
    expect(wholeNumber('03000')).toBe(3000);
    expect(shownNumber(wholeNumber('015000'))).toBe('15000');
  });

  it('shows an empty box for zero, so typing does not append to a 0', () => {
    expect(shownNumber(0)).toBe('');
    expect(wholeNumber('')).toBe(0);
  });

  it('keeps digits only', () => {
    expect(wholeNumber('₹12,500')).toBe(12500);
    expect(wholeNumber('12.5')).toBe(125);
    expect(wholeNumber('-40')).toBe(40);
  });

  it('caps absurdly long input', () => {
    expect(wholeNumber('12345678901234')).toBe(123456789);
  });
});
