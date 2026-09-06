import type { ReactNode } from 'react';
import { HostChrome } from './host-chrome';
import { buildPageMetadata } from '@/lib/seo/build-metadata';

export const metadata = buildPageMetadata({
  title: 'Host',
  path: '/host',
  noIndex: true,
});

export default function HostLayout({ children }: { children: ReactNode }) {
  return <HostChrome>{children}</HostChrome>;
}
