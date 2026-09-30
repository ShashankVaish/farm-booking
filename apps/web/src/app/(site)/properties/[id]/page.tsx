import { PropertyGallery } from '@/components/hospitality/property-gallery';
import { PropertyBookingCard } from '@/components/hospitality/property-booking-card';
import {
  AmenityList,
  ExpandableText,
  PropertyHeroActions,
  PropertyReviews,
  PropertyTitleActions,
} from '@/components/hospitality/property-detail';
import { Button } from '@/components/ui/button';
import { ErrorState } from '@/components/ui/feedback';
import { brand } from '@/lib/config/brand';
import { getProperty, getPropertyReviews } from '@/lib/properties/api';
import { isServiceUnavailable, ServiceUnavailableError } from '@/lib/api/availability';
import { coverImage, amenityName } from '@/lib/properties/map-property';
import { areaName } from '@/lib/properties/place-label';
import { cn } from '@/lib/cn';
import { photoAlt } from '@/lib/properties/photo-alt';
import { decodeListingMeta, listingSlots } from '@/lib/host/listing-meta';
import { formatSlotRange, formatTime12 } from '@/lib/time/clock';
import { PROPERTY_TYPE_LABEL, type ApiProperty } from '@/lib/properties/types';
import { isUuid } from '@/lib/ids';
import { buildPageMetadata } from '@/lib/seo/build-metadata';
import { propertyJsonLd } from '@/lib/seo/json-ld';
import { getSiteUrl } from '@/lib/config/env';
import styles from '@/components/hospitality/hospitality.module.css';
import page from './property-page.module.css';

type Props = { params: Promise<{ id: string }> };

/*
  Each listing page is built once and served from Vercel's cache, rebuilt at
  most every five minutes — and straight away when the API reports a change
  (see /revalidate). Before this every visit re-rendered the page and called
  the API. Booking data (dates, prices) is fetched live by the booking card,
  so it is never stale.
*/
export const revalidate = 300;

/*
  No listing is built at deploy time; each one is built the first time
  someone opens it and then served from the cache. Without this Next treats
  the [id] route as fully dynamic and renders it on every visit.
*/
export function generateStaticParams() {
  return [];
}

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

function GuestsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="7" r="2.9" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M3.8 16.6c0-3 2.8-4.7 6.2-4.7s6.2 1.7 6.2 4.7" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M10 2v2.1M10 15.9V18M18 10h-2.1M4.1 10H2M15.7 4.3l-1.5 1.5M5.8 14.2l-1.5 1.5M15.7 15.7l-1.5-1.5M5.8 5.8 4.3 4.3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M16.2 12.4A6.8 6.8 0 0 1 7.6 3.8a6.8 6.8 0 1 0 8.6 8.6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PoolIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M3 16c1.5 0 1.5-1 3-1s1.5 1 3 1 1.5-1 3-1 1.5 1 3 1 1.5-1 3-1M7 12V5a2 2 0 0 1 4 0M13 12V5a2 2 0 0 1 4 0M7 8.5h6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M10 2.5 16 5v4.5c0 3.8-2.6 6.9-6 8-3.4-1.1-6-4.2-6-8V5l6-2.5Zm-2.6 7.7 1.9 1.9 3.4-3.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** The laurel either side of "Verified by Baagly", as on Airbnb's badge. */
function LaurelIcon({ flip = false }: { flip?: boolean }) {
  return (
    <svg width="18" height="32" viewBox="0 0 18 32" aria-hidden="true" style={flip ? { transform: 'scaleX(-1)' } : undefined}>
      <path
        d="M13 30C6 26 3.5 19 5 11M5.5 23c-2.5-.2-4-2-4.3-4 2.3-.3 4 1 4.3 4Zm-.4-6c-2.3-.8-3.3-2.8-3-4.8 2.2.3 3.4 2.2 3 4.8Zm.6-5.8C3.8 9.8 3.4 7.6 4.3 5.9c1.9.8 2.4 3 1.4 5.3Zm2-5.1C6.5 4.4 6.6 2.4 8 1c1.4 1.4 1 3.6-.3 5.1Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Stars({ value }: { value: number }) {
  const full = Math.round(value);
  return (
    <span className={page.stars} aria-label={`Rated ${value.toFixed(2)} out of 5`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <svg key={star} width="10" height="10" viewBox="0 0 12 12" aria-hidden="true">
          <path
            d="M6 .8 7.6 4l3.6.5-2.6 2.5.6 3.6L6 8.9 2.8 10.6l.6-3.6L.8 4.5 4.4 4Z"
            fill={star <= full ? 'currentColor' : 'none'}
            stroke="currentColor"
            strokeWidth="0.9"
          />
        </svg>
      ))}
    </span>
  );
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`;
}

export default async function PropertyPage({ params }: Props) {
  const { id } = await params;
  let property: ApiProperty;
  try {
    property = await getProperty(id);
  } catch (error) {
    // Server down: the error boundary shows the maintenance screen instead.
    if (isServiceUnavailable(error)) throw new ServiceUnavailableError();
    return (
      <section className="container" style={{ padding: 'var(--space-12) 0' }}>
        <ErrorState title="Stay unavailable" description="This property could not be loaded." />
      </section>
    );
  }

  const isSample = !isUuid(property.id);
  const isApproved = property.status === 'APPROVED';
  const isBookable = !isSample && isApproved;
  const images = [...(property.images ?? [])]
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map((image, position) => {
      const alt = photoAlt(image.altText, property.title, position + 1);
      return { asset: { src: image.url, alt }, alt };
    });
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
  const locationName = areaName(property);
  const typeLabel = PROPERTY_TYPE_LABEL[property.propertyType] ?? 'Stay';
  const amenities = amenityLabels(property);
  // Day party, night party or both — whichever the host offers.
  const slots = listingSlots(meta, { range: formatSlotRange, time: formatTime12 });
  const badges = [
    property.isCoupleFriendly ? 'Couple friendly' : null,
    property.isPartyFriendly ? 'Party friendly' : null,
    property.isAdultOnly ? '18+ only' : null,
  ].filter((value): value is string => Boolean(value));
  const stats = [
    plural(property.guestCapacity, 'guest'),
    plural(property.bedrooms, 'bedroom'),
    plural(meta.beds, 'bed'),
    plural(property.bathrooms, 'bathroom'),
  ];
  const rating = Number(property.averageRating ?? 0);
  const reviewCount = property.reviewCount ?? 0;
  // The admin's per-listing switch: off hides the reviews and the rating.
  const showReviews = property.reviewsVisible !== false;
  const firstReviews =
    showReviews && reviewCount > 0
      ? await getPropertyReviews(property.id, 1)
          .then((result) => result.items)
          .catch(() => [])
      : [];
  const hostName = property.owner?.name?.trim() || null;

  /*
    Up to three reasons to book, Airbnb-style: what you can book it for, the
    pool when there is one, how many it holds, and our own check.
  */
  const features: Array<{ icon: React.ReactNode; title: string; text: string }> = [];
  if (slots.length > 0) {
    features.push({
      icon: slots.some((slot) => slot.key === 'day') ? <SunIcon /> : <MoonIcon />,
      title: slots.length > 1 ? 'Day and night parties' : `${slots[0].label}s`,
      text: slots.map((slot) => `${slot.label} ${slot.detail.split(' · ')[0]}`).join(' · '),
    });
  }
  if (amenities.some((name) => /pool/i.test(name))) {
    features.push({ icon: <PoolIcon />, title: 'Pool', text: 'Cool off in the pool during your booking.' });
  }
  features.push({
    icon: <GuestsIcon />,
    title: `Room for ${property.guestCapacity} guests`,
    text: 'Birthdays, get-togethers and celebrations — bring everyone.',
  });
  if (property.isTrusted) {
    features.push({
      icon: <ShieldIcon />,
      title: `Verified by ${brand.name}`,
      text: 'We have checked this place and its host ourselves.',
    });
  }

  const lat = Number(property.latitude);
  const lng = Number(property.longitude);
  const hasCoords = Number.isFinite(lat) && Number.isFinite(lng);
  /*
    OpenStreetMap embed rather than a JavaScript map: this section only has to
    show roughly where the place is, an iframe costs no bundle on a server page,
    and OSM needs no API key, no billing account and carries no watermark.
  */
  const mapPad = 0.07;
  const mapSrc = hasCoords
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${lng - mapPad}%2C${lat - mapPad * 0.75}%2C${lng + mapPad}%2C${lat + mapPad * 0.75}&layer=mapnik&marker=${lat}%2C${lng}`
    : null;
  const mapLink = hasCoords
    ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=15/${lat}/${lng}`
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

      {/*
        On a phone: the photo runs edge to edge under the site header with
        round back / share / save buttons on it, and the header below is a
        rounded card that overlaps the bottom of the photo. From 1024px the
        title comes first and the photo sits under it.
      */}
      <div className={page.hero}>
        <PropertyGallery images={gallery} title={property.title} edgeToEdge />
        <PropertyHeroActions propertyId={property.id} title={property.title} canSave={!isSample} />
      </div>

      <header className={page.header}>
        <div className={page.headerMain}>
          <h1 className={page.title}>{property.title}</h1>
          <p className={page.subtitle}>
            {typeLabel} in {locationName || 'India'}
          </p>
          <p className={page.stats}>
            {stats.map((item, index) => (
              <span key={item}>
                {index > 0 ? <span aria-hidden="true"> · </span> : null}
                {item}
              </span>
            ))}
          </p>
          {badges.length > 0 ? (
            <div className={page.tags}>
              {badges.map((badge) => (
                <span key={badge} className={page.badge}>
                  {badge}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <PropertyTitleActions propertyId={property.id} title={property.title} canSave={!isSample} />
      </header>

      {showReviews ? (
      <div className={page.ratingStrip}>
        <div className={page.ratingCell}>
          {reviewCount > 0 ? (
            <>
              <strong className={page.ratingValue}>{rating.toFixed(2)}</strong>
              <Stars value={rating} />
            </>
          ) : (
            <>
              <strong className={page.ratingValue}>New</strong>
              <span className={page.ratingLabel}>No reviews</span>
            </>
          )}
        </div>
        <div className={cn(page.ratingCell, page.ratingMiddle)}>
          {property.isTrusted ? (
            <>
              <LaurelIcon />
              <span className={page.ratingBadge}>
                Verified by
                <br />
                {brand.name}
              </span>
              <LaurelIcon flip />
            </>
          ) : (
            <>
              <strong className={page.ratingValue}>{property.guestCapacity}</strong>
              <span className={page.ratingLabel}>Guests max</span>
            </>
          )}
        </div>
        <div className={page.ratingCell}>
          <strong className={page.ratingValue}>{reviewCount}</strong>
          <span className={page.ratingLabel}>{reviewCount === 1 ? 'Review' : 'Reviews'}</span>
        </div>
      </div>
      ) : null}

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

      <div className={cn(styles.detailGrid, page.body)}>
        <div className={styles.propertyCopy}>
          {hostName ? (
            <section className={page.section}>
              <div className={page.host}>
                <span className={page.hostAvatar} aria-hidden="true">
                  {hostName.slice(0, 1).toUpperCase()}
                  {property.isTrusted ? <span className={page.hostBadge} /> : null}
                </span>
                <span>
                  <span className={page.hostName}>Hosted by {hostName}</span>
                  <span className={page.hostMeta}>{property.isTrusted ? 'Verified host' : 'Your host for this booking'}</span>
                </span>
              </div>
            </section>
          ) : null}

          <section className={page.section} data-reveal>
            <ul className={page.features}>
              {features.slice(0, 3).map((feature) => (
                <li key={feature.title} className={page.feature}>
                  <span className={page.featureIcon} aria-hidden="true">
                    {feature.icon}
                  </span>
                  <span>
                    <span className={page.featureTitle}>{feature.title}</span>
                    <span className={page.featureText}>{feature.text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          {amenities.length > 0 ? (
            <section className={page.section} data-reveal>
              <h2 className={page.sectionTitle}>What this place offers</h2>
              <AmenityList names={amenities} />
            </section>
          ) : null}

          {property.description ? (
            <section className={page.section} data-reveal>
              <h2 className={page.sectionTitle}>About this place</h2>
              <ExpandableText text={property.description} />
            </section>
          ) : null}

          {slots.length > 0 ? (
            <section className={page.section} data-reveal>
              <h2 className={page.sectionTitle}>How you can book it</h2>
              <ul className={page.slots}>
                {slots.map((slot) => (
                  <li key={slot.key} className={page.slot}>
                    <span className={page.slotIcon} aria-hidden="true">
                      {slot.key === 'night' ? <MoonIcon /> : <SunIcon />}
                    </span>
                    <span className={page.slotText}>
                      <span className={page.slotLabel}>{slot.label}</span>
                      <span className={page.slotDetail}>{slot.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {showReviews ? (
            <section className={page.section} data-reveal id="reviews">
              <h2 className={page.sectionTitle}>
                {reviewCount > 0 ? (
                  <>
                    <span aria-hidden="true">★ </span>
                    {rating.toFixed(2)} · {reviewCount} review{reviewCount === 1 ? '' : 's'}
                  </>
                ) : (
                  'Reviews'
                )}
              </h2>
              {firstReviews.length > 0 ? (
                <PropertyReviews propertyId={property.id} initial={firstReviews} total={reviewCount} />
              ) : (
                <p className={page.prose}>No reviews yet. Guests can review this place after their booking.</p>
              )}
            </section>
          ) : null}

          <section className={page.section} data-reveal>
            <h2 className={page.sectionTitle}>Where you&apos;ll be</h2>
            <p className={page.place}>
              <PinIcon />
              {locationName || 'India'}
            </p>
            {mapSrc ? (
              <iframe
                title={`Map of ${locationName || property.title}`}
                className={page.map}
                src={mapSrc}
                loading="lazy"
                allowFullScreen
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : (
              <p className={page.prose}>Map coming soon for this stay.</p>
            )}
            <p className={page.mapNote}>
              Approximate area shown. The exact address stays private until a booking is confirmed.
              {mapLink ? (
                <>
                  {' '}
                  <a className={page.mapLink} href={mapLink} target="_blank" rel="noreferrer">
                    Open the larger map
                  </a>
                </>
              ) : null}
            </p>
          </section>

          {/* Rules come last: the guest has already seen what the place offers. */}
          <section className={page.section} data-reveal>
            <h2 className={page.sectionTitle}>Things to know</h2>
            <div className={page.rules}>
              <div className={page.ruleBlock}>
                <h3 className={page.ruleTitle}>House rules</h3>
                <ul className={page.ruleList}>
                  <li>Smoking: {meta.smoking || 'Not specified'}</li>
                  <li>Pets: {meta.pets || 'Not specified'}</li>
                  <li>{property.isAdultOnly ? 'Guests must be 18+' : 'All ages welcome'}</li>
                  <li>{property.isPartyFriendly ? 'Parties allowed' : 'No parties'}</li>
                  {property.isCoupleFriendly ? <li>Couple friendly</li> : null}
                  {meta.noise ? <li>{meta.noise}</li> : null}
                </ul>
                {houseRules ? <p className={page.prose}>{houseRules}</p> : null}
              </div>
              {property.partyRules ? (
                <div className={page.ruleBlock}>
                  <h3 className={page.ruleTitle}>Party rules</h3>
                  <p className={page.prose}>{property.partyRules}</p>
                </div>
              ) : null}
              {property.cancellationPolicy ? (
                <div className={page.ruleBlock}>
                  <h3 className={page.ruleTitle}>Cancellation policy</h3>
                  <p className={page.prose}>{property.cancellationPolicy}</p>
                </div>
              ) : null}
            </div>
          </section>
        </div>

        {/* A desktop column; on a phone its card becomes the Reserve bar's sheet. */}
        <div className={styles.stickyBooking} id="book-in">
          <PropertyBookingCard property={property} bookable={isBookable} />
        </div>
      </div>

      {/* A bookable listing gets the booking card's own sticky Reserve bar. */}
      {!isBookable ? (
        <div className={styles.mobileReserve}>
          <span className="t-price">
            {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(
              Number(property.basePrice),
            )}
            <span className="t-caption"> / night party</span>
          </span>
          <Button href="/explore">Browse stays</Button>
        </div>
      ) : null}
    </article>
  );
}
