'use client';

import Image from 'next/image';
import { useState } from 'react';
import { resolveMedia } from '@/lib/media/provider';
import type { MediaAsset } from '@/lib/media/types';
import { cn } from '@/lib/cn';
import styles from './media.module.css';

type Tone = 'default' | 'pool' | 'lawn' | 'night';

type MediaImageProps = {
  asset?: MediaAsset | null;
  alt: string;
  aspectRatio?: string;
  objectPosition?: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
  fallbackLabel?: string;
  tone?: Tone;
  /** Hide the visible label on the placeholder. Thumbnails are too small for it. */
  showCaption?: boolean;
};

export function MediaImage({
  asset,
  alt,
  aspectRatio = '4 / 5',
  objectPosition = 'center',
  sizes = '(min-width: 768px) 33vw, 100vw',
  priority = false,
  className,
  fallbackLabel = 'Photo unavailable',
  tone = 'default',
  showCaption = true,
}: MediaImageProps) {
  // An upload can go missing from disk while its row still exists. Without this
  // the browser renders a broken-image box and next/image logs a 400.
  const [failed, setFailed] = useState(false);

  const resolved = asset ? resolveMedia(asset) : null;
  const showImage = Boolean(resolved?.src) && !failed;

  // Two different placeholders wear the same box. A listing with no photo yet
  // is captioned with its own name, which reads as a deliberate blank. A photo
  // whose file has gone missing says so instead — captioning that one with the
  // property name (or worse, the original upload filename) looked like the page
  // had failed to render rather than like one absent file.
  const broken = Boolean(resolved?.src) && failed;
  const caption = broken ? fallbackLabel : alt || fallbackLabel;

  return (
    <div className={cn(styles.frame, className)} style={{ aspectRatio }}>
      {showImage && resolved ? (
        <Image
          src={resolved.src}
          alt={alt || resolved.alt}
          fill
          sizes={sizes}
          priority={priority}
          unoptimized={resolved.src.startsWith('http')}
          className={styles.image}
          style={{ objectPosition }}
          onError={() => setFailed(true)}
        />
      ) : (
        <div
          className={cn(
            styles.placeholder,
            broken && styles.broken,
            tone === 'pool' && styles.tonePool,
            tone === 'lawn' && styles.toneLawn,
            tone === 'night' && styles.toneNight,
          )}
          role="img"
          aria-label={caption}
        >
          {showCaption ? (
            <span className={styles.caption}>
              {broken ? (
                <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true" className={styles.captionIcon}>
                  <rect x="1.6" y="3" width="12.8" height="10" rx="1.6" fill="none" stroke="currentColor" strokeWidth="1.2" />
                  <circle cx="5.9" cy="6.6" r="1.1" fill="currentColor" />
                  <path d="M2.4 11.4 6 8.2l2.4 2.1 2.2-1.7 3 2.8" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M2 14 14 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              ) : null}
              {caption}
            </span>
          ) : null}
        </div>
      )}
    </div>
  );
}
