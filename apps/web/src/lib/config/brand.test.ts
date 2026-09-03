import { describe, expect, it } from 'vitest';
import { brand } from '@/lib/config/brand';

describe('brand config', () => {
  it('uses a replaceable placeholder name', () => {
    expect(brand.name).toBeTruthy();
    expect(brand.tagline.toLowerCase()).toContain('celebration');
  });
});
