'use client';

import { useState } from 'react';
import { PropertyCard, type PropertyCardModel } from '@/components/hospitality/property-card';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, Spinner } from '@/components/ui/feedback';
import { searchProperties } from '@/lib/properties/api';
import { toPropertyCard } from '@/lib/properties/map-property';
import type { SearchFilters } from '@/lib/properties/types';
import styles from './hospitality.module.css';

export function ExploreResults({
  initial,
  total,
  filters,
}: {
  initial: PropertyCardModel[];
  total: number;
  filters: SearchFilters;
}) {
  const [items, setItems] = useState(initial);
  const [page, setPage] = useState(filters.page ?? 1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasMore = items.length < total;

  async function loadMore() {
    setLoading(true);
    setError(null);
    try {
      const nextPage = page + 1;
      const result = await searchProperties({ ...filters, page: nextPage, limit: filters.limit ?? 12 });
      setItems((current) => [...current, ...result.items.map(toPropertyCard)]);
      setPage(nextPage);
    } catch {
      setError('Could not load more stays.');
    } finally {
      setLoading(false);
    }
  }

  if (items.length === 0) {
    return (
      <EmptyState
        title="No stays match these filters"
        description="Try a different city, fewer filters, or another weekend."
        actionHref="/"
        actionLabel="Back to home"
      />
    );
  }

  return (
    <div>
      <p className="t-caption" style={{ marginBottom: 'var(--space-4)' }}>
        {total} stay{total === 1 ? '' : 's'}
      </p>
      <div className={styles.grid}>
        {items.map((property) => (
          <PropertyCard key={property.id} property={property} />
        ))}
      </div>
      {error ? <ErrorState description={error} onRetry={() => void loadMore()} /> : null}
      {hasMore ? (
        <div style={{ marginTop: 'var(--space-8)', display: 'flex', justifyContent: 'center' }}>
          <Button variant="secondary" type="button" onClick={() => void loadMore()} disabled={loading}>
            {loading ? <Spinner label="Loading more stays" /> : 'Load more'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
