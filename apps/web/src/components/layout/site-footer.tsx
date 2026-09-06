import Link from 'next/link';
import { brand } from '@/lib/config/brand';
import styles from './shell.module.css';

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.footerInner}`}>
        <div>
          <p className="t-label">{brand.name}</p>
          <p className="t-body-small">{brand.tagline}</p>
        </div>
        <nav className={styles.footerNav} aria-label="Footer">
          <Link href="/explore">Explore</Link>
          <Link href="/stays">Stays</Link>
          <Link href="/events">Events</Link>
          <Link href="/host">List your property</Link>
          <Link href="/auth/login">Sign in</Link>
        </nav>
        <p className="t-caption">Private farmhouses and villas across India. Prices in INR.</p>
      </div>
    </footer>
  );
}
