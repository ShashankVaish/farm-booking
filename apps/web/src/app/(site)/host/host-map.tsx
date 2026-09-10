'use client';

import { useEffect, useRef, useState } from 'react';
import { DARK_MAP_STYLE, loadGoogleMaps } from '@/lib/maps/google-maps';
import styles from './host.module.css';

type Props = {
  latitude: number;
  longitude: number;
  onMove: (latitude: number, longitude: number) => void;
};

/**
 * The pin a host drags to place their property, on Google Maps.
 *
 * The marker is the source of truth for the saved coordinates, so its drag
 * handler rounds to seven decimals: the API rejects more than that, which is
 * the same constraint that broke "use current location" when the browser
 * handed back fourteen.
 */
export function HostMap({ latitude, longitude, onMove }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !containerRef.current || mapRef.current) return;

        const map = new maps.Map(containerRef.current, {
          center: { lat: latitude, lng: longitude },
          zoom: 15,
          styles: DARK_MAP_STYLE,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });

        const marker = new maps.Marker({
          position: { lat: latitude, lng: longitude },
          map,
          draggable: true,
          title: 'Drag to the property',
        });

        marker.addListener('dragend', () => {
          const position = marker.getPosition();
          if (!position) return;
          onMoveRef.current(
            Number(position.lat().toFixed(7)),
            Number(position.lng().toFixed(7)),
          );
        });

        // Clicking the map is faster than dragging when the pin starts far away.
        map.addListener('click', (event: google.maps.MapMouseEvent) => {
          if (!event.latLng) return;
          marker.setPosition(event.latLng);
          onMoveRef.current(
            Number(event.latLng.lat().toFixed(7)),
            Number(event.latLng.lng().toFixed(7)),
          );
        });

        mapRef.current = map;
        markerRef.current = marker;
      })
      .catch((cause: Error) => {
        if (!cancelled) setError(cause.message);
      });

    return () => {
      cancelled = true;
      markerRef.current = null;
      mapRef.current = null;
    };
    // Runs once: later coordinate changes are applied by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const position = { lat: latitude, lng: longitude };
    markerRef.current?.setPosition(position);
    mapRef.current?.panTo(position);
  }, [latitude, longitude]);

  if (error) {
    return (
      <div className={styles.mapCanvas} role="status">
        <p className={styles.mapError}>
          {error} You can still search for the address above, or use your current location.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={styles.mapCanvas}
      role="application"
      aria-label="Drag the pin to the property"
    />
  );
}
