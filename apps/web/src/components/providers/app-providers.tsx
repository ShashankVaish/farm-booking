'use client';

import type { ReactNode } from 'react';
import { ToastProvider } from '@/components/providers/toast-provider';
import { WishlistProvider } from '@/components/providers/wishlist-provider';
import { MaintenanceScreen } from '@/components/maintenance/maintenance-screen';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <WishlistProvider>{children}</WishlistProvider>
      {/* On every page: appears only when the backend cannot be reached. */}
      <MaintenanceScreen />
    </ToastProvider>
  );
}
