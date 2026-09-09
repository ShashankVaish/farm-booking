'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';
import { EmptyState, ErrorState, Spinner } from '@/components/ui/feedback';
import { apiClient } from '@/lib/api/client';
import { ApiError } from '@/lib/api/errors';
import type { AuthUser } from '@/lib/properties/types';
import styles from './dashboard.module.css';

const LINKS = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/dashboard/trips', label: 'Trips' },
  { href: '/dashboard/wishlist', label: 'Wishlist' },
  { href: '/dashboard/notifications', label: 'Notifications' },
  { href: '/dashboard/profile', label: 'Profile' },
];

export function DashboardChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiClient
      .get<AuthUser>('/api/auth/me')
      .then(setUser)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          router.replace(`/auth/login?next=${encodeURIComponent(pathname || '/dashboard')}`);
          return;
        }
        setError(err instanceof ApiError ? err.message : 'Could not load your account.');
      })
      .finally(() => setLoading(false));
  }, [pathname, router]);

  if (loading) {
    return (
      <div className="container" style={{ padding: 'var(--space-12) 0' }}>
        <Spinner label="Loading account" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container" style={{ padding: 'var(--space-12) 0' }}>
        <ErrorState description={error} />
      </div>
    );
  }

  if (user?.role === 'OWNER') {
    return (
      <div className="container" style={{ padding: 'var(--space-12) 0' }}>
        <EmptyState
          title="Host account"
          description="Property tools live in the host dashboard."
          actionHref="/host"
          actionLabel="Go to host dashboard"
        />
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: 'var(--space-8) 0 var(--space-16)' }}>
      <nav className={styles.nav} aria-label="Account">
        {LINKS.map((link) => {
          const active = link.href === '/dashboard' ? pathname === '/dashboard' : pathname.startsWith(link.href);
          return (
            <Link key={link.href} href={link.href} aria-current={active ? 'page' : undefined}>
              {link.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
