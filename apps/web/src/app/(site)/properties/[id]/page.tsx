import { AmenityItem, Rating } from '@/components/hospitality/atoms';
import { PropertyGallery } from '@/components/hospitality/property-gallery';
import { PropertyBookingCard } from '@/components/hospitality/property-booking-card';
import { WishlistButton } from '@/components/hospitality/wishlist-button';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState } from '@/components/ui/feedback';
import { getProperty, getPropertyReviews } from '@/lib/properties/api';
import { coverImage, amenityName } from '@/lib/properties/map-property';
import { decodeListingMeta } from '@/lib/host/listing-meta';
import { PROPERTY_TYPE_LABEL, type ApiProperty } from '@/lib/properties/types';
import { isUuid } from '@/lib/ids';
import { buildPageMetadata } from '@/lib/seo/build-metadata';
import { propertyJsonLd } from '@/lib/seo/json-ld';
import { getSiteUrl } from '@/lib/config/env';
import styles from '@/components/hospitality/hospitality.module.css';
import page from './property-page.module.css';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  try {
    const property = await getProperty(id);
    return buildPageMetadata({
      title: property.title,
      description: property.description?.slice(0, 160) || `${property.title} in ${property.city}`,
      path: `/properties/${id}`,
    });
  } catch {
    return buildPageMetadata({ title: 'Property', path: `/properties/${id}` });
  }
}

function amenityLabels(property: ApiProperty): string[] {
  return (property.amenities ?? []).map(amenityName).filter((name): name is string => Boolean(name));
}

function PinIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path
        d="M7 1.5c2.2 0 4 1.8 4 4 0 2.9-4 7-4 7s-4-4.1-4-7c0-2.2 1.8-4 4-4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <circle cx="7" cy="5.5" r="1.4" fill="currentColor" />
    </svg>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className={page.fact}>
      <dt className={page.factLabel}>{label}</dt>
      <dd className={page.factValue}>{value}</dd>
    </div>
  );
}

export default async function PropertyPage({ params }: Props) {
  const { id } = await params;
  let property: ApiProperty;
  try {
    property = await getProperty(id);
  } catch {
    return (
      <section className="container" style={{ padding: 'var(--space-12) 0' }}>
        <ErrorState title="Stay unavailable" description="This property could not be loaded." />
      </section>
    );
  }

  const reviews = isUuid(property.id)
    ? await getPropertyReviews(property.id).catch(() => ({
        items: [],
        meta: { total: 0, page: 1, limit: 8, totalPages: 0 },
      }))
    : { items: [], meta: { total: 0, page: 1, limit: 8, totalPages: 0 } };
  const isSample = !isUuid(property.id);
  const isApproved = property.status === 'APPROVED';
  const isBookable = !isSample && isApproved;
  const images = [...(property.images ?? [])]
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((image) => ({
      asset: { src: image.url, alt: image.altText || property.title },
      alt: image.altText || property.title,
    }));
  const gallery =
    images.length > 0
      ? images
      : [
          {
            asset: coverImage(property),
            alt: property.title,
            tone:
              property.propertyType === 'POOL_PROPERTY'
                ? ('pool' as const)
                : property.isPartyFriendly
                  ? ('night' as const)
                  : ('lawn' as const),
          },
        ];
  // propertyRules stores an encoded host-meta block followed by the free text
  // rules. Rendering it raw leaked "---host-meta-v1--- beds:3 ..." to guests.
  const { meta, rules: houseRules } = decodeListingMeta(property.propertyRules);
  const locationName = [property.location, property.city, property.state].filter(Boolean).join(', ');
  const amenities = amenityLabels(property);
  const lat = Number(property.latitude);
  const lng = Number(property.longitude);
  const mapPad = 0.07;
  const mapSrc =
    Number.isFinite(lat) && Number.isFinite(lng)
      ? `https://www.openstreetmap.org/export/embed.html?bbox=${lng - mapPad}%2C${lat - mapPad * 0.75}%2C${lng + mapPad}%2C${lat + mapPad * 0.75}&layer=mapnik`
      : null;
  const siteUrl = getSiteUrl();

  return (
    <article className={`container ${page.page}`}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(propertyJsonLd(property, siteUrl)),
        }}
      />

      <header className={page.header}>
        <div style={{ minWidth: 0 }}>
          <span className={page.eyebrow}>{PROPERTY_TYPE_LABEL[property.propertyType] ?? 'Stay'}</span>
          <h1 className={page.title}>{property.title}</h1>
          <div className={page.headerMeta}>
            <span className={page.place}>
              <PinIcon />
              {locationName || 'India'}
            </span>
            <Rating value={Number(property.averageRating ?? 0)} count={property.reviewCount} />
          </div>
        </div>
        {isSample ? null : (
          <div className={page.headerActions}>
            <WishlistButton propertyId={property.id} propertyName={property.title} />
          </div>
        )}
      </header>

      <PropertyGallery images={gallery} title={property.title} />

      {!isBookable ? (
        <p className={page.notice}>
          <span aria-hidden="true">⚠</span>
          <span>
            {isSample
              ? 'This is a preview. Booking opens once the listing is published.'
              : 'This listing is awaiting review, so dates cannot be booked yet.'}
          </span>
        </p>
      ) : null}

      <div className={styles.detailGrid} style={{ marginTop: 'var(--space-8)', paddingBottom: '5.5rem' }}>
        <div className={styles.propertyCopy}>
          <section className={page.section}>
            <p className={page.lead}>{property.description}</p>
            <div className={page.stats}>
              <span className={page.stat}>
                <span className={page.statValue}>{property.guestCapacity}</span> guests
              </span>
              <span className={page.stat}>
                <span className={page.statValue}>{property.bedrooms}</span> bedrooms
              </span>
              <span className={page.stat}>
                <span className={page.statValue}>{property.bathrooms}</span> bathrooms
              </span>
              <span className={page.stat}>
                <span className={page.statValue}>{meta.beds}</span> beds
              </span>
            </div>
          </section>

          {amenities.length > 0 ? (
            <section className={page.section}>
              <h2 className={page.sectionTitle}>What this place offers</h2>
              <div className={page.amenities}>
                {amenities.map((name) => (
                  <AmenityItem key={name} label={name} />
                ))}
              </div>
            </section>
          ) : null}

          <section className={page.section}>
            <h2 className={page.sectionTitle}>Good to know</h2>
            <dl className={page.facts}>
              <Fact label="Check-in" value={`After ${meta.checkIn}`} />
              <Fact label="Check-out" value={`Before ${meta.checkOut}`} />
              <Fact
                label="Minimum stay"
                value={`${meta.minStay} night${meta.minStay === 1 ? '' : 's'}`}
              />
              <Fact label="Smoking" value={meta.smoking || 'Not specified'} />
              <Fact label="Pets" value={meta.pets || 'Not specified'} />
              <Fact
                label="Minimum age"
                value={property.isAdultOnly ? 'Guests must be 18+' : 'All ages welcome'}
              />
              <Fact
                label="Couples"
                value={property.isCoupleFriendly ? 'Couple friendly' : 'Not specified'}
              />
              <Fact
                label="Parties"
                value={property.isPartyFriendly ? 'Party friendly' : 'Not party friendly'}
              />
            </dl>
            {meta.noise ? (
              <p className={page.prose} style={{ marginTop: 'var(--space-3)' }}>
                {meta.noise}
              </p>
            ) : null}
          </section>

          {houseRules ? (
            <section className={page.section}>
              <h2 className={page.sectionTitle}>House rules</h2>
              <p className={page.prose}>{houseRules}</p>
            </section>
          ) : null}

          {property.partyRules ? (
            <section className={page.section}>
              <h2 className={page.sectionTitle}>Party rules</h2>
              <p className={page.prose}>{property.partyRules}</p>
            </section>
          ) : null}

          {property.cancellationPolicy ? (
            <section className={page.section}>
              <h2 className={page.sectionTitle}>Cancellation</h2>
              <p className={page.prose}>{property.cancellationPolicy}</p>
            </section>
          ) : null}
        </div>

        <div className={styles.stickyBooking} id="book-in">
          <PropertyBookingCard property={property} bookable={isBookable} />
        </div>

        <div className={styles.propertyMore}>
          <section className={page.section}>
            <h2 className={page.sectionTitle}>Where you will be</h2>
            <p className={page.prose}>{locationName || 'India'}</p>
            {mapSrc ? (
              <iframe
                title={`Approximate map of ${locationName || property.title}`}
                className={page.map}
                src={mapSrc}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : (
              <p className={page.prose}>Map coming soon for this stay.</p>
            )}
            <p className={page.mapNote}>
              Approximate area shown. The exact address stays private until a booking is confirmed.
            </p>
          </section>

          {/*
            Availability lives in the booking card only. A second calendar here
            showed the same month twice and gave guests two places to pick dates.
          */}

          <section className={page.section}>
            <h2 className={page.sectionTitle}>
              Reviews {property.reviewCount ? `(${property.reviewCount})` : ''}
            </h2>
            {reviews.items.length === 0 ? (
              <EmptyState
                title="No reviews yet"
                description="Guests who complete a stay will be able to share theirs here."
              />
            ) : (
              <ul className={page.reviews}>
                {reviews.items.map((review) => (
                  <li key={review.id} className={page.review}>
                    <Rating value={review.rating} />
                    <p className={page.reviewWho}>{review.customer?.name}</p>
                    {review.comment ? <p className={page.reviewBody}>{review.comment}</p> : null}
                    {review.ownerResponse ? (
                      <p className={page.hostReply}>Host: {review.ownerResponse}</p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>

      <div className={styles.mobileReserve}>
        <span className="t-price">
          {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(
            Number(property.basePrice),
          )}
          <span className="t-caption"> / night</span>
        </span>
        <Button href={!isBookable ? '/explore' : '#book-in'}>{!isBookable ? 'Browse stays' : 'Check dates'}</Button>
      </div>
    </article>
  );
}
