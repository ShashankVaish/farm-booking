'use client';

import type { ReactNode } from 'react';
import { ToastProvider } from '@/components/providers/toast-provider';
import { WishlistProvider } from '@/components/providers/wishlist-provider';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <WishlistProvider>{children}</WishlistProvider>
    </ToastProvider>
  );
}
