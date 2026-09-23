import Link from 'next/link';
import { brand } from '@/lib/config/brand';
import { addressLines, business } from '@/lib/config/business';
import { buildPageMetadata } from '@/lib/seo/build-metadata';
import styles from '../about/about.module.css';

export const metadata = buildPageMetadata({
  title: 'Contact us',
  description: `Reach ${brand.name} by phone, email or post. Operated by ${business.entity}, ${business.address.city}, ${business.address.state}.`,
  path: '/contact',
});

/**
 * How to reach a person, and the postal address behind the website.
 *
 * Shares the About page's stylesheet: the two are the same kind of page, and a
 * second near-identical module would drift. A payment gateway's reviewer looks
 * for a working phone number, an email on the site's own domain, and a real
 * geographic address — all three are here as text, not only as an image or a
 * contact form.
 */
export default function ContactPage() {
  return (
    <div className={`container ${styles.page}`}>
      <header className={styles.header}>
        <p className="t-label">Contact</p>
        <h1 className="t-h1">Contact us</h1>
        <p className={styles.lead}>
          A real person answers. For anything about a booking, quote your booking ID — it is on your
          booking page and in your confirmation email.
        </p>
      </header>

      <section className={styles.section}>
        <h2 className="t-h3">Talk to us</h2>
        <dl className={styles.details}>
          <div className={styles.detailRow}>
            <dt>Phone</dt>
            <dd>
              <a href={brand.support.phoneHref}>{brand.support.phone}</a>
            </dd>
          </div>
          <div className={styles.detailRow}>
            <dt>Email</dt>
            <dd>
              <a href={brand.support.emailHref}>{brand.support.email}</a>
            </dd>
          </div>
          <div className={styles.detailRow}>
            <dt>Hours</dt>
            <dd>{brand.support.hours}</dd>
          </div>
          <div className={styles.detailRow}>
            <dt>Postal address</dt>
            <dd>
              <span className={styles.addressLine}>{business.tradeName}</span>
              {addressLines().map((line) => (
                <span key={line} className={styles.addressLine}>
                  {line}
                </span>
              ))}
            </dd>
          </div>
        </dl>
      </section>

      <section className={styles.section}>
        <h2 className="t-h3">What to contact us about</h2>
        <ul className={styles.list}>
          <li>
            <strong>A booking</strong> — changes, cancellations, or a problem at a property. If
            something is wrong at check-in, call rather than email so we can act the same day.
          </li>
          <li>
            <strong>A refund</strong> — see the{' '}
            <Link href="/refund-policy">Cancellation &amp; Refund Policy</Link> first; if a refund
            has not arrived within ten working days, contact us with your booking ID.
          </li>
          <li>
            <strong>Listing a property</strong> — start at{' '}
            <Link href="/host">List your property</Link>, or write to us with a question.
          </li>
          <li>
            <strong>Your personal data</strong> — to request a copy, a correction or deletion, see
            the <Link href="/privacy">Privacy Policy</Link> and email us. We respond within thirty
            days.
          </li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2 className="t-h3">Registered business</h2>
        <dl className={styles.details}>
          <div className={styles.detailRow}>
            <dt>Legal name</dt>
            <dd>{business.legalName}</dd>
          </div>
          <div className={styles.detailRow}>
            <dt>Trade name</dt>
            <dd>{business.tradeName}</dd>
          </div>
          <div className={styles.detailRow}>
            <dt>GSTIN</dt>
            <dd>{business.gstin}</dd>
          </div>
        </dl>
        <p className="t-body-small">
          Full business details are on the <Link href="/about">About page</Link>.
        </p>
      </section>
    </div>
  );
}
