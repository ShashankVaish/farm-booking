import Link from 'next/link';
import type { TermsBlock, TermsDocument } from '@/lib/legal/terms-content';
import styles from './terms.module.css';

function Block({ block }: { block: TermsBlock }) {
  if (block.kind === 'list') {
    return (
      <ul className={styles.list}>
        {block.items.map((item) => (
          <li key={item} className={styles.item}>
            {item}
          </li>
        ))}
      </ul>
    );
  }
  if (block.kind === 'note') {
    return <p className={styles.note}>{block.text}</p>;
  }
  if (block.kind === 'lead') {
    return <p className={styles.lead}>{block.text}</p>;
  }
  return <p className={styles.closing}>{block.text}</p>;
}

/**
 * Renders one terms document with a table of contents.
 *
 * Both documents run to fifteen or sixteen numbered sections, which is far too
 * long to scan by scrolling. The contents list is a real anchor list rather
 * than a scroll-spy widget: it works without JavaScript, it can be linked to
 * directly when support needs to point a guest at one clause, and each section
 * carries `scroll-margin-top` so the sticky header does not cover the heading
 * that was jumped to.
 */
export function TermsDocumentView({
  document,
  counterpart,
}: {
  document: TermsDocument;
  counterpart: { href: string; label: string };
}) {
  return (
    <div className={`container ${styles.page}`}>
      <header className={styles.header}>
        <p className={styles.eyebrow}>Legal</p>
        <h1 className={styles.title}>{document.title}</h1>
        <p className={styles.subtitle}>{document.subtitle}</p>
        <Link className={styles.counterpart} href={counterpart.href}>
          {counterpart.label}
        </Link>
      </header>

      <p className={styles.important}>
        <strong>Important:</strong> {document.important}
      </p>

      <div className={styles.body}>
        <nav className={styles.toc} aria-labelledby="contents-heading">
          <h2 id="contents-heading" className={styles.tocTitle}>
            Contents
          </h2>
          <ol className={styles.tocList}>
            {document.sections.map((section) => (
              <li key={section.id}>
                <a className={styles.tocLink} href={`#${section.id}`}>
                  <span className={styles.tocNumber}>{section.number}</span>
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <article className={styles.article}>
          {document.sections.map((section) => (
            <section key={section.id} id={section.id} className={styles.section}>
              <h2 className={styles.sectionTitle}>
                <span className={styles.sectionNumber}>{section.number}.</span>
                {section.title}
              </h2>
              {section.blocks.map((block, index) => (
                <Block key={`${section.id}-${index}`} block={block} />
              ))}
            </section>
          ))}
        </article>
      </div>
    </div>
  );
}
