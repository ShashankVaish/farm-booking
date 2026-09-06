import { describe, expect, it } from 'vitest';
import { ApiError, NetworkError } from '@/lib/api/errors';
import { authErrorMessage, indianMobile, isStrongPassword } from '@/lib/auth/form';

describe('auth form helpers', () => {
  it('normalizes Indian mobile numbers', () => {
    expect(indianMobile('9876543210')).toBe('9876543210');
    expect(indianMobile('+91 98765 43210')).toBe('9876543210');
    expect(indianMobile('09876543210')).toBe('9876543210');
    expect(indianMobile('12345')).toBeUndefined();
    expect(indianMobile('')).toBeUndefined();
  });

  it('requires a letter and a number in passwords', () => {
    expect(isStrongPassword('secret12')).toBe(true);
    expect(isStrongPassword('password')).toBe(false);
  });

  it('surfaces network and validation messages', () => {
    expect(authErrorMessage(new NetworkError(), 'fallback')).toMatch(/reach the server/i);
    expect(
      authErrorMessage(new ApiError(400, 'VALIDATION_ERROR', 'Invalid.', ['Phone is invalid']), 'fallback'),
    ).toBe('Phone is invalid');
  });
});
