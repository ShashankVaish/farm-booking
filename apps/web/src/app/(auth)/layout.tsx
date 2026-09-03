import type { ReactNode } from 'react';
import { SiteShell } from '@/components/layout/site-shell';

export default function AuthGroupLayout({ children }: { children: ReactNode }) {
  return <SiteShell variant="minimal">{children}</SiteShell>;
}
