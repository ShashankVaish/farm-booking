'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { API_STATUS_EVENT, checkApiHealth, resetApiStatus } from '@/lib/api/availability';
import { brand } from '@/lib/config/brand';
import styles from './maintenance.module.css';

const RECHECK_SECONDS = 15;

/** Planned maintenance, switched on for a deploy with NEXT_PUBLIC_MAINTENANCE_MODE=true. */
const PLANNED = process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true';

type Mode = 'hidden' | 'maintenance' | 'offline';

/*
  A full-page notice shown while the backend cannot be reached, so visitors
  see "we'll be right back" instead of empty lists and error toasts.

  It appears only after confirming: an API call that failed to reach the
  server triggers a health check, and the screen shows only if that fails too,
  so a single dropped request never flashes it. While shown it re-checks every
  15 seconds, and when the server answers again it disappears and refreshes
  the page's data on its own. The visitor's own connection being off is told
  apart and worded as such.

  `force` shows it unconditionally (the error boundary uses it once it has
  confirmed the server is down).
*/
export function MaintenanceScreen({ force = false }: { force?: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(force || PLANNED ? 'maintenance' : 'hidden');
  const [seconds, setSeconds] = useState(RECHECK_SECONDS);
  const [checking, setChecking] = useState(false);
  const checkingRef = useRef(false);

  const check = useCallback(async () => {
    if (checkingRef.current || PLANNED) return;
    checkingRef.current = true;
    setChecking(true);
    const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
    const healthy = !offline && (await checkApiHealth());
    checkingRef.current = false;
    setChecking(false);
    setSeconds(RECHECK_SECONDS);
    if (healthy) {
      setMode((current) => {
        if (current !== 'hidden') {
          resetApiStatus();
          // Back up: reload the data the page failed to load.
          router.refresh();
        }
        return 'hidden';
      });
      return;
    }
    setMode(offline ? 'offline' : 'maintenance');
  }, [router]);

  // An API call reported the server unreachable: confirm before showing.
  useEffect(() => {
    const onStatus = (event: Event) => {
      const up = (event as CustomEvent<boolean>).detail;
      if (!up) void check();
    };
    const onOnline = () => void check();
    window.addEventListener(API_STATUS_EVENT, onStatus);
    window.addEventListener('online', onOnline);
    return () => {
      window.removeEventListener(API_STATUS_EVENT, onStatus);
      window.removeEventListener('online', onOnline);
    };
  }, [check]);

  // While shown, count down and re-check.
  useEffect(() => {
    if (mode === 'hidden' || PLANNED) return;
    if (seconds <= 0) {
      void check();
      return;
    }
    const timer = window.setTimeout(() => setSeconds((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [mode, seconds, check]);

  if (mode === 'hidden') return null;

  const offline = mode === 'offline';

  return (
    <div className={styles.screen} role="alertdialog" aria-modal="true" aria-labelledby="maintenance-title">
      <div className={styles.card}>
        <div className={styles.icon} aria-hidden="true">
          {offline ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M2 8.8a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 19.5h.01M3 3l18 18" strokeLinecap="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={styles.gear}>
              <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
              <path
                d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </div>
        <p className={styles.label}>{brand.name}</p>
        <h1 id="maintenance-title" className={styles.title}>
          {offline ? "You're offline" : "We'll be right back"}
        </h1>
        <p className={styles.body}>
          {offline
            ? 'Your device has lost its internet connection. This page will continue as soon as you are back online.'
            : "We're doing some quick maintenance to keep things running smoothly. Your bookings and payments are safe, and nothing you have saved is lost."}
        </p>
        {PLANNED ? (
          <p className={styles.status}>Planned maintenance. Please check back shortly.</p>
        ) : (
          <>
            <p className={styles.status} aria-live="polite">
              {checking ? 'Checking…' : `Checking again in ${seconds}s`}
            </p>
            <button type="button" className={styles.retry} onClick={() => void check()} disabled={checking}>
              {checking ? 'Checking…' : 'Try again now'}
            </button>
          </>
        )}
        <p className={styles.contact}>
          Need help with a booking? Call <a href={brand.support.phoneHref}>{brand.support.phone}</a> or email{' '}
          <a href={brand.support.emailHref}>{brand.support.email}</a>.
        </p>
      </div>
    </div>
  );
}
