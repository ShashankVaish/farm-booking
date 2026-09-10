'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { ApiProperty } from '@/lib/properties/types';
import styles from './nearby-map.module.css';

type Props = {
  center: { latitude: number; longitude: number };
  properties: ApiProperty[];
};

export function NearbyMapCanvas({ center, properties }: Props) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current).setView([center.latitude, center.longitude], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap' }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [center.latitude, center.longitude]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setView([center.latitude, center.longitude], 12);
    map.eachLayer((layer) => {
      if (layer instanceof L.Circle || layer instanceof L.CircleMarker || layer instanceof L.Marker) map.removeLayer(layer);
    });
    L.circle([center.latitude, center.longitude], { radius: 10000, color: '#9b4fe0', fillOpacity: 0.06 }).addTo(map);
    L.circleMarker([center.latitude, center.longitude], { radius: 8, color: '#fff', fillColor: '#9b4fe0', fillOpacity: 1, weight: 3 }).addTo(map).bindPopup('Your location');
    properties.forEach((property) => {
      const latitude = Number(property.latitude);
      const longitude = Number(property.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
      L.circleMarker([latitude, longitude], { radius: 7, color: '#ff8660', fillColor: '#ff8660', fillOpacity: 0.95, weight: 2 })
        .addTo(map)
        .bindPopup(`<strong>${property.title}</strong><br />${property.city}, ${property.state}`);
    });
  }, [center, properties]);

  return <div ref={containerRef} className={styles.mapCanvas} aria-label="Map showing nearby properties" />;
}
