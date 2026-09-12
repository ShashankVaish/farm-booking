'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { ApiProperty } from '@/lib/properties/types';
import styles from './nearby-map.module.css';

type Props = {
  center: { latitude: number; longitude: number };
  zoom: number;
  /** Draws the search radius and a "you are here" marker; null when browsing all of India. */
  radiusKm: number | null;
  properties: ApiProperty[];
};

export function NearbyMapCanvas({ center, zoom, radiusKm, properties }: Props) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current).setView([center.latitude, center.longitude], zoom);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
    // The map is created once; later prop changes are applied by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    map.eachLayer((layer) => {
      if (layer instanceof L.Circle || layer instanceof L.CircleMarker || layer instanceof L.Marker) map.removeLayer(layer);
    });

    const pins = properties
      .map((property) => ({
        property,
        latitude: Number(property.latitude),
        longitude: Number(property.longitude),
      }))
      .filter((pin) => Number.isFinite(pin.latitude) && Number.isFinite(pin.longitude));

    pins.forEach(({ property, latitude, longitude }) => {
      L.circleMarker([latitude, longitude], { radius: 7, color: '#ff8660', fillColor: '#ff8660', fillOpacity: 0.95, weight: 2 })
        .addTo(map)
        .bindPopup(
          `<strong>${escapeHtml(property.title)}</strong><br />${escapeHtml(property.city)}, ${escapeHtml(property.state)}`,
        );
    });

    if (radiusKm !== null) {
      // Nearby mode: the view is the person's location and their radius.
      L.circle([center.latitude, center.longitude], { radius: radiusKm * 1000, color: '#9b4fe0', fillOpacity: 0.06 }).addTo(map);
      L.circleMarker([center.latitude, center.longitude], { radius: 8, color: '#fff', fillColor: '#9b4fe0', fillOpacity: 1, weight: 3 })
        .addTo(map)
        .bindPopup('Your location');
      map.setView([center.latitude, center.longitude], zoom);
      return;
    }

    /*
      Browsing mode: frame whatever is actually listed rather than a fixed
      country view. Two listings in Maharashtra should fill the map, not sit as
      two dots in the middle of a continent. With nothing listed, fall back to
      the country so the map is still recognisably India.
    */
    if (pins.length > 1) {
      map.fitBounds(
        L.latLngBounds(pins.map((pin) => [pin.latitude, pin.longitude] as [number, number])),
        { padding: [40, 40], maxZoom: 11 },
      );
    } else if (pins.length === 1) {
      map.setView([pins[0].latitude, pins[0].longitude], 10);
    } else {
      map.setView([center.latitude, center.longitude], zoom);
    }
  }, [center, zoom, radiusKm, properties]);

  return <div ref={containerRef} className={styles.mapCanvas} aria-label="Map of approved stays" />;
}

/** Titles and place names are host-supplied and land inside popup HTML. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
