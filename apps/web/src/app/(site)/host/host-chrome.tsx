'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, Spinner } from '@/components/ui/feedback';
import { hostApi } from '@/lib/host/host-api';
import { ApiError } from '@/lib/api/errors';
import type { AuthUser } from '@/lib/properties/types';
import { cn } from '@/lib/cn';
import styles from './host.module.css';

const LINKS = [
  { href: '/host', label: 'Overview' },
  { href: '/host/properties', label: 'Properties' },
  { href: '/host/calendar', label: 'Calendar' },
  { href: '/host/bookings', label: 'Bookings' },
  { href: '/host/earnings', label: 'Earnings' },
  { href: '/host/reviews', label: 'Reviews' },
  { href: '/host/settings', label: 'Settings' },
];

export function HostChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    setError(null);
    hostApi
      .me()
      .then(setUser)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          router.replace(`/auth/login?next=${encodeURIComponent(pathname || '/host')}`);
          return;
        }
        setError(err instanceof ApiError ? err.message : 'Could not load your host account.');
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return (
      <div className="container" style={{ padding: 'var(--space-12) 0' }}>
        <Spinner label="Loading host dashboard" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container" style={{ padding: 'var(--space-12) 0' }}>
        <ErrorState description={error} onRetry={load} />
      </div>
    );
  }

  if (user && user.role !== 'OWNER' && user.role !== 'ADMIN') {
    return (
      <div className={`container ${styles.gate}`}>
        <EmptyState
          title="Become a host"
          description="Owner tools are for listed properties. Create a host account to add a farmhouse, set location, and submit for review."
          actionHref="/auth/register?role=OWNER"
          actionLabel="Create host account"
        />
        <p className="t-body-small" style={{ marginTop: 'var(--space-4)' }}>
          Already have a host login? <Link href="/auth/login?next=/host">Sign in</Link>
        </p>
      </div>
    );
  }

  return (
    <div className={`container ${styles.frame}`}>
      <nav className={styles.nav} aria-label="Host">
        {LINKS.map((link) => {
          const active = link.href === '/host' ? pathname === '/host' : pathname.startsWith(link.href);
          return (
            <Link key={link.href} href={link.href} className={cn(styles.navLink, active && styles.navLinkActive)}>
              {link.label}
            </Link>
          );
        })}
        <Button href="/host/properties/new" size="sm">
          New listing
        </Button>
      </nav>
      <div>{children}</div>
    </div>
  );
}
