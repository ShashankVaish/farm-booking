'use client';

import { useEffect, useState } from 'react';
import { PropertyGrid, type PropertyCardModel } from '@/components/hospitality/property-card';
import { EmptyState, ErrorState, Spinner } from '@/components/ui/feedback';
import { apiClient } from '@/lib/api/client';
import { memoryTokenStore } from '@/lib/api/token-store';
import { toPropertyCard } from '@/lib/properties/map-property';
import type { ApiProperty } from '@/lib/properties/types';

export function WishlistView() {
  const [items, setItems] = useState<PropertyCardModel[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!memoryTokenStore.getAccessToken()) {
      window.location.href = '/auth/login?next=/dashboard/wishlist';
      return;
    }
    apiClient
      .get<Array<{ property: ApiProperty }>>('/api/wishlist')
      .then((rows) => setItems(rows.map((row) => toPropertyCard(row.property))))
      .catch(() => setError('Could not load your saved stays.'));
  }, []);

  if (error) {
    return <ErrorState description={error} />;
  }
  if (!items) {
    return (
      <div style={{ padding: '4rem 0' }}>
        <Spinner label="Loading wishlist" />
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <EmptyState
        title="No saved stays yet"
        description="Tap the heart on a farmhouse to keep it here."
        actionHref="/explore"
        actionLabel="Browse stays"
      />
    );
  }
  return <PropertyGrid properties={items} />;
}
