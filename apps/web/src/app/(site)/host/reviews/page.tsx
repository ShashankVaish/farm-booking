'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Rating } from '@/components/hospitality/atoms';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/forms';
import { EmptyState, ErrorState, Spinner } from '@/components/ui/feedback';
import { hostApi } from '@/lib/host/host-api';
import { ApiError } from '@/lib/api/errors';
import { useToast } from '@/components/providers/toast-provider';
import type { ApiReview } from '@/lib/properties/types';
import styles from '../host.module.css';

type OwnerReview = ApiReview & { property?: { id: string; title: string } };

export default function HostReviewsPage() {
  const { notify } = useToast();
  const [items, setItems] = useState<OwnerReview[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

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

  async function respond(event: FormEvent, id: string) {
    event.preventDefault();
    const response = (drafts[id] ?? '').trim();
    if (response.length < 2) return;
    setBusyId(id);
    try {
      await hostApi.respondToReview(id, response);
      notify('Response published.');
      load();
    } catch (err) {
      notify(err instanceof ApiError ? err.message : 'Could not save the response.', 'error');
    } finally {
      setBusyId(null);
    }
  }

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
              {review.ownerResponse ? (
                <p className="t-body-small" style={{ marginTop: 'var(--space-3)' }}>
                  Your response: {review.ownerResponse}
                </p>
              ) : (
                <form onSubmit={(event) => void respond(event, review.id)} style={{ marginTop: 'var(--space-4)' }}>
                  <Textarea
                    id={`response-${review.id}`}
                    label="Respond as host"
                    value={drafts[review.id] ?? ''}
                    onChange={(e) => setDrafts((current) => ({ ...current, [review.id]: e.target.value }))}
                    rows={3}
                  />
                  <Button type="submit" size="sm" disabled={busyId === review.id}>
                    {busyId === review.id ? 'Saving…' : 'Publish response'}
                  </Button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
