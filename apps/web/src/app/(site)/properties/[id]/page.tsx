import { AmenityItem, Rating } from '@/components/hospitality/atoms';
import { AvailabilityCalendar } from '@/components/hospitality/availability-calendar';
import { ImageGalleryFoundation } from '@/components/hospitality/foundations';
import { PropertyBookingCard } from '@/components/hospitality/property-booking-card';
import { WishlistButton } from '@/components/hospitality/wishlist-button';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState } from '@/components/ui/feedback';
import { getProperty, getPropertyReviews } from '@/lib/properties/api';
import { coverImage, amenityName } from '@/lib/properties/map-property';
import { PROPERTY_TYPE_LABEL, type ApiProperty } from '@/lib/properties/types';
import { isUuid } from '@/lib/ids';
import { buildPageMetadata } from '@/lib/seo/build-metadata';
import { propertyJsonLd } from '@/lib/seo/json-ld';
import { getSiteUrl } from '@/lib/config/env';
import styles from '@/components/hospitality/hospitality.module.css';

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
  const lat = Number(property.latitude);
  const lng = Number(property.longitude);
  const mapSrc =
    Number.isFinite(lat) && Number.isFinite(lng)
      ? `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.04}%2C${lat - 0.03}%2C${lng + 0.04}%2C${lat + 0.03}&layer=mapnik&marker=${lat}%2C${lng}`
      : null;
  const siteUrl = getSiteUrl();

  return (
    <article className="container" style={{ padding: 'var(--space-6) 0 var(--space-16)' }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(propertyJsonLd(property, siteUrl)),
        }}
      />
      <div className={styles.sectionHead}>
        <div>
          <p className="t-label">{PROPERTY_TYPE_LABEL[property.propertyType] ?? 'Stay'}</p>
          <h1 className="t-h1">{property.title}</h1>
          <p className="t-body-small">
            {property.location}, {property.city}, {property.state}
          </p>
          <Rating value={Number(property.averageRating ?? 0)} count={property.reviewCount} />
        </div>
        {isSample ? null : <WishlistButton propertyId={property.id} propertyName={property.title} />}
      </div>

      <ImageGalleryFoundation images={gallery} />

      <div className={styles.detailGrid} style={{ marginTop: 'var(--space-8)', paddingBottom: '5rem' }}>
        <div>
          <p className="t-body">{property.description}</p>
          <p className="t-body-small" style={{ marginTop: 'var(--space-4)' }}>
            {property.guestCapacity} guests · {property.bedrooms} bedrooms · {property.bathrooms} bathrooms
          </p>

          <h2 className="t-h3" style={{ marginTop: 'var(--space-8)' }}>
            Amenities
          </h2>
          <div className={styles.amenityList} style={{ marginTop: 'var(--space-3)' }}>
            {amenityLabels(property).map((name) => (
              <AmenityItem key={name} label={name} />
            ))}
          </div>

          {property.propertyRules ? (
            <>
              <h2 className="t-h3" style={{ marginTop: 'var(--space-8)' }}>
                House rules
              </h2>
              <p className="t-body-small">{property.propertyRules}</p>
            </>
          ) : null}
          {property.partyRules ? (
            <>
              <h2 className="t-h3" style={{ marginTop: 'var(--space-8)' }}>
                Party rules
              </h2>
              <p className="t-body-small">{property.partyRules}</p>
            </>
          ) : null}
          {property.cancellationPolicy ? (
            <>
              <h2 className="t-h3" style={{ marginTop: 'var(--space-8)' }}>
                Cancellation
              </h2>
              <p className="t-body-small">{property.cancellationPolicy}</p>
            </>
          ) : null}

          <h2 className="t-h3" style={{ marginTop: 'var(--space-8)' }}>
            Location
          </h2>
          {mapSrc ? (
            <iframe title="Property map" className={styles.mapFrame} src={mapSrc} loading="lazy" />
          ) : (
            <p className="t-body-small">{property.address}</p>
          )}

          <h2 className="t-h3" style={{ marginTop: 'var(--space-8)' }}>
            Availability
          </h2>
          {isSample ? (
            <p className="t-body-small">
              Calendar and booking open once this stay is published by a host.
            </p>
          ) : (
            <AvailabilityCalendar propertyId={property.id} />
          )}

          <h2 className="t-h3" style={{ marginTop: 'var(--space-8)' }}>
            Reviews
          </h2>
          {reviews.items.length === 0 ? (
            <EmptyState title="No reviews yet" description="Guests who complete a stay will be able to share theirs here." />
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 'var(--space-4) 0 0' }}>
              {reviews.items.map((review) => (
                <li key={review.id} style={{ marginBottom: 'var(--space-5)' }}>
                  <Rating value={review.rating} />
                  <p className="t-body-small">{review.customer?.name}</p>
                  {review.comment ? <p className="t-body">{review.comment}</p> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className={styles.stickyBooking}>
          <PropertyBookingCard property={property} bookable={!isSample} />
        </div>
      </div>

      <div className={styles.mobileReserve}>
        <span className="t-price">
          {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(
            Number(property.basePrice),
          )}
          <span className="t-caption"> / night</span>
        </span>
          <Button href={isSample ? '/explore' : '#book-in'} size="sm">
            {isSample ? 'Browse stays' : 'Check dates'}
          </Button>
      </div>
    </article>
  );
}
