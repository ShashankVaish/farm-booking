import { brand } from '@/lib/config/brand';
import styles from './shell.module.css';

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.footerInner}`}>
        <p className="t-label">{brand.name}</p>
        <p className="t-body-small">{brand.tagline}</p>
      </div>
    </footer>
  );
}
