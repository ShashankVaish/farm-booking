import Link from 'next/link';
import { AmenityItem, PriceDisplay, PropertyBadge, Rating } from '@/components/hospitality/atoms';
import { WishlistButton } from '@/components/hospitality/wishlist-button';
import { MediaImage } from '@/components/media/media-image';
import type { MediaAsset } from '@/lib/media/types';
import styles from './hospitality.module.css';

export type PropertyCardModel = {
  id: string;
  name: string;
  type: string;
  location: string;
  rating: number;
  reviewCount: number;
  guests: number;
  bedrooms: number;
  amenities: string[];
  price: number;
  badge?: string;
  href?: string;
  image?: MediaAsset | null;
  imageTone?: 'default' | 'pool' | 'lawn' | 'night';
};

export function PropertyCard({ property }: { property: PropertyCardModel }) {
  const href = property.href ?? `/properties/${property.id}`;

  return (
    <article className={styles.card}>
      <div className={styles.mediaWrap}>
        <Link href={href} aria-label={property.name}>
          <MediaImage
            asset={property.image}
            alt={property.name}
            tone={property.imageTone}
            aspectRatio="5 / 4"
            sizes="(min-width: 1024px) 30vw, (min-width: 768px) 45vw, 100vw"
          />
        </Link>
        {property.badge ? <PropertyBadge>{property.badge}</PropertyBadge> : null}
        <WishlistButton propertyId={property.id} propertyName={property.name} />
      </div>
      <div className={styles.body}>
        <p className="t-metadata">{property.type}</p>
        <div className={styles.topRow}>
          <h3 className={styles.title}>
            <Link href={href}>{property.name}</Link>
          </h3>
          <Rating value={property.rating} count={property.reviewCount} />
        </div>
        <p className="t-body-small">{property.location}</p>
        <div className={styles.meta}>
          <span>{property.guests} guests</span>
          <span>{property.bedrooms} bedrooms</span>
        </div>
        <div className={styles.amenities}>
          {property.amenities.slice(0, 3).map((item) => (
            <AmenityItem key={item} label={item} />
          ))}
        </div>
        <PriceDisplay amount={property.price} prefix="From" />
      </div>
    </article>
  );
}

export function PropertyGrid({ properties }: { properties: PropertyCardModel[] }) {
  if (properties.length === 0) {
    return null;
  }

  return (
    <div className={styles.grid}>
      {properties.map((property) => (
        <PropertyCard key={property.id} property={property} />
      ))}
    </div>
  );
}

export function PropertyCardSkeleton() {
  return (
    <article className={styles.card} aria-hidden="true">
      <div className={styles.mediaWrap}>
        <div className={styles.skeletonMedia} />
      </div>
      <div className={styles.body}>
        <div className={styles.skeletonLine} />
        <div className={styles.skeletonLineWide} />
      </div>
    </article>
  );
}
