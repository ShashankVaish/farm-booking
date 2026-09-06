import type { CSSProperties } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import styles from './ui.module.css';

export function Skeleton({ width = '100%', height = '1rem', className }: { width?: string; height?: string; className?: string }) {
  return (
    <span
      className={cn(styles.skeleton, className)}
      style={{ width, height } as CSSProperties}
      aria-hidden="true"
    />
  );
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <span role="status" aria-live="polite" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
      <span className={styles.spinner} />
      <span className="visually-hidden">{label}</span>
    </span>
  );
}

export function EmptyState({
  title,
  description,
  actionHref,
  actionLabel,
}: {
  title: string;
  description: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className={styles.state}>
      <h2 className="t-h3">{title}</h2>
      <p className="t-body-small">{description}</p>
      {actionHref && actionLabel ? (
        <div style={{ marginTop: '1.25rem' }}>
          <Button href={actionHref} variant="secondary">
            {actionLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  description = 'Please try again in a moment.',
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  return (
    <div className={styles.state} role="alert">
      <h2 className="t-h3">{title}</h2>
      <p className="t-body-small">{description}</p>
      {onRetry ? (
        <div style={{ marginTop: '1.25rem' }}>
          <Button variant="secondary" onClick={onRetry}>
            Try again
          </Button>
        </div>
      ) : null}
    </div>
  );
}
