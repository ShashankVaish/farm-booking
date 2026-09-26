import { describe, expect, it } from 'vitest';
import { nextDay } from './stay-search';

describe('nextDay', () => {
  it('gives the following date for a one-night search', () => {
    expect(nextDay('2026-10-09')).toBe('2026-10-10');
  });

  it('rolls over month and year ends', () => {
    expect(nextDay('2026-10-31')).toBe('2026-11-01');
    expect(nextDay('2026-12-31')).toBe('2027-01-01');
    expect(nextDay('2028-02-28')).toBe('2028-02-29');
  });
});
