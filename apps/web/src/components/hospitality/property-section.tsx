import { PropertyGrid, type PropertyCardModel } from '@/components/hospitality/property-card';
import { EmptyState } from '@/components/ui/feedback';
import Link from 'next/link';
import styles from '@/components/hospitality/hospitality.module.css';

export function PropertySection({
  title,
  kicker,
  href,
  properties,
}: {
  title: string;
  kicker?: string;
  href?: string;
  properties: PropertyCardModel[];
}) {
  return (
    <section style={{ padding: 'var(--space-10) 0' }}>
      <div className={styles.sectionHead}>
        <div>
          {kicker ? <p className="t-label">{kicker}</p> : null}
          <h2 className="t-h2">{title}</h2>
        </div>
        {href ? (
          <Link href={href} className="t-body-small">
            View all
          </Link>
        ) : null}
      </div>
      {properties.length > 0 ? (
        <PropertyGrid properties={properties} />
      ) : (
        <EmptyState
          title="Nothing here yet"
          description="Approved stays will appear in this collection as hosts go live."
          actionHref="/explore"
          actionLabel="Browse all stays"
        />
      )}
    </section>
  );
}
