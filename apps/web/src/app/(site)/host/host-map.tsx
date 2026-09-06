'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

type Props = {
  latitude: number;
  longitude: number;
  onMove: (latitude: number, longitude: number) => void;
};

export function HostMap({ latitude, longitude, onMove }: Props) {
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onMoveRef = useRef(onMove);
  onMoveRef.current = onMove;

  useEffect(() => {
    const container = document.getElementById('host-listing-map');
    if (!container || mapRef.current) return;

    const map = L.map(container).setView([latitude, longitude], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
    }).addTo(map);

    const icon = L.icon({
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
    });

    const marker = L.marker([latitude, longitude], { draggable: true, icon }).addTo(map);
    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      onMoveRef.current(Number(pos.lat.toFixed(7)), Number(pos.lng.toFixed(7)));
    });

    mapRef.current = map;
    markerRef.current = marker;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    markerRef.current?.setLatLng([latitude, longitude]);
    mapRef.current?.panTo([latitude, longitude]);
  }, [latitude, longitude]);

  return <div id="host-listing-map" role="application" aria-label="Property map" />;
}
