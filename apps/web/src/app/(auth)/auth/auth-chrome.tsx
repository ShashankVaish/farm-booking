'use client';

import { useState, type ReactNode } from 'react';
import { BrandLogo } from '@/components/layout/brand-mark';
import { Input } from '@/components/ui/forms';
import { brand } from '@/lib/config/brand';
import { cn } from '@/lib/cn';
import styles from './auth.module.css';

/* --- Brand panel + card shell --------------------------------------------- */

const POINTS = [
  'Every listing is checked before it goes live.',
  'Weekend rates and fees are priced on the server — no surprises at checkout.',
  'Pay securely by card, UPI or netbanking.',
];

export function AuthShell({
  kicker,
  title,
  subtitle,
  children,
}: {
  kicker: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className={`container ${styles.page}`}>
      <aside className={styles.aside}>
        <p className={styles.asideKicker}>{brand.name}</p>
        <h2 className={styles.asideTitle}>{brand.tagline}</h2>
        <p className={styles.asideLead}>{brand.shortDescription}</p>
        <ul className={styles.points}>
          {POINTS.map((point) => (
            <li key={point} className={styles.point}>
              <span className={styles.pointMark} aria-hidden="true">
                <svg width="12" height="12" viewBox="0 0 12 12">
                  <path
                    d="M2.5 6.2l2.3 2.3L9.5 3.8"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              {point}
            </li>
          ))}
        </ul>
      </aside>

      <div className={styles.card}>
        <div className={styles.mobileBrand}>
          <BrandLogo className={styles.mobileBrandMark} />
          <span className={styles.mobileBrandText}>{brand.tagline}</span>
        </div>
        <p className={styles.kicker}>{kicker}</p>
        <h1 className={styles.title}>{title}</h1>
        {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
        {children}
      </div>
    </div>
  );
}

/* --- Two-option switch ----------------------------------------------------- */

export type SegmentOption<T extends string> = { value: T; label: string };

/**
 * Toggle-button group rather than a tablist: both options submit the same form,
 * they just change which credential is collected. `aria-pressed` keeps each
 * button independently reachable by Tab, which is the simplest thing that is
 * also correct for keyboard users.
 */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: ReadonlyArray<SegmentOption<T>>;
  onChange: (next: T) => void;
}) {
  return (
    <div className={styles.segmented} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          className={cn(styles.segment, value === option.value && styles.segmentActive)}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/* --- Account type ---------------------------------------------------------- */

export function AccountTypeChooser({
  value,
  onChange,
}: {
  value: 'CUSTOMER' | 'OWNER';
  onChange: (next: 'CUSTOMER' | 'OWNER') => void;
}) {
  const options = [
    {
      value: 'CUSTOMER' as const,
      title: 'Book a stay',
      note: 'Find and reserve a place for your celebration.',
    },
    {
      value: 'OWNER' as const,
      title: 'List a property',
      note: 'Earn from your farmhouse, villa or party house.',
    },
  ];

  return (
    <div className={styles.roleGroup} role="group" aria-label="Account type">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          className={cn(styles.role, value === option.value && styles.roleActive)}
          onClick={() => onChange(option.value)}
        >
          <span className={styles.roleTitle}>
            {value === option.value ? (
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                <circle cx="7" cy="7" r="6" fill="none" stroke="currentColor" strokeWidth="1.4" />
                <circle cx="7" cy="7" r="3" fill="currentColor" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                <circle cx="7" cy="7" r="6" fill="none" stroke="currentColor" strokeWidth="1.4" />
              </svg>
            )}
            {option.title}
          </span>
          <span className={styles.roleNote}>{option.note}</span>
        </button>
      ))}
    </div>
  );
}

/* --- Google ---------------------------------------------------------------- */

function GoogleMark() {
  return (
    <svg className={styles.googleMark} viewBox="0 0 18 18" aria-hidden="true" focusable="false">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.583-5.036-3.71H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
      />
    </svg>
  );
}

export function GoogleButton({
  label,
  disabled,
  onClick,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className={styles.google} disabled={disabled} onClick={onClick}>
      <GoogleMark />
      {label}
    </button>
  );
}

export function Divider({ children }: { children: ReactNode }) {
  return <div className={styles.divider}>{children}</div>;
}

/* --- Password with reveal --------------------------------------------------- */

export function PasswordField({
  id,
  label,
  value,
  onChange,
  hint,
  autoComplete,
  minLength,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (next: string) => void;
  hint?: string;
  autoComplete: string;
  minLength?: number;
}) {
  const [shown, setShown] = useState(false);

  return (
    <div className={styles.password}>
      <Input
        id={id}
        label={label}
        type={shown ? 'text' : 'password'}
        required
        minLength={minLength}
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        hint={hint}
      />
      <button
        type="button"
        className={styles.reveal}
        onClick={() => setShown((current) => !current)}
        aria-pressed={shown}
        aria-controls={id}
      >
        {shown ? 'Hide' : 'Show'}
        <span className="visually-hidden"> password</span>
      </button>
    </div>
  );
}

/* --- Loading placeholder ---------------------------------------------------- */

function SkeletonLine({ height, width }: { height: string; width: string }) {
  return <div className={styles.skeletonLine} style={{ height, width }} />;
}

/**
 * Stand-in for the auth card while the client bundle loads. Matches the real
 * card's padding and control heights so the form does not jump into place.
 */
export function AuthFormSkeleton({ fields = 2 }: { fields?: number }) {
  return (
    <div className={`container ${styles.page}`}>
      <div className={styles.aside} aria-hidden="true">
        <SkeletonLine height="0.75rem" width="7rem" />
        <div style={{ marginTop: 'var(--space-4)' }}>
          <SkeletonLine height="2.75rem" width="min(100%, 22rem)" />
        </div>
        <div style={{ marginTop: 'var(--space-5)' }}>
          <SkeletonLine height="1rem" width="min(100%, 26rem)" />
        </div>
      </div>

      <div className={styles.card} role="status" aria-busy="true" aria-label="Loading the form">
        <SkeletonLine height="0.75rem" width="5rem" />
        <div style={{ marginTop: 'var(--space-3)' }}>
          <SkeletonLine height="2rem" width="60%" />
        </div>
        <div style={{ marginTop: 'var(--space-6)' }}>
          <SkeletonLine height="3rem" width="100%" />
        </div>
        <div className={styles.stack} style={{ marginTop: 'var(--space-5)' }}>
          {Array.from({ length: fields }, (_, index) => (
            <div key={index}>
              <SkeletonLine height="0.75rem" width="4.5rem" />
              <div style={{ marginTop: 'var(--space-2)' }}>
                <SkeletonLine height="var(--touch)" width="100%" />
              </div>
            </div>
          ))}
          <div style={{ marginTop: 'var(--space-1)' }}>
            <SkeletonLine height="var(--touch)" width="100%" />
          </div>
        </div>
        <span className="visually-hidden">Loading the form</span>
      </div>
    </div>
  );
}
