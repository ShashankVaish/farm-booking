import { brand } from '@/lib/config/brand';
import styles from './shell.module.css';

/**
 * The Baagly mark: a coral disc holding a cream mountain range, moon and
 * cabin, with the wave that runs through the wordmark. Drawn inline so it
 * stays crisp at any size and needs no network request in the header.
 */
export function BrandLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <circle cx="32" cy="32" r="32" fill="var(--brand-coral)" />
      <circle cx="44.5" cy="19" r="3.4" fill="var(--brand-cream)" />
      <path
        d="M7 45 L18.5 29 L23 33.6 L26 30.5 L33.5 19 L40 28.6 L43 26.2 L47.5 32 L51 29 L57 45 Z"
        fill="var(--brand-cream)"
      />
      {/* Coral outline keeps the cabin readable against the cream ridge behind it. */}
      <g stroke="var(--brand-coral)" strokeWidth="1.8" strokeLinejoin="round">
        <path d="M46.5 41.5 V32.5 H56.5 V41.5 Z" fill="var(--brand-cream)" />
        <path d="M43.6 33.4 L51.5 26.2 L59.4 33.4" fill="none" strokeLinecap="round" />
      </g>
      <g fill="var(--brand-coral)">
        <rect x="49.2" y="34.8" width="2" height="2" />
        <rect x="52" y="34.8" width="2" height="2" />
        <rect x="49.2" y="37.6" width="2" height="2" />
        <rect x="52" y="37.6" width="2" height="2" />
      </g>
      <path
        d="M7 46.6 C17 43.6 25.5 48.8 33.5 47.2 C42.5 45.4 49 43.8 57 47.4"
        fill="none"
        stroke="var(--brand-cream)"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={styles.brand}>
      <BrandLogo className={styles.mark} />
      {compact ? (
        <span className="visually-hidden">{brand.name}</span>
      ) : (
        <span className={styles.brandName}>{brand.name}</span>
      )}
    </span>
  );
}
