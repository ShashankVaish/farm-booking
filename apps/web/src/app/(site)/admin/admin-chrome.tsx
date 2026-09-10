'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode, useEffect, useState } from 'react';
import { EmptyState, ErrorState, Spinner } from '@/components/ui/feedback';
import { adminApi } from '@/lib/admin/api';
import { ApiError } from '@/lib/api/errors';
import type { AuthUser } from '@/lib/properties/types';
import { cn } from '@/lib/cn';
import { LoginForm } from '@/app/(auth)/auth/auth-forms';
import styles from './admin.module.css';

const LINKS = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/owners', label: 'Owners' },
  { href: '/admin/properties', label: 'Properties' },
  { href: '/admin/bookings', label: 'Bookings' },
  { href: '/admin/payments', label: 'Payments' },
  { href: '/admin/refunds', label: 'Refunds' },
  { href: '/admin/payouts', label: 'Payouts' },
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
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

  function load() {
    setLoading(true);
    setError(null);
    setForbidden(false);
    setNeedsLogin(false);
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
          setNeedsLogin(true);
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
  }, []);

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  if (loading) {
    return (
      <div className="container" style={{ padding: 'var(--space-12) 0' }}>
        <Spinner label="Loading admin" />
      </div>
    );
  }

  if (needsLogin) {
    return (
      <div className="container">
        <LoginForm
          adminOnly
          onAuthenticated={() => {
            setNeedsLogin(false);
            load();
          }}
        />
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

  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : Boolean(pathname?.startsWith(href));
  const currentSection = LINKS.find((link) => isActive(link.href))?.label ?? 'Admin';

  return (
    <div className={`container ${styles.frame}`}>
      <div>
        <button
          type="button"
          className={styles.navToggle}
          aria-expanded={navOpen}
          aria-controls="admin-nav"
          onClick={() => setNavOpen((open) => !open)}
        >
          <span className={styles.navToggleLabel}>
            <span className={styles.navToggleHint}>Section</span>
            <span className={styles.navToggleSection}>{currentSection}</span>
          </span>
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
            <path
              d={navOpen ? 'M4 10l4-4 4 4' : 'M4 6l4 4 4-4'}
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
            />
          </svg>
        </button>

        {/* Hidden only on small screens; the sidebar is always shown from 1024px. */}
        <nav
          id="admin-nav"
          className={styles.nav}
          aria-label="Admin"
          data-open={navOpen ? 'true' : 'false'}
        >
          {LINKS.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(styles.navLink, active && styles.navLinkActive)}
                aria-current={active ? 'page' : undefined}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div>{children}</div>
    </div>
  );
}
