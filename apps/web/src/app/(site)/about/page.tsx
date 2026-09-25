import Link from 'next/link';
import { brand } from '@/lib/config/brand';
import { addressLines, business } from '@/lib/config/business';
import { buildPageMetadata } from '@/lib/seo/build-metadata';
import styles from './about.module.css';

export const metadata = buildPageMetadata({
  title: 'About us',
  description: `${brand.name} is an online platform for booking private farmhouses, villas and party venues across India, operated by ${business.entity}.`,
  path: '/about',
});

/**
 * Who runs this site, what it sells, and how the money moves.
 *
 * Written for two readers at once: a guest deciding whether to trust the site
 * with a payment, and a payment gateway's onboarding reviewer, who is required
 * to verify that a merchant's website states the legal entity, its registered
 * address, its GSTIN and the nature of the business. India's Consumer
 * Protection (E-Commerce) Rules, 2020 require the same disclosure, so these
 * details are deliberately on the page rather than only in a database.
 */
export default function AboutPage() {
  return (
    <div className={`container ${styles.page}`}>
      <header className={styles.header}>
        <p className="t-label">About</p>
        <h1 className="t-h1">About {brand.name}</h1>
        <p className={styles.lead}>
          {brand.name} is an online platform for booking private farmhouses, villas and party
          venues across India — places to celebrate a birthday, host a family weekend or take a
          quiet few days away, booked at a transparent price with verified hosts.
        </p>
      </header>

      <section className={styles.section}>
        <h2 className="t-h3">What we do</h2>
        <p className="t-body">
          Property owners list their farmhouse, villa or event venue with photographs, capacity,
          amenities, house rules and nightly pricing. Every listing is reviewed by our team before
          it becomes visible, and every host completes identity verification with PAN and Aadhaar
          before a listing can be submitted.
        </p>
        <p className="t-body">
          Guests search by destination, dates and party size, see the full price before booking —
          including the platform fee, with no charges added later — and pay securely online. After
          payment the booking is confirmed by email and the property&apos;s exact address is shared.
        </p>
        <p className="t-body">
          We are a technology platform. We do not own or operate the properties listed. The stay
          itself is provided by the host; we list it, take the booking, collect the payment on the
          host&apos;s behalf and settle it to them after the stay.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className="t-h3">What you pay for</h2>
        <ul className={styles.list}>
          <li>
            <strong>Accommodation</strong> — nightly or per-stay rates set by the host, shown on
            every listing, in Indian Rupees.
          </li>
          <li>
            <strong>Weekend and extra-guest charges</strong> — where the host sets them, itemised in
            the price breakdown before you pay.
          </li>
          <li>
            <strong>Platform fee</strong> — our service charge, shown as a separate line in the same
            breakdown.
          </li>
        </ul>
        <p className="t-body-small">
          There is no subscription and no membership fee. You pay only when you book. See our{' '}
          <Link href="/refund-policy">Cancellation &amp; Refund Policy</Link> for how money comes
          back if a booking is cancelled.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className="t-h3">Business details</h2>
        <p className="t-body-small">
          {brand.name} is a brand operated by the registered business below.
        </p>
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
            <dt>Constitution</dt>
            <dd>{business.constitution}</dd>
          </div>
          <div className={styles.detailRow}>
            <dt>Proprietor</dt>
            <dd>{business.proprietor}</dd>
          </div>
          <div className={styles.detailRow}>
            <dt>GSTIN</dt>
            <dd>{business.gstin}</dd>
          </div>
          <div className={styles.detailRow}>
            <dt>PAN</dt>
            <dd>{business.pan}</dd>
          </div>
          <div className={styles.detailRow}>
            <dt>Principal place of business</dt>
            <dd>
              {addressLines().map((line) => (
                <span key={line} className={styles.addressLine}>
                  {line}
                </span>
              ))}
            </dd>
          </div>
          <div className={styles.detailRow}>
            <dt>Website</dt>
            <dd>www.baagly.com</dd>
          </div>
        </dl>
      </section>

      <section className={styles.section}>
        <h2 className="t-h3">Contact us</h2>
        <p className="t-body">
          Call or message us on{' '}
          <a href={brand.support.phoneHref}>{brand.support.phone}</a>, or email{' '}
          <a href={brand.support.emailHref}>{brand.support.email}</a>. {brand.support.hours}.
        </p>
        <p className="t-body-small">
          Full contact details, including our postal address, are on the{' '}
          <Link href="/contact">Contact page</Link>.
        </p>
      </section>

      <section className={styles.section}>
        <h2 className="t-h3">Policies</h2>
        <ul className={styles.list}>
          <li>
            <Link href="/terms/guest">Guest Terms &amp; Conditions</Link> — for anyone booking a
            stay.
          </li>
          <li>
            <Link href="/terms/host">Host Terms &amp; Conditions</Link> — for anyone listing a
            property.
          </li>
          <li>
            <Link href="/privacy">Privacy Policy</Link> — what we collect and who can see it.
          </li>
          <li>
            <Link href="/refund-policy">Cancellation &amp; Refund Policy</Link> — cancellation
            windows and how refunds are paid.
          </li>
          <li>
            <Link href="/shipping-and-returns">Shipping &amp; Returns</Link> — why neither applies
            to a booking service.
          </li>
        </ul>
      </section>
    </div>
  );
}
