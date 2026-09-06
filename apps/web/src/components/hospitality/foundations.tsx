'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { MediaImage } from '@/components/media/media-image';
import { StaySearch } from '@/components/hospitality/stay-search';
import type { MediaAsset } from '@/lib/media/types';
import { cn } from '@/lib/cn';
import styles from './hospitality.module.css';

export function SearchBox() {
  return <StaySearch />;
}

export function GuestSelector() {
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);

  return (
    <div>
      <Stepper label="Adults" value={adults} onChange={setAdults} min={1} />
      <Stepper label="Children" value={children} onChange={setChildren} min={0} />
    </div>
  );
}

function Stepper({
  label,
  value,
  onChange,
  min,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
}) {
  return (
    <div className={styles.stepper}>
      <span className="t-body-small">{label}</span>
      <span>
        <button type="button" aria-label={`Decrease ${label}`} onClick={() => onChange(Math.max(min, value - 1))}>
          −
        </button>
        <span style={{ display: 'inline-block', minWidth: '2rem', textAlign: 'center' }}>{value}</span>
        <button type="button" aria-label={`Increase ${label}`} onClick={() => onChange(value + 1)}>
          +
        </button>
      </span>
    </div>
  );
}

export function DatePickerFoundation() {
  const [selected, setSelected] = useState<number | null>(12);
  const days = Array.from({ length: 30 }, (_, index) => index + 1);

  return (
    <div>
      <p className="t-label" style={{ marginBottom: '0.75rem' }}>
        September
      </p>
      <div className={styles.calendar} role="grid" aria-label="Date picker foundation">
        {days.map((day) => (
          <button
            key={day}
            type="button"
            className={cn(styles.day, selected === day && styles.daySelected)}
            onClick={() => setSelected(day)}
          >
            {day}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ImageGalleryFoundation({
  images,
}: {
  images: Array<{ asset?: MediaAsset | null; alt: string; tone?: 'default' | 'pool' | 'lawn' | 'night' }>;
}) {
  const [index, setIndex] = useState(0);
  const current = images[index] ?? images[0];

  if (!current) return null;

  return (
    <div>
      <div className={styles.galleryMain}>
        <MediaImage asset={current.asset} alt={current.alt} tone={current.tone} aspectRatio="16 / 10" />
      </div>
      <div className={styles.thumbs}>
        {images.map((image, imageIndex) => (
          <button
            key={image.alt}
            type="button"
            className={cn(styles.thumb, imageIndex === index && styles.thumbActive)}
            onClick={() => setIndex(imageIndex)}
            aria-label={`Show photo ${imageIndex + 1}`}
          >
            <MediaImage asset={image.asset} alt="" tone={image.tone} aspectRatio="4 / 3" />
          </button>
        ))}
      </div>
    </div>
  );
}

export function BookingCardFoundation({ price }: { price: number }) {
  const formatted = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(price);

  return (
    <aside className={styles.booking} aria-label="Booking summary foundation">
      <p className="t-price">
        {formatted} <span className="t-caption">/ night</span>
      </p>
      <p className="t-body-small">Dates, guests, and confirmation will connect to the booking engine in a later phase.</p>
      <Button disabled block>
        Reserve
      </Button>
    </aside>
  );
}
