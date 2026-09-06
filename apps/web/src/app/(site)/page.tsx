import Link from 'next/link';
import { StaySearch } from '@/components/hospitality/stay-search';
import { PropertySection } from '@/components/hospitality/property-section';
import { Button } from '@/components/ui/button';
import { demoProperties } from '@/data/demo-properties';
import { brand } from '@/lib/config/brand';
import { toPropertyCard } from '@/lib/properties/map-property';
import { safeSearch } from '@/lib/properties/api';
import { buildPageMetadata } from '@/lib/seo/build-metadata';
import styles from './home.module.css';

export const metadata = buildPageMetadata({
  title: brand.name,
  description: brand.shortDescription,
  path: '/',
});

const DESTINATIONS = [
  { city: 'Lonavala', state: 'Maharashtra' },
  { city: 'Alibaug', state: 'Maharashtra' },
  { city: 'Pune', state: 'Maharashtra' },
  { city: 'Goa', state: 'Goa' },
  { city: 'Udaipur', state: 'Rajasthan' },
  { city: 'Jaipur', state: 'Rajasthan' },
];

export default async function HomePage() {
  const [popular, weekend, party, pool, rated] = await Promise.all([
    safeSearch({ sort: 'rating', limit: 6 }),
    safeSearch({ propertyType: 'WEEKEND_STAY', limit: 6 }),
    safeSearch({ partyAllowed: true, limit: 6 }),
    safeSearch({ pool: true, limit: 6 }),
    safeSearch({ minRating: 4.5, sort: 'rating', limit: 6 }),
  ]);

  const fallback = demoProperties;
  const popularCards = popular.items.map(toPropertyCard);
  const weekendCards = weekend.items.map(toPropertyCard);
  const partyCards = party.items.map(toPropertyCard);
  const poolCards = pool.items.map(toPropertyCard);
  const ratedCards = rated.items.map(toPropertyCard);

  return (
    <>
      <section className={`container ${styles.hero}`}>
        <div className={styles.heroPanel}>
          <p className="t-label">Private stays · India</p>
          <h1 className="t-display">{brand.tagline}</h1>
          <p className={`t-body ${styles.lead}`}>
            Farmhouses, villas, and party houses with pools, lawns, and room to celebrate — booked with transparent
            pricing and verified hosts.
          </p>
          <div className={styles.searchWrap}>
            <StaySearch />
          </div>
        </div>
      </section>

      <div className="container">
        <PropertySection
          kicker="Most loved"
          title="Popular farmhouses"
          href="/explore?sort=rating"
          properties={popularCards.length ? popularCards : fallback}
        />
        <PropertySection
          kicker="Short breaks"
          title="Weekend stays"
          href="/explore?propertyType=WEEKEND_STAY"
          properties={weekendCards.length ? weekendCards : fallback.slice(0, 2)}
        />
        <PropertySection
          kicker="Celebrate"
          title="Party venues"
          href="/explore?partyAllowed=true"
          properties={partyCards.length ? partyCards : fallback.filter((item) => item.badge === 'Party ready')}
        />
        <PropertySection
          kicker="Water"
          title="Swimming pool properties"
          href="/explore?pool=true"
          properties={poolCards.length ? poolCards : fallback.filter((item) => item.imageTone === 'pool')}
        />
        <PropertySection
          kicker="Trusted"
          title="Highly rated properties"
          href="/explore?minRating=4.5&sort=rating"
          properties={ratedCards.length ? ratedCards : fallback}
        />

        <section style={{ padding: 'var(--space-10) 0' }}>
          <p className="t-label">Nearby destinations</p>
          <h2 className="t-h2">Where India gathers</h2>
          <div className={styles.destGrid} style={{ marginTop: 'var(--space-5)' }}>
            {DESTINATIONS.map((place) => (
              <Link
                key={place.city}
                className={styles.destCard}
                href={`/explore?city=${encodeURIComponent(place.city)}`}
              >
                <span className="t-h4">{place.city}</span>
                <span className="t-caption">{place.state}</span>
              </Link>
            ))}
          </div>
        </section>

        <section style={{ padding: 'var(--space-10) 0' }}>
          <p className="t-label">Why choose us</p>
          <h2 className="t-h2">Book with confidence</h2>
          <div className={styles.reasons} style={{ marginTop: 'var(--space-5)' }}>
            <article className={styles.reason}>
              <h3 className="t-h4">Verified homes</h3>
              <p className="t-body-small">Every listing is reviewed before it goes live — photos, capacity, and house rules.</p>
            </article>
            <article className={styles.reason}>
              <h3 className="t-h4">Clear pricing</h3>
              <p className="t-body-small">Weekend rates, extra guests, and fees are calculated on the server. No surprise totals at checkout.</p>
            </article>
            <article className={styles.reason}>
              <h3 className="t-h4">Made for gatherings</h3>
              <p className="t-body-small">Filter for pools, lawns, music, and party-friendly homes built for Indian celebrations.</p>
            </article>
          </div>
        </section>

        <section className={styles.ownerCta} style={{ margin: 'var(--space-10) 0 var(--space-16)' }}>
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
