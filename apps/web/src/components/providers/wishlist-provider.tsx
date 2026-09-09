'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { apiClient } from '@/lib/api/client';
import { memoryTokenStore } from '@/lib/api/token-store';
import { nextWishlistIds, rollbackWishlistIds } from '@/lib/wishlist/optimistic';

type WishlistContextValue = {
  ids: Set<string>;
  has: (propertyId: string) => boolean;
  toggle: (propertyId: string) => Promise<'added' | 'removed' | 'auth'>;
  ready: boolean;
};

const WishlistContext = createContext<WishlistContextValue | null>(null);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [ready, setReady] = useState(false);
  const idsRef = useRef(ids);
  idsRef.current = ids;

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!memoryTokenStore.getAccessToken()) {
        setReady(true);
        return;
      }
      try {
        const items = await apiClient.get<Array<{ propertyId: string }>>('/api/wishlist');
        if (!cancelled) {
          setIds(new Set(items.map((item) => item.propertyId)));
        }
      } catch {
        if (!cancelled) setIds(new Set());
      } finally {
        if (!cancelled) setReady(true);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = useCallback(async (propertyId: string) => {
    if (!memoryTokenStore.getAccessToken()) {
      return 'auth' as const;
    }
    const { next, action } = nextWishlistIds(idsRef.current, propertyId);
    setIds(next);
    try {
      if (action === 'removed') {
        await apiClient.delete(`/api/wishlist/${propertyId}`);
      } else {
        await apiClient.post(`/api/wishlist/${propertyId}`);
      }
      return action;
    } catch (error) {
      setIds((current) => rollbackWishlistIds(current, propertyId, action));
      throw error;
    }
  }, []);

  const value = useMemo(
    () => ({
      ids,
      has: (propertyId: string) => ids.has(propertyId),
      toggle,
      ready,
    }),
    [ids, toggle, ready],
  );

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error('useWishlist must be used within WishlistProvider');
  }
  return context;
}
