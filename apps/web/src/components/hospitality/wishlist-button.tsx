'use client';

import { useState } from 'react';
import { useWishlist } from '@/components/providers/wishlist-provider';
import { useToast } from '@/components/providers/toast-provider';
import { ApiError } from '@/lib/api/errors';
import styles from './hospitality.module.css';

export function WishlistButton({
  propertyId,
  propertyName,
}: {
  propertyId: string;
  propertyName: string;
}) {
  const { has, toggle } = useWishlist();
  const { notify } = useToast();
  const [busy, setBusy] = useState(false);
  const saved = has(propertyId);

  async function onClick() {
    if (busy) return;
    setBusy(true);
    try {
      const result = await toggle(propertyId);
      if (result === 'auth') {
        window.location.href = `/auth/login?next=/properties/${propertyId}`;
        return;
      }
      notify(result === 'added' ? 'Saved to wishlist' : 'Removed from wishlist');
    } catch (error) {
      notify(error instanceof ApiError ? error.message : 'Could not update wishlist.', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className={styles.wish}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${propertyName} from wishlist` : `Save ${propertyName} to wishlist`}
      onClick={onClick}
      disabled={busy}
    >
      <svg width="18" height="18" viewBox="0 0 20 20" aria-hidden="true">
        <path
          d="M10 16s-6-3.7-6-7.2A3.4 3.4 0 0 1 10 6a3.4 3.4 0 0 1 6 2.8C16 12.3 10 16 10 16Z"
          fill={saved ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.4"
        />
      </svg>
    </button>
  );
}
