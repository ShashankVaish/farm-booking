import Link from 'next/link';
import { brand } from '@/lib/config/brand';
import styles from './shell.module.css';

export function SiteFooter() {
  const { support } = brand;

  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.footerInner}`}>
        <div>
          <p className="t-label">{brand.name}</p>
          <p className="t-body-small">{brand.tagline}</p>
        </div>
        <nav className={styles.footerNav} aria-label="Footer">
          <Link href="/explore">Explore</Link>
          <Link href="/map">Map view</Link>
          <Link href="/host">List your property</Link>
          <Link href="/auth/login">Sign in</Link>
          {/* Guests and hosts agree to different terms, so both are linked
              rather than a single ambiguous "Terms". */}
          <Link href="/terms/guest">Guest terms</Link>
          <Link href="/terms/host">Host terms</Link>
        </nav>
        {/*
          Real links, not plain text. On a phone the number has to be tappable
          to be any use, and an address that cannot be clicked gets mistyped.
        */}
        <div className={styles.support}>
          <p className="t-label">Need help?</p>
          <p className="t-body-small">
            Call or message us on{' '}
            <a href={support.phoneHref} className={styles.supportLink}>
              {support.phone}
            </a>
            , or email{' '}
            <a href={support.emailHref} className={styles.supportLink}>
              {support.email}
            </a>
            .
          </p>
          <p className="t-caption">{support.hours}</p>
        </div>
        <p className="t-caption">Private farmhouses and villas across India. Prices in INR.</p>
      </div>
    </footer>
  );
}
