import type { CSSProperties } from 'react';
import Link from 'next/link';
import { StaySearch } from '@/components/hospitality/stay-search';
import { PropertySection } from '@/components/hospitality/property-section';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/feedback';
import { brand } from '@/lib/config/brand';
import { toPropertyCard } from '@/lib/properties/map-property';
import { safeSearch } from '@/lib/properties/api';
import { buildPageMetadata } from '@/lib/seo/build-metadata';
import styles from './home.module.css';

/*
  Rebuild this page at most once a minute.

  Without it Next prerenders the homepage once at build time and serves that
  HTML forever. On the first deploy there were no approved listings yet, so the
  page was frozen showing "No stays are live yet" while /explore — which is
  dynamic because it reads search params — showed the real thing. Every listing
  approved after a build would otherwise be invisible here until the next one.
*/
export const revalidate = 60;


function ReasonIcon({ path }: { path: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d={path} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const QUICK_LINKS = [
  {
    href: '/explore?pool=true',
    label: 'Pool villas',
    icon: <ReasonIcon path="M3 17c1.5 0 1.5-1 3-1s1.5 1 3 1 1.5-1 3-1 1.5 1 3 1 1.5-1 3-1 1.5 1 3 1M7 13V5a2 2 0 0 1 4 0M13 13V5a2 2 0 0 1 4 0M7 9h6" />,
  },
  {
    href: '/explore?partyAllowed=true',
    label: 'Party venues',
    icon: <ReasonIcon path="M4 20 9 7l8 8-13 5Zm9-15 1-2m4 5 2-1m-3-3 1.5-1.5M15 11l1 1" />,
  },
  {
    href: '/explore?propertyType=WEEKEND_STAY',
    label: 'Weekend stays',
    icon: <ReasonIcon path="M5 21c0-7 4-11 14-14-1 9-5 13-12 13m-2 1 7-7" />,
  },
  {
    href: '/explore?trusted=true',
    label: 'Trusted by us',
    icon: <ReasonIcon path="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3Zm-3 9 2 2 4-4" />,
  },
];

const REASONS = [
  {
    title: 'Verified homes',
    body: 'Every listing is reviewed before it goes live — photos, capacity, and house rules.',
    icon: <ReasonIcon path="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3Zm-3 9 2 2 4-4" />,
  },
  {
    title: 'Clear pricing',
    body: 'Weekend rates, extra guests, and fees are calculated on the server. No surprise totals at checkout.',
    icon: <ReasonIcon path="M4 7h16M4 12h16M4 17h10M17 15l2 2 3-3" />,
  },
  {
    title: 'Made for gatherings',
    body: 'Filter for pools, lawns, music, and party-friendly homes built for Indian celebrations.',
    icon: <ReasonIcon path="M12 3v3M5.6 5.6l2.1 2.1M3 12h3m12 0h3m-2.6-6.4-2.1 2.1M8 21h8M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z" />,
  },
];

export const metadata = buildPageMetadata({
  title: brand.name,
  description: brand.shortDescription,
  path: '/',
});

export default async function HomePage() {
  const [popular, weekend, party, pool, trusted] = await Promise.all([
    safeSearch({ sort: 'newest', limit: 6 }),
    safeSearch({ propertyType: 'WEEKEND_STAY', limit: 6 }),
    safeSearch({ partyAllowed: true, limit: 6 }),
    safeSearch({ pool: true, limit: 6 }),
    // Carries the badge an admin awards by hand, which is now the only
    // quality signal on the site — guest reviews are gone, so sorting or
    // filtering by rating would order everything by a column stuck at zero.
    safeSearch({ trusted: true, limit: 6 }),
  ]);

  // Only collections that actually have approved stays are rendered. Showing a
  // row of placeholder listings — or five identical empty states — would tell a
  // guest nothing true about what is bookable right now.
  const collections = [
    { kicker: 'New here', title: 'Recently added farmhouses', href: '/explore?sort=newest', items: popular.items },
    { kicker: 'Short breaks', title: 'Weekend stays', href: '/explore?propertyType=WEEKEND_STAY', items: weekend.items },
    { kicker: 'Celebrate', title: 'Party venues', href: '/explore?partyAllowed=true', items: party.items },
    { kicker: 'Water', title: 'Swimming pool properties', href: '/explore?pool=true', items: pool.items },
    { kicker: 'Checked by us', title: 'Trusted properties', href: '/explore?trusted=true', items: trusted.items },
  ]
    .map((section) => ({ ...section, properties: section.items.map(toPropertyCard) }))
    .filter((section) => section.properties.length > 0);

  return (
    <>
      <section className={`container ${styles.hero}`}>
        {/* Slow-drifting glow behind the hero. Decorative only. */}
        <div className={styles.aurora} aria-hidden="true">
          <span className={styles.auroraOne} />
          <span className={styles.auroraTwo} />
        </div>
        <div className={styles.heroPanel}>
          <p className={`t-label ${styles.eyebrow} ${styles.enter}`} style={{ '--enter-i': 0 } as CSSProperties}>
            <span className={styles.liveDot} aria-hidden="true" />
            Private stays · India
          </p>
          <h1 className={`t-display ${styles.enter}`} style={{ '--enter-i': 1 } as CSSProperties}>
            {brand.tagline}
          </h1>
          <p className={`t-body ${styles.lead} ${styles.enter}`} style={{ '--enter-i': 2 } as CSSProperties}>
            Farmhouses, villas, and party houses with pools, lawns, and room to celebrate — booked with transparent
            pricing and verified hosts.
          </p>
          <div className={`${styles.searchWrap} ${styles.enter}`} style={{ '--enter-i': 3 } as CSSProperties}>
            <StaySearch />
          </div>
          <nav
            className={`${styles.quickLinks} ${styles.enter}`}
            style={{ '--enter-i': 4 } as CSSProperties}
            aria-label="Popular searches"
          >
            {QUICK_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className={styles.quickLink}>
                <span aria-hidden="true">{link.icon}</span>
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      </section>

      <div className="container">
        {collections.length > 0 ? (
          collections.map((section) => (
            <PropertySection
              key={section.title}
              kicker={section.kicker}
              title={section.title}
              href={section.href}
              properties={section.properties}
            />
          ))
        ) : (
          <section style={{ padding: 'var(--space-12) 0' }}>
            <EmptyState
              title="No stays are live yet"
              description="Listings appear here once a host submits a property and it clears review."
              actionHref="/host"
              actionLabel="List your property"
            />
          </section>
        )}

        <section style={{ padding: 'var(--space-10) 0' }}>
          <div data-reveal>
            <p className="t-label">Why choose us</p>
            <h2 className="t-h2">Book with confidence</h2>
          </div>
          <div className={styles.reasons} style={{ marginTop: 'var(--space-5)' }}>
            {REASONS.map((reason, index) => (
              <article
                key={reason.title}
                className={styles.reason}
                data-reveal
                style={{ '--reveal-i': index } as CSSProperties}
              >
                <span className={styles.reasonIcon} aria-hidden="true">
                  {reason.icon}
                </span>
                <h3 className="t-h4">{reason.title}</h3>
                <p className="t-body-small">{reason.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section
          className={styles.ownerCta}
          style={{ margin: 'var(--space-10) 0 var(--space-16)' }}
          data-reveal="scale"
        >
          <p className="t-label" style={{ color: 'var(--color-inverse)' }}>
            Hosts
          </p>
          <h2 className="t-h2">List your farmhouse</h2>
          <p className="t-body">Share a private villa or party house with guests who are looking for more than a hotel.</p>
          <div className={styles.ownerActions}>
            <Button href="/host" variant="secondary">
              Become a host
            </Button>
          </div>
        </section>
      </div>
    </>
  );
}
