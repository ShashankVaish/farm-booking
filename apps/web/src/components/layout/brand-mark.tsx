import { brand } from '@/lib/config/brand';
import styles from './shell.module.css';

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={styles.brand}>
      <svg className={styles.mark} viewBox="0 0 32 32" aria-hidden="true">
        <rect x="3" y="14" width="26" height="13" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M6 14 V9 H26 V14" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M16 9 V5" stroke="currentColor" strokeWidth="1.5" />
        <rect x="13.5" y="18" width="5" height="9" fill="currentColor" />
      </svg>
      {compact ? <span className="visually-hidden">{brand.name}</span> : <span className={styles.brandName}>{brand.name}</span>}
    </span>
  );
}
