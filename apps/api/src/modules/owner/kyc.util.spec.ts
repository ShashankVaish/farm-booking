import {
  aadhaarLast4,
  hashAadhaar,
  isValidAadhaar,
  isValidPan,
  maskAadhaar,
  normalizeAadhaar,
  normalizePan,
  accountLast4,
  isValidAccountNumber,
  isValidIfsc,
  maskAccount,
  normalizeIfsc,
} from './kyc.util';

describe('aadhaar validation', () => {
  it('accepts numbers with a correct Verhoeff checksum', () => {
    // Verhoeff-valid samples used across public test suites.
    expect(isValidAadhaar('234567890124')).toBe(true);
    expect(isValidAadhaar('2345 6789 0124')).toBe(true);
    expect(isValidAadhaar('2345-6789-0124')).toBe(true);
  });

  it('rejects a single mistyped digit', () => {
    expect(isValidAadhaar('234567890125')).toBe(false);
  });

  it('rejects numbers that are the wrong length or shape', () => {
    expect(isValidAadhaar('12345678901')).toBe(false);
    expect(isValidAadhaar('abcdefghijkl')).toBe(false);
    expect(isValidAadhaar('')).toBe(false);
  });

  it('rejects numbers starting with 0 or 1, which are never issued', () => {
    expect(isValidAadhaar('012345678901')).toBe(false);
    expect(isValidAadhaar('112345678901')).toBe(false);
  });

  it('normalises spacing and exposes only the last four digits', () => {
    expect(normalizeAadhaar('2345 6789 0124')).toBe('234567890124');
    expect(aadhaarLast4('2345 6789 0124')).toBe('0124');
    expect(maskAadhaar('0124')).toBe('XXXX XXXX 0124');
  });

  it('hashes deterministically per pepper and never returns the raw number', () => {
    const hash = hashAadhaar('234567890124', 'pepper');
    expect(hash).toBe(hashAadhaar('2345 6789 0124', 'pepper'));
    expect(hash).not.toContain('234567890124');
    expect(hash).not.toBe(hashAadhaar('234567890124', 'other-pepper'));
  });
});

describe('pan validation', () => {
  it('accepts a well formed PAN in any case', () => {
    expect(isValidPan('ABCDE1234F')).toBe(true);
    expect(isValidPan('abcde1234f')).toBe(true);
    expect(normalizePan('abcde1234f')).toBe('ABCDE1234F');
  });

  it('rejects malformed PANs', () => {
    expect(isValidPan('ABCD1234F')).toBe(false);
    expect(isValidPan('ABCDE12345')).toBe(false);
    expect(isValidPan('12345ABCDE')).toBe(false);
  });
});

describe('bank details validation', () => {
  it('accepts a well formed IFSC and normalises case', () => {
    expect(isValidIfsc('HDFC0001234')).toBe(true);
    expect(isValidIfsc('hdfc0001234')).toBe(true);
    expect(normalizeIfsc('hdfc0001234')).toBe('HDFC0001234');
  });

  it('rejects malformed IFSC codes', () => {
    expect(isValidIfsc('HDFC1001234')).toBe(false); // 5th char must be 0
    expect(isValidIfsc('HDF0001234')).toBe(false); // too short
    expect(isValidIfsc('HDFC00012345')).toBe(false); // too long
  });

  it('accepts account numbers of realistic length and masks them', () => {
    expect(isValidAccountNumber('123456789')).toBe(true);
    expect(isValidAccountNumber('1234 5678 9012 3456')).toBe(true);
    expect(isValidAccountNumber('12345678')).toBe(false);
    expect(accountLast4('1234 5678 9012')).toBe('9012');
    expect(maskAccount('9012')).toBe('••••••9012');
  });
});
