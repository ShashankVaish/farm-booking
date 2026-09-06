'use client';

import { useEffect, useState } from 'react';
import { Rating } from '@/components/hospitality/atoms';
import { EmptyState, ErrorState, Spinner } from '@/components/ui/feedback';
import { hostApi } from '@/lib/host/host-api';
import { ApiError } from '@/lib/api/errors';
import type { ApiReview } from '@/lib/properties/types';
import styles from '../host.module.css';

type OwnerReview = ApiReview & { property?: { id: string; title: string } };

export default function HostReviewsPage() {
  const [items, setItems] = useState<OwnerReview[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    hostApi
      .reviews()
      .then((result) => setItems(result.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load reviews.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) return <Spinner label="Loading reviews" />;
  if (error) return <ErrorState description={error} onRetry={load} />;

  return (
    <div>
      <p className="t-label">Reputation</p>
      <h1 className="t-h2">Reviews</h1>
      {items.length === 0 ? (
        <EmptyState title="No reviews yet" description="Guests can review after a completed stay." />
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, marginTop: 'var(--space-6)' }}>
          {items.map((review) => (
            <li key={review.id} className={styles.panel} style={{ marginBottom: 'var(--space-4)' }}>
              <p className="t-label">{review.property?.title}</p>
              <Rating value={review.rating} />
              <p className="t-caption">{review.customer?.name}</p>
              {review.comment ? <p className="t-body">{review.comment}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
