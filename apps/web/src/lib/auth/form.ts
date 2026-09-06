import { ApiError, NetworkError } from '@/lib/api/errors';

export function indianMobile(raw: string): string | undefined {
  const digits = raw.replace(/\D/g, '');
  if (!digits) {
    return undefined;
  }

  let candidate = digits;
  if (candidate.startsWith('91') && candidate.length === 12) {
    candidate = candidate.slice(2);
  } else if (candidate.startsWith('0') && candidate.length === 11) {
    candidate = candidate.slice(1);
  }

  return /^[6-9]\d{9}$/.test(candidate) ? candidate : undefined;
}

export function isStrongPassword(password: string): boolean {
  return /^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(password);
}

export function authErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof NetworkError) {
    return err.message;
  }
  if (err instanceof ApiError) {
    if (Array.isArray(err.details) && err.details.every((item) => typeof item === 'string')) {
      return err.details.join(' ');
    }
    return err.message || fallback;
  }
  return fallback;
}
