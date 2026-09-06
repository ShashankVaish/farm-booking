import type { ReactNode } from 'react';
import { DashboardChrome } from './dashboard-chrome';
import { buildPageMetadata } from '@/lib/seo/build-metadata';

export const metadata = buildPageMetadata({
  title: 'Account',
  path: '/dashboard',
  noIndex: true,
});

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <DashboardChrome>{children}</DashboardChrome>;
}
