import { describe, expect, it } from 'vitest';
import { nextWishlistIds, rollbackWishlistIds } from '@/lib/wishlist/optimistic';

describe('wishlist optimistic updates', () => {
  it('adds then rolls back on failure', () => {
    const start = new Set<string>(['a']);
    const { next, action } = nextWishlistIds(start, 'b');
    expect(action).toBe('added');
    expect([...next]).toEqual(['a', 'b']);
    expect([...rollbackWishlistIds(next, 'b', action)]).toEqual(['a']);
  });

  it('removes then restores on failure', () => {
    const start = new Set<string>(['a', 'b']);
    const { next, action } = nextWishlistIds(start, 'b');
    expect(action).toBe('removed');
    expect([...next]).toEqual(['a']);
    expect([...rollbackWishlistIds(next, 'b', action)].sort()).toEqual(['a', 'b']);
  });
});
