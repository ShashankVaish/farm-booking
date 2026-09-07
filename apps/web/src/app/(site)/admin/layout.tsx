import type { ReactNode } from 'react';
import { AdminChrome } from './admin-chrome';
import { buildPageMetadata } from '@/lib/seo/build-metadata';

export const metadata = buildPageMetadata({
  title: 'Admin',
  path: '/admin',
  noIndex: true,
});

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <AdminChrome>{children}</AdminChrome>;
}
