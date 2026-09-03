import { describe, expect, it } from 'vitest';
import { breakpoints } from '@/lib/config/breakpoints';
import { colorTokens, radii, shadows, typeRoles } from '@/lib/config/tokens';

describe('design tokens', () => {
  it('defines the required colour roles', () => {
    expect(colorTokens).toEqual(
      expect.arrayContaining([
        'background',
        'surface',
        'primary',
        'accent',
        'error',
      ]),
    );
  });

  it('defines type roles used by the product UI', () => {
    expect(typeRoles).toEqual(
      expect.arrayContaining(['display', 'h1', 'body', 'price', 'metadata']),
    );
  });

  it('keeps radius and shadow scales small', () => {
    expect(radii).toHaveLength(5);
    expect(shadows).toHaveLength(3);
  });

  it('includes the required breakpoints', () => {
    expect(Object.keys(breakpoints).map(Number)).toEqual([320, 375, 390, 414, 768, 1024, 1280, 1440, 1920]);
  });
});
