import Link from 'next/link';
import { TERMS_DOCUMENTS } from '@/lib/legal/terms-content';
import { buildPageMetadata } from '@/lib/seo/build-metadata';
import styles from '@/components/legal/terms.module.css';

export const metadata = buildPageMetadata({
  title: 'Terms & Conditions',
  description: 'Separate terms for guests booking a stay and hosts listing a property.',
  path: '/terms',
});

/**
 * Landing page for the two documents.
 *
 * Guests and hosts have genuinely different obligations, so the terms are two
 * documents rather than one with a section each. This page exists so a single
 * "Terms" link — in the footer, in an email, in support — lands somewhere that
 * makes the split obvious instead of guessing which one the reader wanted.
 */
export default function TermsIndexPage() {
  return (
    <div className={`container ${styles.page}`}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Legal</p>
        <h1 className={styles.title}>Terms &amp; Conditions</h1>
        <p className={styles.subtitle}>
          Guests and hosts agree to different terms. Pick the one that applies to you.
        </p>
      </header>

      <div className={styles.cards}>
        {TERMS_DOCUMENTS.map((document) => (
          <Link key={document.slug} href={`/terms/${document.slug}`} className={styles.card}>
            <span className={styles.cardTitle}>{document.title}</span>
            <span className={styles.cardText}>{document.subtitle}</span>
            <span className={styles.cardMeta}>
              {document.sections.length} sections · Read →
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
