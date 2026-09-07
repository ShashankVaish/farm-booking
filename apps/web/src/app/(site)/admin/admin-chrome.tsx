'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';
import { EmptyState, ErrorState, Spinner } from '@/components/ui/feedback';
import { adminApi } from '@/lib/admin/api';
import { ApiError } from '@/lib/api/errors';
import type { AuthUser } from '@/lib/properties/types';
import { cn } from '@/lib/cn';
import styles from './admin.module.css';

const LINKS = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/owners', label: 'Owners' },
  { href: '/admin/properties', label: 'Properties' },
  { href: '/admin/bookings', label: 'Bookings' },
  { href: '/admin/payments', label: 'Payments' },
  { href: '/admin/refunds', label: 'Refunds' },
  { href: '/admin/coupons', label: 'Coupons' },
  { href: '/admin/amenities', label: 'Amenities' },
  { href: '/admin/reviews', label: 'Reviews' },
  { href: '/admin/support', label: 'Support' },
  { href: '/admin/notifications', label: 'Notifications' },
  { href: '/admin/reports', label: 'Reports' },
  { href: '/admin/settings', label: 'Settings' },
];

export function AdminChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    setError(null);
    setForbidden(false);
    adminApi
      .me()
      .then(async (account) => {
        if (account.role !== 'ADMIN') {
          setForbidden(true);
          setUser(account);
          return;
        }
        try {
          await adminApi.settings();
          setUser(account);
        } catch (err) {
          if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
            setForbidden(true);
            return;
          }
          throw err;
        }
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          router.replace(`/auth/login?next=${encodeURIComponent(pathname || '/admin')}`);
          return;
        }
        if (err instanceof ApiError && err.status === 403) {
          setForbidden(true);
          return;
        }
        setError(err instanceof ApiError ? err.message : 'Could not load the admin workspace.');
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
        <Spinner label="Loading admin" />
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

  if (forbidden || user?.role !== 'ADMIN') {
    return (
      <div className={`container ${styles.gate}`}>
        <EmptyState
          title="Admin access required"
          description="This workspace is restricted. Access is enforced by the API — hiding screens does not grant permissions."
          actionHref="/"
          actionLabel="Back to home"
        />
      </div>
    );
  }

  return (
    <div className={`container ${styles.frame}`}>
      <nav className={styles.nav} aria-label="Admin">
        {LINKS.map((link) => {
          const active = link.href === '/admin' ? pathname === '/admin' : pathname?.startsWith(link.href);
          return (
            <Link key={link.href} href={link.href} className={cn(styles.navLink, active && styles.navLinkActive)}>
              {link.label}
            </Link>
          );
        })}
      </nav>
      <div>{children}</div>
    </div>
  );
}
