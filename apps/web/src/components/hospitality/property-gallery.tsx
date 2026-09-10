'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MediaImage } from '@/components/media/media-image';
import type { MediaAsset } from '@/lib/media/types';
import { cn } from '@/lib/cn';
import styles from './property-gallery.module.css';

export type GalleryImage = {
  asset?: MediaAsset | null;
  alt: string;
  tone?: 'default' | 'pool' | 'lawn' | 'night';
};

/** Distance in px a horizontal drag must cover before it counts as a swipe. */
const SWIPE_THRESHOLD = 48;

function ChevronLeft() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M12.5 4 7 10l5.5 6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M7.5 4 13 10l-5.5 6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PropertyGallery({ images, title }: { images: GalleryImage[]; title: string }) {
  const [index, setIndex] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const dragStart = useRef<number | null>(null);
  const thumbStrip = useRef<HTMLDivElement | null>(null);

  const count = images.length;
  const canPage = count > 1;

  const go = useCallback(
    (next: number) => {
      if (count === 0) return;
      setIndex(((next % count) + count) % count);
    },
    [count],
  );

  const prev = useCallback(() => go(index - 1), [go, index]);
  const next = useCallback(() => go(index + 1), [go, index]);

  // Arrow keys page the carousel; Escape closes the lightbox. Bound to the
  // window only while the lightbox is open so the page keeps its own keys.
  useEffect(() => {
    if (!lightbox) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLightbox(false);
      if (event.key === 'ArrowRight') next();
      if (event.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [lightbox, next, prev]);

  // Keep the active thumbnail in view as the slide changes.
  useEffect(() => {
    const strip = thumbStrip.current;
    const active = strip?.children[index] as HTMLElement | undefined;
    active?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [index]);

  if (count === 0) return null;

  function onPointerDown(event: React.PointerEvent) {
    dragStart.current = event.clientX;
  }

  function onPointerUp(event: React.PointerEvent) {
    const start = dragStart.current;
    dragStart.current = null;
    if (start === null || !canPage) return;
    const delta = event.clientX - start;
    if (delta <= -SWIPE_THRESHOLD) next();
    if (delta >= SWIPE_THRESHOLD) prev();
  }

  const slides = (
    <div
      className={styles.track}
      style={{ transform: `translate3d(-${index * 100}%, 0, 0)` }}
    >
      {images.map((image, position) => (
        <div
          className={styles.slide}
          key={`${image.alt}-${position}`}
          // Only the visible slide is exposed; the rest are decorative copies.
          aria-hidden={position !== index}
        >
          <MediaImage
            asset={image.asset}
            alt={position === index ? image.alt : ''}
            tone={image.tone}
            priority={position === 0}
            aspectRatio="auto"
            className={styles.fill}
            sizes="(min-width: 1024px) 70vw, 100vw"
          />
        </div>
      ))}
    </div>
  );

  return (
    <>
      <div
        className={styles.gallery}
        role="group"
        aria-roledescription="carousel"
        aria-label={`${title} — ${count} photo${count === 1 ? '' : 's'}`}
      >
        <div
          className={styles.stage}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => {
            dragStart.current = null;
          }}
        >
          {slides}

          {canPage ? (
            <>
              <button type="button" className={cn(styles.nav, styles.prev)} onClick={prev} aria-label="Previous photo">
                <ChevronLeft />
              </button>
              <button type="button" className={cn(styles.nav, styles.next)} onClick={next} aria-label="Next photo">
                <ChevronRight />
              </button>
            </>
          ) : null}

          <button type="button" className={styles.expand} onClick={() => setLightbox(true)}>
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <path d="M5.5 1.5H1.5V5.5M8.5 1.5h4v4M8.5 12.5h4v-4M5.5 12.5h-4v-4" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            View all
          </button>

          {canPage ? (
            <p className={styles.counter} aria-live="polite">
              {index + 1} / {count}
            </p>
          ) : null}
        </div>

        {canPage ? (
          <div className={styles.thumbs} ref={thumbStrip} role="tablist" aria-label="Choose a photo">
            {images.map((image, position) => (
              <button
                key={`thumb-${image.alt}-${position}`}
                type="button"
                role="tab"
                aria-selected={position === index}
                aria-label={`Photo ${position + 1}`}
                className={cn(styles.thumb, position === index && styles.thumbActive)}
                onClick={() => go(position)}
              >
                <MediaImage asset={image.asset} alt="" tone={image.tone} aspectRatio="auto" className={styles.fill} sizes="88px" />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {lightbox ? (
        <div className={styles.lightbox} role="dialog" aria-modal="true" aria-label={`${title} photos`}>
          <div className={styles.lightboxBar}>
            <span>
              {index + 1} of {count}
            </span>
            <button type="button" className={styles.lightboxClose} onClick={() => setLightbox(false)} autoFocus>
              Close
            </button>
          </div>

          <div className={styles.lightboxStage}>
            <div className={styles.lightboxImage}>
              <MediaImage
                asset={images[index]?.asset}
                alt={images[index]?.alt ?? title}
                tone={images[index]?.tone}
                aspectRatio="auto"
                className={styles.fill}
                sizes="100vw"
              />
            </div>
            {canPage ? (
              <>
                <button type="button" className={cn(styles.nav, styles.prev)} onClick={prev} aria-label="Previous photo">
                  <ChevronLeft />
                </button>
                <button type="button" className={cn(styles.nav, styles.next)} onClick={next} aria-label="Next photo">
                  <ChevronRight />
                </button>
              </>
            ) : null}
          </div>

          {canPage ? (
            <div className={styles.lightboxThumbs}>
              {images.map((image, position) => (
                <button
                  key={`lb-${image.alt}-${position}`}
                  type="button"
                  aria-label={`Photo ${position + 1}`}
                  aria-current={position === index}
                  className={cn(styles.thumb, position === index && styles.thumbActive)}
                  onClick={() => go(position)}
                >
                  <MediaImage asset={image.asset} alt="" tone={image.tone} aspectRatio="auto" className={styles.fill} sizes="88px" />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
