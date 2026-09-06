import Image from 'next/image';
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
};

export function MediaImage({
  asset,
  alt,
  aspectRatio = '4 / 5',
  objectPosition = 'center',
  sizes = '(min-width: 768px) 33vw, 100vw',
  priority = false,
  className,
  fallbackLabel = 'Image unavailable',
  tone = 'default',
}: MediaImageProps) {
  const resolved = asset ? resolveMedia(asset) : null;
  const isRemoteOrFile = Boolean(resolved?.src);

  return (
    <div className={cn(styles.frame, className)} style={{ aspectRatio }}>
      {isRemoteOrFile && resolved ? (
        <Image
          src={resolved.src}
          alt={alt || resolved.alt}
          fill
          sizes={sizes}
          priority={priority}
          unoptimized={resolved.src.startsWith('http')}
          className={styles.image}
          style={{ objectPosition }}
        />
      ) : (
        <div
          className={cn(
            styles.placeholder,
            tone === 'pool' && styles.tonePool,
            tone === 'lawn' && styles.toneLawn,
            tone === 'night' && styles.toneNight,
          )}
          role="img"
          aria-label={alt || fallbackLabel}
        >
          <span className={styles.caption}>{alt || fallbackLabel}</span>
        </div>
      )}
    </div>
  );
}
