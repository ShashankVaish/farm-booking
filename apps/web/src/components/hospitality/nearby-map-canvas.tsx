'use client';

import { useEffect, useRef, useState } from 'react';
import type { ApiProperty } from '@/lib/properties/types';
import { DARK_MAP_STYLE, loadGoogleMaps } from '@/lib/maps/google-maps';
import styles from './nearby-map.module.css';

type Props = {
  center: { latitude: number; longitude: number };
  properties: ApiProperty[];
};

/** Coral, matching the brand accent used for active states elsewhere. */
const PROPERTY_COLOR = '#ff5a60';
/** A cool tone for "you", so the two marker kinds are told apart by hue. */
const VIEWER_COLOR = '#8fb8e8';

export function NearbyMapCanvas({ center, properties }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const mapsRef = useRef<typeof google.maps | null>(null);
  // Overlays are tracked so a re-render clears exactly what it drew. Google has
  // no "remove every layer" call, and leaving them attached stacks duplicate
  // pins on every search.
  const overlaysRef = useRef<Array<google.maps.MVCObject & { setMap: (map: google.maps.Map | null) => void }>>([]);
  const infoRef = useRef<google.maps.InfoWindow | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !containerRef.current || mapRef.current) return;
        mapsRef.current = maps;
        mapRef.current = new maps.Map(containerRef.current, {
          center: { lat: center.latitude, lng: center.longitude },
          zoom: 12,
          styles: DARK_MAP_STYLE,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });
        infoRef.current = new maps.InfoWindow();
      })
      .catch((cause: Error) => {
        if (!cancelled) setError(cause.message);
      });

    return () => {
      cancelled = true;
      overlaysRef.current.forEach((overlay) => overlay.setMap(null));
      overlaysRef.current = [];
      infoRef.current?.close();
      mapRef.current = null;
      mapsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const maps = mapsRef.current;
    if (!map || !maps) return;

    map.setCenter({ lat: center.latitude, lng: center.longitude });

    overlaysRef.current.forEach((overlay) => overlay.setMap(null));
    overlaysRef.current = [];

    const radius = new maps.Circle({
      center: { lat: center.latitude, lng: center.longitude },
      radius: 10000,
      map,
      strokeColor: VIEWER_COLOR,
      strokeOpacity: 0.5,
      strokeWeight: 1,
      fillColor: VIEWER_COLOR,
      fillOpacity: 0.06,
    });
    overlaysRef.current.push(radius);

    const you = new maps.Marker({
      position: { lat: center.latitude, lng: center.longitude },
      map,
      title: 'Your location',
      icon: {
        path: maps.SymbolPath.CIRCLE,
        scale: 7,
        fillColor: VIEWER_COLOR,
        fillOpacity: 1,
        strokeColor: '#0d0c10',
        strokeWeight: 2,
      },
    });
    overlaysRef.current.push(you);

    properties.forEach((property) => {
      const latitude = Number(property.latitude);
      const longitude = Number(property.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

      const marker = new maps.Marker({
        position: { lat: latitude, lng: longitude },
        map,
        title: property.title,
        icon: {
          path: maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: PROPERTY_COLOR,
          fillOpacity: 1,
          strokeColor: '#0d0c10',
          strokeWeight: 2,
        },
      });
      marker.addListener('click', () => {
        // Set as text, not HTML: a property title is user-supplied and would
        // otherwise be an injection point in the info window.
        const content = document.createElement('div');
        const name = document.createElement('strong');
        name.textContent = property.title;
        const place = document.createElement('div');
        place.textContent = [property.city, property.state].filter(Boolean).join(', ');
        content.append(name, place);
        infoRef.current?.setContent(content);
        infoRef.current?.open({ map, anchor: marker });
      });
      overlaysRef.current.push(marker);
    });
  }, [center, properties]);

  if (error) {
    return (
      <div className={styles.mapCanvas} role="status">
        <p className={styles.mapError}>{error}</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={styles.mapCanvas}
      aria-label="Map showing nearby properties"
    />
  );
}
