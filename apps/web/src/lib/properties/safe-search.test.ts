import { afterEach, describe, expect, it, vi } from 'vitest';
import { ServiceUnavailableError } from '@/lib/api/availability';
import { safeSearch } from './api';

afterEach(() => vi.unstubAllGlobals());

describe('safeSearch when the backend is down', () => {
  it('raises a maintenance error instead of showing an empty catalogue', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')));
    await expect(safeSearch({ limit: 6 })).rejects.toBeInstanceOf(ServiceUnavailableError);
  });

  it('still returns an empty page for an ordinary API error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ success: false, error: { code: 'VALIDATION_ERROR', message: 'bad' } }),
      }),
    );
    await expect(safeSearch({ limit: 6 })).resolves.toMatchObject({ items: [] });
  });
});
