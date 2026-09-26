import { describe, expect, it } from 'vitest';
import { positiveInt, positiveNumber } from './search-params';

describe('numeric search filters from the URL', () => {
  it('passes positive whole numbers through', () => {
    expect(positiveInt('2')).toBe(2);
    expect(positiveInt('12')).toBe(12);
  });

  it('drops values the API would reject', () => {
    expect(positiveInt('0')).toBeUndefined();
    expect(positiveInt('-3')).toBeUndefined();
    expect(positiveInt('abc')).toBeUndefined();
    expect(positiveInt('2.5')).toBeUndefined();
    expect(positiveInt('')).toBeUndefined();
    expect(positiveInt(undefined)).toBeUndefined();
  });

  it('allows decimals where they make sense, such as a rating', () => {
    expect(positiveNumber('4.5')).toBe(4.5);
    expect(positiveNumber('0')).toBeUndefined();
    expect(positiveNumber('NaN')).toBeUndefined();
  });
});
