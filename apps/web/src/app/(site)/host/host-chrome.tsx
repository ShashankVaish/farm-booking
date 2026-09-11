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
  { href: '/host/settings', label: 'Settings' },
];

export function HostChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState(false);
  const [upgradeError, setUpgradeError] = useState<string | null>(null);

  async function becomeHost() {
    setUpgrading(true);
    setUpgradeError(null);
    try {
      const result = await hostApi.becomeHost();
      // Reflect the new role immediately so the dashboard renders without a
      // round trip, then refresh so the header and nav pick it up too.
      setUser((current) => (current ? { ...current, role: result.role as AuthUser['role'] } : current));
      router.refresh();
    } catch (err) {
      setUpgradeError(
        err instanceof ApiError ? err.message : 'Could not enable hosting. Please try again.',
      );
    } finally {
      setUpgrading(false);
    }
  }

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
    /*
      A signed-in guest becomes a host on this account, in place.

      This used to send them to /auth/register?role=OWNER — a second account,
      with a second email and a separate wishlist and booking history. Hosting
      is an addition to an account, not a different kind of account, and the API
      still lets a host book other people's places, so accepting costs nothing.
    */
    return (
      <div className={`container ${styles.gate}`}>
        <EmptyState
          title="Start hosting"
          description="Add hosting to this account and list your farmhouse, villa or party venue. You keep your bookings and wishlist, and can still book other stays as normal."
        />
        {upgradeError ? (
          <p className="t-body-small" role="alert" style={{ color: 'var(--color-error)' }}>
            {upgradeError}
          </p>
        ) : null}
        <Button onClick={() => void becomeHost()} disabled={upgrading} loading={upgrading}>
          {upgrading ? 'Setting up…' : 'Become a host'}
        </Button>
        <p className="t-body-small" style={{ marginTop: 'var(--space-4)' }}>
          Hosting on a different account? <Link href="/auth/login?next=/host">Sign in</Link>
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
        {/*
          A host is still a guest: they book other people's places, keep a
          wishlist and have trips of their own. Without this the guest side of
          the account is only reachable by typing the URL.
        */}
        <Link href="/dashboard" className={cn(styles.navLink, styles.navCrossLink)}>
          My trips &amp; wishlist
        </Link>
      </nav>
      <div>{children}</div>
    </div>
  );
}
