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

/*
  Where the map opens before anyone shares a location: roughly the centre of
  India at a zoom that shows the whole country. Every listing is on this map,
  so it is a real starting point and not a placeholder.
*/
const INDIA = { latitude: 21.5, longitude: 78.5 };
const INDIA_ZOOM = 5;
const NEARBY_ZOOM = 12;

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

function hasCoordinates(property: ApiProperty): boolean {
  return Number.isFinite(Number(property.latitude)) && Number.isFinite(Number(property.longitude));
}

/**
 * The map view.
 *
 * It used to demand geolocation before showing anything, and treated a refusal
 * as an error — so anyone who tapped "Block", every browser with location off,
 * and every automated checker saw a page whose main content was "Something went
 * wrong" and no map. A payment provider's site verifier flagged /map as broken
 * on exactly that basis.
 *
 * Now every approved listing loads immediately on a map of India, no permission
 * needed. Sharing a location is an optional refinement that narrows the list to
 * 10 km, and declining it is treated as the ordinary choice it is.
 */
export function NearbyMap() {
  const [all, setAll] = useState<ApiProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [location, setLocation] = useState<Coordinates | null>(null);
  const [locating, setLocating] = useState(false);
  const [locationNote, setLocationNote] = useState<string | null>(null);

  const loadAll = useCallback(() => {
    setLoading(true);
    setLoadError(null);
    searchProperties({ limit: 100, sort: 'newest' })
      .then((result) => setAll(result.items.filter(hasCoordinates)))
      .catch(() => setLoadError('Could not load stays right now. Please try again.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  /*
    Only ever runs from a click. A permission prompt that fires on page load is
    denied far more often than one a person asked for, and browsers increasingly
    suppress it outright — which was another route to the empty page.
  */
  const useMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocationNote('This browser cannot share a location. Showing all stays.');
      return;
    }
    setLocating(true);
    setLocationNote(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setLocating(false);
      },
      () => {
        setLocating(false);
        setLocationNote('Location not shared — showing all stays instead.');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 },
    );
  }, []);

  const showAll = useCallback(() => {
    setLocation(null);
    setLocationNote(null);
  }, []);

  const visible = location
    ? all
        .map((property) => ({
          property,
          distance: distanceInKm(location, {
            latitude: Number(property.latitude),
            longitude: Number(property.longitude),
          }),
        }))
        .filter((entry) => entry.distance <= RADIUS_KM)
        .sort((a, b) => a.distance - b.distance)
        .map((entry) => entry.property)
    : all;

  if (loading) {
    return (
      <div className={styles.state}>
        <Spinner label="Loading stays" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={styles.state}>
        <ErrorState description={loadError} onRetry={loadAll} />
      </div>
    );
  }

  return (
    <div className={styles.layout}>
      <div className={styles.mapPanel}>
        <NearbyMapCanvas
          center={location ?? INDIA}
          zoom={location ? NEARBY_ZOOM : INDIA_ZOOM}
          radiusKm={location ? RADIUS_KM : null}
          properties={visible}
        />
      </div>
      <aside className={styles.results}>
        <div className={styles.resultsHead}>
          <div>
            <p className="t-label">{location ? `${RADIUS_KM} km radius` : 'All of India'}</p>
            <h2 className="t-h3">{location ? 'Stays near you' : 'Approved stays'}</h2>
          </div>
          {location ? (
            <Button type="button" size="sm" variant="secondary" onClick={showAll}>
              Show all
            </Button>
          ) : (
            <Button type="button" size="sm" variant="secondary" onClick={useMyLocation} disabled={locating}>
              {locating ? 'Locating…' : 'Near me'}
            </Button>
          )}
        </div>
        {locationNote ? (
          <p className="t-body-small" role="status">
            {locationNote}
          </p>
        ) : null}
        {visible.length === 0 ? (
          location ? (
            <EmptyState
              title={`No stays within ${RADIUS_KM} km`}
              description="Show all stays to browse the rest of India."
            />
          ) : (
            <EmptyState
              title="No stays are live yet"
              description="Approved listings appear here as soon as they go live."
              actionHref="/explore"
              actionLabel="Explore stays"
            />
          )
        ) : (
          <div className={styles.list}>
            {visible.map((property) => {
              const card = toPropertyCard(property);
              return (
                <a className={styles.result} key={property.id} href={card.href}>
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
