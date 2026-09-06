'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, Spinner } from '@/components/ui/feedback';
import { hostApi, type OwnerProperty } from '@/lib/host/host-api';
import { ApiError } from '@/lib/api/errors';
import { resolveMedia } from '@/lib/media/provider';
import styles from '../host.module.css';

export default function HostPropertiesPage() {
  const [items, setItems] = useState<OwnerProperty[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    hostApi
      .properties()
      .then((result) => setItems(result.items))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Could not load properties.'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  if (loading) return <Spinner label="Loading properties" />;
  if (error) return <ErrorState description={error} onRetry={load} />;

  return (
    <div>
      <p className="t-label">Listings</p>
      <h1 className="t-h2">Properties</h1>
      {items.length === 0 ? (
        <EmptyState
          title="No properties yet"
          description="Start a listing, confirm the map pin, and submit it for review."
          actionHref="/host/properties/new"
          actionLabel="New listing"
        />
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, marginTop: 'var(--space-6)' }}>
          {items.map((property) => {
            const cover = property.images?.[0];
            const src = cover ? resolveMedia({ src: cover.url, alt: property.title }).src : '';
            return (
              <li key={property.id} className={styles.listRow}>
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img className={styles.thumb} src={src} alt="" />
                ) : (
                  <div className={styles.thumb} />
                )}
                <div>
                  <Link href={`/host/properties/${property.id}/edit`}>{property.title}</Link>
                  <p className="t-caption">
                    {property.city}, {property.state}
                  </p>
                </div>
                <span className={styles.badge}>{property.status.replaceAll('_', ' ')}</span>
              </li>
            );
          })}
        </ul>
      )}
      <div className={styles.actions}>
        <Button href="/host/properties/new">New listing</Button>
      </div>
    </div>
  );
}
