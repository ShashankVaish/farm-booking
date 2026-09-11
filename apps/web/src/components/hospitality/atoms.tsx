import { cn } from '@/lib/cn';
import styles from './hospitality.module.css';

/**
 * The "Trusted property" mark.
 *
 * Granted by an admin after a manual check and never by the host, so it is the
 * one claim on a card a guest can take at face value. It stands where the star
 * rating used to: with guest reviews removed there is nothing left to average,
 * and a row of empty stars says less than nothing.
 *
 * Anchored to the opposite corner from the category badge so the two never
 * collide on a narrow card.
 */
export function TrustedBadge() {
  return (
    <span className={styles.trustedRow}>
      <span className={styles.trustedChip}>
        <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path
            d="M6 0.8 10.4 2.5V6c0 2.4-1.8 4.2-4.4 5.2C3.4 10.2 1.6 8.4 1.6 6V2.5Z"
            fill="currentColor"
            opacity="0.18"
          />
          <path
            d="M6 0.8 10.4 2.5V6c0 2.4-1.8 4.2-4.4 5.2C3.4 10.2 1.6 8.4 1.6 6V2.5Z"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.9"
            strokeLinejoin="round"
          />
          <path
            d="M4.1 5.9 5.5 7.3 8 4.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.1"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Trusted
      </span>
    </span>
  );
}

export function PriceDisplay({
  amount,
  suffix = 'night',
  prefix,
}: {
  amount: number;
  suffix?: string;
  prefix?: string;
}) {
  const formatted = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);

  return (
    <p className={cn('t-price', styles.priceRow)}>
      {prefix ? <span className="t-caption">{prefix}</span> : null}
      <span>{formatted}</span>
      <span className="t-caption">/ {suffix}</span>
    </p>
  );
}

export function AmenityItem({ label }: { label: string }) {
  return (
    <span className={styles.amenity}>
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
        <circle cx="7" cy="7" r="5.2" fill="none" stroke="currentColor" strokeWidth="1.2" />
      </svg>
      {label}
    </span>
  );
}

export function PropertyBadge({ children }: { children: string }) {
  return (
    <span className={styles.badgeRow}>
      <span
        style={{
          display: 'inline-flex',
          minHeight: '1.5rem',
          alignItems: 'center',
          padding: '0 0.5rem',
          background: 'var(--color-surface-elevated)',
          fontSize: '0.75rem',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}
      >
        {children}
      </span>
    </span>
  );
}
