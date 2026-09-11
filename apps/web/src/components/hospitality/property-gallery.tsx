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
/** How long each slide holds while the slideshow is playing. */
const SLIDE_MS = 5000;
/** Above this many photos the dot row gets noisy, so the counter carries it. */
const MAX_DOTS = 8;

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

function PlayIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden="true">
      <path d="M3.5 2.2v9.6L11.5 7Z" fill="currentColor" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden="true">
      <rect x="3.2" y="2.4" width="2.8" height="9.2" rx="0.7" fill="currentColor" />
      <rect x="8" y="2.4" width="2.8" height="9.2" rx="0.7" fill="currentColor" />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path
        d="M5.5 1.5H1.5V5.5M8.5 1.5h4v4M8.5 12.5h4v-4M5.5 12.5h-4v-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PropertyGallery({ images, title }: { images: GalleryImage[]; title: string }) {
  const [index, setIndex] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [held, setHeld] = useState(false);
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

  // The slideshow starts itself, but only for people who have not asked the OS
  // to reduce motion. WCAG 2.2.2 also requires a way to stop anything that moves
  // on its own for more than five seconds — that is the play/pause chip below.
  // Autoplay without one is an accessibility failure, not a flourish.
  useEffect(() => {
    if (!canPage) return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!query.matches) setPlaying(true);
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) setPlaying(false);
    };
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [canPage]);

  // Hovering, focusing a control or opening the lightbox holds the current
  // slide, so a photo never slides away while someone is looking at it.
  const advancing = playing && canPage && !held && !lightbox;

  useEffect(() => {
    if (!advancing) return;
    const timer = window.setTimeout(() => go(index + 1), SLIDE_MS);
    return () => window.clearTimeout(timer);
  }, [advancing, go, index]);

  // Arrow keys page the lightbox; Escape closes it. Bound to the window only
  // while it is open so the page keeps its own keys the rest of the time.
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
    if (!strip || !active) return;

    /*
      The strip is scrolled directly rather than with `scrollIntoView`.

      scrollIntoView walks up and scrolls EVERY scrollable ancestor, including
      the document — so on a phone each autoplay tick dragged the whole page
      down to the gallery, which reads as the page jumping on its own every few
      seconds. Setting scrollLeft moves only this strip and never the page.
    */
    const target = active.offsetLeft - strip.clientWidth / 2 + active.clientWidth / 2;
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    strip.scrollTo({
      left: Math.max(0, target),
      behavior: smooth ? 'smooth' : 'auto',
    });
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
    if (delta <= -SWIPE_THRESHOLD) step(1);
    if (delta >= SWIPE_THRESHOLD) step(-1);
  }

  // Any deliberate move stops the slideshow. Someone who has taken control of
  // the photos does not want the timer yanking them somewhere else a moment later.
  function step(direction: 1 | -1) {
    setPlaying(false);
    go(index + direction);
  }

  function jump(position: number) {
    setPlaying(false);
    go(position);
  }

  // Left/right move between thumbnails the way a tablist is expected to.
  function onThumbKeyDown(event: React.KeyboardEvent) {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    event.preventDefault();
    const target = index + (event.key === 'ArrowRight' ? 1 : -1);
    const wrapped = ((target % count) + count) % count;
    jump(wrapped);
    (thumbStrip.current?.children[wrapped] as HTMLElement | undefined)?.focus();
  }

  const slides = (
    <div className={styles.track} style={{ transform: `translate3d(-${index * 100}%, 0, 0)` }}>
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
        onMouseEnter={() => setHeld(true)}
        onMouseLeave={() => setHeld(false)}
        onFocus={() => setHeld(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHeld(false);
        }}
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

          <div className={styles.scrim} aria-hidden="true" />

          {canPage ? (
            <>
              <button type="button" className={cn(styles.nav, styles.prev)} onClick={() => step(-1)} aria-label="Previous photo">
                <ChevronLeft />
              </button>
              <button type="button" className={cn(styles.nav, styles.next)} onClick={() => step(1)} aria-label="Next photo">
                <ChevronRight />
              </button>
            </>
          ) : null}

          <div className={styles.stageBar}>
            <div className={styles.chips}>
              <button type="button" className={styles.chip} onClick={() => setLightbox(true)}>
                <ExpandIcon />
                {`View all ${count} photo${count === 1 ? '' : 's'}`}
              </button>

              {canPage ? (
                <button
                  type="button"
                  className={cn(styles.chip, styles.chipIcon)}
                  onClick={() => setPlaying((value) => !value)}
                  aria-label={playing ? 'Pause slideshow' : 'Play slideshow'}
                >
                  {playing ? <PauseIcon /> : <PlayIcon />}
                </button>
              ) : null}
            </div>

            {canPage ? (
              <div className={styles.progressGroup}>
                {count <= MAX_DOTS ? (
                  <div className={styles.dots}>
                    {images.map((image, position) => (
                      <button
                        key={`dot-${image.alt}-${position}`}
                        type="button"
                        className={cn(styles.dot, position === index && styles.dotActive)}
                        aria-label={`Go to photo ${position + 1}`}
                        aria-current={position === index}
                        onClick={() => jump(position)}
                      />
                    ))}
                  </div>
                ) : null}
                <p className={styles.counter}>
                  {index + 1} / {count}
                </p>
              </div>
            ) : null}
          </div>

          {/* The fill restarts on every slide because its key changes with the index. */}
          {advancing ? (
            <div className={styles.progress} aria-hidden="true">
              <span key={index} className={styles.progressFill} style={{ animationDuration: `${SLIDE_MS}ms` }} />
            </div>
          ) : null}
        </div>

        {canPage ? (
          <div
            className={styles.thumbs}
            ref={thumbStrip}
            role="tablist"
            aria-label="Choose a photo"
            onKeyDown={onThumbKeyDown}
          >
            {images.map((image, position) => (
              <button
                key={`thumb-${image.alt}-${position}`}
                type="button"
                role="tab"
                aria-selected={position === index}
                aria-label={`Photo ${position + 1}`}
                tabIndex={position === index ? 0 : -1}
                className={cn(styles.thumb, position === index && styles.thumbActive)}
                onClick={() => jump(position)}
              >
                <MediaImage
                  asset={image.asset}
                  alt=""
                  tone={image.tone}
                  aspectRatio="auto"
                  className={styles.fill}
                  sizes="88px"
                  showCaption={false}
                />
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
                  <MediaImage
                    asset={image.asset}
                    alt=""
                    tone={image.tone}
                    aspectRatio="auto"
                    className={styles.fill}
                    sizes="88px"
                    showCaption={false}
                  />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
