import { describe, expect, it } from 'vitest';
import { formatMonthlyPrice, listingLimitLabel, parseFeatureLines, planEnquiryHref } from './plans';

describe('formatMonthlyPrice', () => {
  it('formats whole rupees without decimals', () => {
    expect(formatMonthlyPrice('999.00')).toBe('₹999');
    expect(formatMonthlyPrice(2499)).toBe('₹2,499');
  });

  it('keeps paise when the price has them', () => {
    expect(formatMonthlyPrice('499.50')).toBe('₹499.50');
  });

  it('calls a zero price free', () => {
    expect(formatMonthlyPrice('0.00')).toBe('Free');
  });
});

describe('listingLimitLabel', () => {
  it('describes limited and unlimited plans', () => {
    expect(listingLimitLabel(1)).toBe('1 listing');
    expect(listingLimitLabel(5)).toBe('5 listings');
    expect(listingLimitLabel(null)).toBe('Unlimited listings');
  });
});

describe('parseFeatureLines', () => {
  it('trims lines and drops blank ones', () => {
    expect(parseFeatureLines('  Priority review \n\n Featured placement\r\n')).toEqual([
      'Priority review',
      'Featured placement',
    ]);
  });
});

describe('planEnquiryHref', () => {
  it('opens an email to support naming the plan', () => {
    const href = planEnquiryHref('Pro');
    expect(href.startsWith('mailto:')).toBe(true);
    expect(decodeURIComponent(href)).toContain('Subscribe to the Pro plan');
  });
});
