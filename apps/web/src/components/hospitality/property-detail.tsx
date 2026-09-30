'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useToast } from '@/components/providers/toast-provider';
import { cn } from '@/lib/cn';
import { WishlistButton } from './wishlist-button';
import styles from './property-detail.module.css';

/*
  The interactive pieces of the listing page, Airbnb-style: round buttons over
  the photo (back, share, save), the facilities list with icons and a
  "Show all", and a description that folds after a few lines.
*/

function BackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M12.5 4 6.5 10l6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M10 12.5V3m0 0L6.5 6.5M10 3l3.5 3.5M5 9.5H4.5A1.5 1.5 0 0 0 3 11v5a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 17 16v-5a1.5 1.5 0 0 0-1.5-1.5H15"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function useShare(title: string) {
  const { notify } = useToast();
  return async function share() {
    const url = window.location.href.split('?')[0];
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch (error) {
        // Dismissing the share sheet is not a failure worth telling anyone.
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      notify('Link copied');
    } catch {
      notify('Could not copy the link.', 'error');
    }
  };
}

/** Round buttons over the hero photo on phones. */
export function PropertyHeroActions({
  propertyId,
  title,
  canSave,
}: {
  propertyId: string;
  title: string;
  canSave: boolean;
}) {
  const router = useRouter();
  const share = useShare(title);

  function back() {
    // Back to where the guest came from on this site; otherwise to Explore.
    const cameFromHere = document.referrer.startsWith(window.location.origin);
    if (cameFromHere && window.history.length > 1) router.back();
    else router.push('/explore');
  }

  return (
    <div className={styles.heroActions}>
      <button type="button" className={styles.roundButton} onClick={back} aria-label="Back">
        <BackIcon />
      </button>
      <div className={styles.heroActionsEnd}>
        <button type="button" className={styles.roundButton} onClick={() => void share()} aria-label="Share">
          <ShareIcon />
        </button>
        {canSave ? (
          <WishlistButton propertyId={propertyId} propertyName={title} className={styles.roundButton} />
        ) : null}
      </div>
    </div>
  );
}

/** "Share" and "Save" beside the title on wider screens. */
export function PropertyTitleActions({
  propertyId,
  title,
  canSave,
}: {
  propertyId: string;
  title: string;
  canSave: boolean;
}) {
  const share = useShare(title);
  return (
    <div className={styles.titleActions}>
      <button type="button" className={styles.textAction} onClick={() => void share()}>
        <ShareIcon />
        <span>Share</span>
      </button>
      {canSave ? (
        <WishlistButton propertyId={propertyId} propertyName={title} className={styles.textAction} label="Save" />
      ) : null}
    </div>
  );
}

/* --- Facilities ------------------------------------------------------------ */

const ICONS: Array<{ match: RegExp; path: string }> = [
  { match: /pool|swim/i, path: 'M3 16c1.5 0 1.5-1 3-1s1.5 1 3 1 1.5-1 3-1 1.5 1 3 1 1.5-1 3-1M7 12V5a2 2 0 0 1 4 0M13 12V5a2 2 0 0 1 4 0M7 8.5h6' },
  { match: /wi-?fi|internet/i, path: 'M3 8.5a10 10 0 0 1 14 0M5.5 11a6.5 6.5 0 0 1 9 0M8 13.5a3 3 0 0 1 4 0M10 16h.01' },
  { match: /park/i, path: 'M4 17V3h6a4 4 0 0 1 0 8H4' },
  { match: /air|a\/?c\b|cool/i, path: 'M10 2v16M3.1 6l13.8 8M3.1 14 16.9 6M8 3.5l2 2 2-2M8 16.5l2-2 2 2' },
  { match: /kitchen|cook|chef/i, path: 'M6 3v6a2 2 0 0 0 4 0V3M8 3v14M14 3c-1.5 1-2 3-2 5s1 2.5 2 2.5V17' },
  { match: /tv|television|projector/i, path: 'M3 5h14v9H3zM7 17h6' },
  { match: /music|sound|speaker|dj/i, path: 'M8 15V4l8-1.5v11M8 15a2 2 0 1 1-4 0 2 2 0 0 1 4 0Zm8-1.5a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z' },
  { match: /bbq|barbe|grill/i, path: 'M4 8h12a6 6 0 0 1-12 0ZM7 14l-2 4M13 14l2 4M8 5c0-1 1-1 1-2M11 5c0-1 1-1 1-2' },
  { match: /lawn|garden|green/i, path: 'M10 17V9M10 9c0-3 2-5 5-5 0 3-2 5-5 5Zm0 3C10 9 8 7 5 7c0 3 2 5 5 5Z' },
  { match: /care ?taker|staff|butler|security|guard/i, path: 'M10 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-6 8c0-3.3 2.7-5 6-5s6 1.7 6 5' },
  { match: /power|generator|backup|inverter/i, path: 'M11 2 4 11h5l-1 7 7-9h-5l1-7Z' },
  { match: /wash|laundry/i, path: 'M4 3h12v14H4zM4 6.5h12M10 14.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z' },
  { match: /pet/i, path: 'M6 8a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm8 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM4 12a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm12 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Zm-6 5c-2 0-3.5-1-3.5-2.5S8 11 10 11s3.5 2 3.5 3.5S12 17 10 17Z' },
  { match: /bed|room/i, path: 'M3 15V6M3 15h14v-3a2.5 2.5 0 0 0-2.5-2.5H3M3 17v-2M17 17v-2' },
  { match: /light|decor/i, path: 'M10 2a5 5 0 0 0-3 9v2h6v-2a5 5 0 0 0-3-9ZM8 16h4M9 18h2' },
];

const CHECK = 'M4.5 10.5 8 14l7.5-8';

function amenityPath(name: string): string {
  return ICONS.find((icon) => icon.match.test(name))?.path ?? CHECK;
}

function AmenityIcon({ name }: { name: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 20 20" aria-hidden="true">
      <path d={amenityPath(name)} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const FIRST_AMENITIES = 8;

export function AmenityList({ names }: { names: string[] }) {
  const [all, setAll] = useState(false);
  const shown = all ? names : names.slice(0, FIRST_AMENITIES);
  return (
    <>
      <ul className={styles.amenities}>
        {shown.map((name) => (
          <li key={name} className={styles.amenity}>
            <span className={styles.amenityIcon}>
              <AmenityIcon name={name} />
            </span>
            {name}
          </li>
        ))}
      </ul>
      {names.length > FIRST_AMENITIES ? (
        <button type="button" className={styles.outlineButton} onClick={() => setAll((value) => !value)} aria-expanded={all}>
          {all ? 'Show fewer' : `Show all ${names.length} facilities`}
        </button>
      ) : null}
    </>
  );
}

/* --- Description ----------------------------------------------------------- */

export function ExpandableText({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const ref = useRef<HTMLParagraphElement | null>(null);

  // Only offer "Show more" when the clamp actually hides something.
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => setOverflows(node.scrollHeight > node.clientHeight + 2);
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [text]);

  return (
    <>
      <p ref={ref} className={cn(styles.description, !open && styles.descriptionClamped)}>
        {text}
      </p>
      {overflows || open ? (
        <button type="button" className={styles.moreLink} onClick={() => setOpen((value) => !value)} aria-expanded={open}>
          {open ? 'Show less' : 'Show more'}
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className={cn(styles.moreChevron, open && styles.moreChevronOpen)}>
            <path d="M4.5 2.5 8 6l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ) : null}
    </>
  );
}
