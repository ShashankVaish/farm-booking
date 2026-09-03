import { cn } from '@/lib/cn';
import styles from './hospitality.module.css';

export function Rating({
  value,
  count,
}: {
  value: number;
  count?: number;
}) {
  const rounded = Math.round(value * 2) / 2;
  const label = count !== undefined ? `${value.toFixed(1)} from ${count} reviews` : `${value.toFixed(1)} rating`;

  return (
    <span className={styles.stars} aria-label={label}>
      {Array.from({ length: 5 }).map((_, index) => {
        const filled = index + 1 <= rounded;
        return (
          <svg key={index} width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <path
              d="M6 1.2 7.4 4.3 10.8 4.6 8.2 6.8 9 10.2 6 8.5 3 10.2 3.8 6.8 1.2 4.6 4.6 4.3Z"
              fill={filled ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth="0.8"
            />
          </svg>
        );
      })}
      <span className="t-metadata" style={{ marginLeft: '0.35rem', color: 'var(--color-text-secondary)' }}>
        {value.toFixed(1)}
        {count !== undefined ? ` (${count})` : ''}
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
