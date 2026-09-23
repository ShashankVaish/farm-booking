import Link from 'next/link';
import { BrandMark } from '@/components/layout/brand-mark';
import { brand } from '@/lib/config/brand';
import { addressLine, business } from '@/lib/config/business';
import styles from './shell.module.css';

/*
  Link groups as data. The footer carries ten destinations now — browse,
  company and legal — and a flat row of ten was becoming a wall. Grouping them
  lets a reader find the one they want by category rather than by reading every
  label in turn.
*/
const GROUPS = [
  {
    heading: 'Explore',
    links: [
      { href: '/explore', label: 'All stays' },
      { href: '/map', label: 'Map view' },
      { href: '/stays', label: 'Weekend stays' },
      { href: '/events', label: 'Party venues' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { href: '/about', label: 'About us' },
      { href: '/contact', label: 'Contact' },
      { href: '/host', label: 'List your property' },
      { href: '/auth/login', label: 'Sign in' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      // Guests and hosts agree to different terms, so both are linked rather
      // than a single ambiguous "Terms".
      { href: '/terms/guest', label: 'Guest terms' },
      { href: '/terms/host', label: 'Host terms' },
      { href: '/privacy', label: 'Privacy policy' },
      { href: '/refund-policy', label: 'Refund policy' },
    ],
  },
];

function PhoneIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M5.1 2.2 6.4 5 5.2 6.2a8.6 8.6 0 0 0 4.6 4.6L11 9.6l2.8 1.3v2.3c0 .6-.5 1-1.1 1A11.7 11.7 0 0 1 1.8 3.3c0-.6.4-1.1 1-1.1h2.3Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.6" y="3.2" width="12.8" height="9.6" rx="1.4" stroke="currentColor" strokeWidth="1.2" />
      <path d="m2.2 4.2 5.8 4.2 5.8-4.2" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.2" />
      <path d="M8 4.6V8l2.3 1.6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export function SiteFooter() {
  const { support } = brand;

  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.footerInner}`}>
        <div className={styles.footerTop}>
          <div className={styles.footerBrand}>
            <BrandMark />
            <p className={styles.footerTagline}>{brand.tagline}</p>

            {/*
              Real links, not plain text. On a phone the number has to be
              tappable to be any use, and an address that cannot be clicked
              gets mistyped.
            */}
            <ul className={styles.contactList}>
              <li>
                <a href={support.phoneHref} className={styles.contactLink}>
                  <span className={styles.contactIcon}>
                    <PhoneIcon />
                  </span>
                  {support.phone}
                </a>
              </li>
              <li>
                <a href={support.emailHref} className={styles.contactLink}>
                  <span className={styles.contactIcon}>
                    <MailIcon />
                  </span>
                  {support.email}
                </a>
              </li>
              <li className={styles.contactHours}>
                <span className={styles.contactIcon}>
                  <ClockIcon />
                </span>
                {support.hours}
              </li>
            </ul>
          </div>

          <nav className={styles.footerGroups} aria-label="Footer">
            {GROUPS.map((group) => (
              <div key={group.heading} className={styles.footerGroup}>
                <h2 className={styles.groupHeading}>{group.heading}</h2>
                <ul className={styles.groupList}>
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href} className={styles.groupLink}>
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        {/*
          The registered business, on every page.

          India's Consumer Protection (E-Commerce) Rules, 2020 require an
          e-commerce entity to display its legal name, principal geographic
          address and contact details, and a payment gateway's onboarding
          review checks for exactly this before approving a merchant. It is a
          legal disclosure, not decoration, so it is text rather than an image
          and is not hidden behind a link.
        */}
        <div className={styles.legal}>
          <p className={styles.legalLine}>
            <strong className={styles.legalBrand}>{brand.name}</strong> is operated by{' '}
            {business.entity}. GSTIN {business.gstin}.
          </p>
          <p className={styles.legalLine}>{addressLine()}</p>
          <p className={styles.legalFine}>
            Private farmhouses and villas across India. All prices in INR, inclusive of the fees
            shown at checkout.
          </p>
        </div>
      </div>
    </footer>
  );
}
