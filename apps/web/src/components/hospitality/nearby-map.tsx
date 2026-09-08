'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, Spinner } from '@/components/ui/feedback';
import { searchProperties } from '@/lib/properties/api';
import { toPropertyCard } from '@/lib/properties/map-property';
import type { ApiProperty } from '@/lib/properties/types';
import styles from './nearby-map.module.css';

const NearbyMapCanvas = dynamic(() => import('./nearby-map-canvas').then((module) => module.NearbyMapCanvas), {
  ssr: false,
  loading: () => <div className={styles.mapLoading}>Loading map…</div>,
});

const RADIUS_KM = 10;

type Coordinates = { latitude: number; longitude: number };

function distanceInKm(from: Coordinates, to: Coordinates) {
  const earthRadius = 6371;
  const latDelta = ((to.latitude - from.latitude) * Math.PI) / 180;
  const lngDelta = ((to.longitude - from.longitude) * Math.PI) / 180;
  const lat1 = (from.latitude * Math.PI) / 180;
  const lat2 = (to.latitude * Math.PI) / 180;
  const value =
    Math.sin(latDelta / 2) ** 2 + Math.sin(lngDelta / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return earthRadius * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

export function NearbyMap() {
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [properties, setProperties] = useState<ApiProperty[]>([]);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadNearby = useCallback((position: GeolocationPosition) => {
    const user = { latitude: position.coords.latitude, longitude: position.coords.longitude };
    setCoordinates(user);
    setLocating(false);
    setLoading(true);
    setError(null);
    searchProperties({ limit: 100, sort: 'rating' })
      .then((result) => {
        const nearby = result.items
          .filter((property) => Number.isFinite(Number(property.latitude)) && Number.isFinite(Number(property.longitude)))
          .map((property) => ({
            property,
            distance: distanceInKm(user, { latitude: Number(property.latitude), longitude: Number(property.longitude) }),
          }))
          .filter((entry) => entry.distance <= RADIUS_KM)
          .sort((a, b) => a.distance - b.distance)
          .map((entry) => entry.property);
        setProperties(nearby);
      })
      .catch(() => setError('Could not load nearby stays. Please try again.'))
      .finally(() => setLoading(false));
  }, []);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Location access is not available in this browser.');
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      loadNearby,
      () => {
        setLocating(false);
        setError('Location permission was not granted. Allow location access to find stays within 10 km.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 },
    );
  }, [loadNearby]);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  if (locating || loading) {
    return <div className={styles.state}><Spinner label={locating ? 'Requesting your location' : 'Finding nearby stays'} /></div>;
  }

  if (error && !coordinates) {
    return (
      <div className={styles.state}>
        <ErrorState description={error} onRetry={requestLocation} />
      </div>
    );
  }

  if (!coordinates) return null;

  return (
    <div className={styles.layout}>
      <div className={styles.mapPanel}>
        <NearbyMapCanvas center={coordinates} properties={properties} />
      </div>
      <aside className={styles.results}>
        <div className={styles.resultsHead}>
          <div>
            <p className="t-label">10 km radius</p>
            <h2 className="t-h3">Nearby properties</h2>
          </div>
          <Button type="button" size="sm" variant="secondary" onClick={requestLocation}>Refresh</Button>
        </div>
        {error ? <p className="t-body-small" role="alert">{error}</p> : null}
        {properties.length === 0 ? (
          <EmptyState title="No stays within 10 km" description="Try Explore to search more destinations across India." actionHref="/explore" actionLabel="Explore stays" />
        ) : (
          <div className={styles.list}>
            {properties.map((property) => {
              const card = toPropertyCard(property);
              return (
                <a className={styles.result} key={property.id} href={`/properties/${property.id}`}>
                  <span className={styles.resultTitle}>{card.name}</span>
                  <span className="t-caption">{card.location}</span>
                  <span className={styles.resultPrice}>₹{Math.round(card.price).toLocaleString('en-IN')} / night</span>
                </a>
              );
            })}
          </div>
        )}
      </aside>
    </div>
  );
}
