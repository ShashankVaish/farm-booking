import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import styles from './ui.module.css';

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: 'neutral' | 'accent' | 'solid';
  className?: string;
}) {
  return (
    <span
      className={cn(
        styles.badge,
        tone === 'accent' && styles.badgeAccent,
        tone === 'solid' && styles.badgeSolid,
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Card({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn(styles.card, className)} {...props}>
      {children}
    </div>
  );
}

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <span className={styles.avatar} style={{ width: size, height: size }} aria-hidden="true">
      {initials || 'G'}
    </span>
  );
}

export function Divider() {
  return <hr className={styles.divider} />;
}
