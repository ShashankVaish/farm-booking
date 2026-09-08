import { createHmac } from 'crypto';

/**
 * Aadhaar numbers carry a Verhoeff checksum, so a mistyped or invented number
 * can be rejected before a reviewer ever sees the document. Tables below are
 * the standard Verhoeff dihedral group D5 multiplication, permutation and
 * inverse tables.
 */
const D5 = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];

const PERM = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

export function normalizeAadhaar(value: string): string {
  return value.replace(/[\s-]/g, '');
}

export function isValidAadhaar(value: string): boolean {
  const digits = normalizeAadhaar(value);
  if (!/^\d{12}$/.test(digits)) {
    return false;
  }
  // Real Aadhaar numbers never begin with 0 or 1.
  if (digits.startsWith('0') || digits.startsWith('1')) {
    return false;
  }
  let checksum = 0;
  const reversed = digits.split('').reverse();
  for (let i = 0; i < reversed.length; i += 1) {
    checksum = D5[checksum][PERM[i % 8][Number(reversed[i])]];
  }
  return checksum === 0;
}

const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export function normalizePan(value: string): string {
  return value.replace(/\s/g, '').toUpperCase();
}

export function isValidPan(value: string): boolean {
  return PAN_PATTERN.test(normalizePan(value));
}

export function aadhaarLast4(value: string): string {
  return normalizeAadhaar(value).slice(-4);
}

/**
 * Keyed hash of the Aadhaar number. Stored instead of the number itself so the
 * platform can spot the same identity being reused across host accounts without
 * ever retaining the raw value.
 */
export function hashAadhaar(value: string, pepper: string): string {
  return createHmac('sha256', pepper).update(normalizeAadhaar(value)).digest('hex');
}

export function maskAadhaar(last4: string | null | undefined): string {
  return last4 ? `XXXX XXXX ${last4}` : '';
}
