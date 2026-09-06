'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/forms';
import { hostApi, type PlaceSuggestion } from '@/lib/host/host-api';
import type { LocationDraft } from '@/lib/host/listing-location';
import { validateListingLocation } from '@/lib/host/listing-location';
import styles from './host.module.css';

const HostMap = dynamic(() => import('./host-map').then((mod) => mod.HostMap), { ssr: false });

type Props = {
  value: LocationDraft;
  onChange: (next: LocationDraft) => void;
};

export function LocationStep({ value, onChange }: Props) {
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [pending, setPending] = useState<LocationDraft | null>(null);
  const [gpsHint, setGpsHint] = useState<string | null>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    const q = value.query.trim();
    if (q.length < 3) {
      setSuggestions([]);
      return;
    }
    const timer = window.setTimeout(() => {
      setSearching(true);
      hostApi
        .searchPlaces(q)
        .then(setSuggestions)
        .catch(() => setSuggestions([]))
        .finally(() => setSearching(false));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [value.query]);

  const applyCoords = useCallback(
    (latitude: number, longitude: number) => {
      const current = valueRef.current;
      onChange({ ...current, latitude, longitude, confirmed: false });
      hostApi
        .reverseGeocode(latitude, longitude)
        .then((place) => {
          const latest = valueRef.current;
          onChange({
            ...latest,
            latitude,
            longitude,
            confirmed: false,
            address: place.address || latest.address,
            city: place.city || latest.city,
            state: place.state || latest.state,
            country: place.country || latest.country || 'India',
            pincode: place.pincode || latest.pincode,
            location: place.displayName || latest.location,
          });
        })
        .catch(() => undefined);
    },
    [onChange],
  );

  function pickSuggestion(place: PlaceSuggestion) {
    onChange({
      ...value,
      query: place.displayName,
      address: place.address || place.displayName,
      city: place.city || '',
      state: place.state || '',
      country: place.country || 'India',
      pincode: place.pincode || value.pincode,
      location: place.displayName,
      latitude: place.latitude,
      longitude: place.longitude,
      confirmed: false,
      confirmedAddress: '',
    });
    setSuggestions([]);
  }

  function requestGps() {
    setGpsHint(null);
    if (!navigator.geolocation) {
      setGpsHint('Browser location is not available. Search for the address instead.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        applyCoords(pos.coords.latitude, pos.coords.longitude);
        setGpsHint('Approximate device location loaded. Adjust the pin and confirm — it is not used until you confirm.');
      },
      () => setGpsHint('Location permission was not granted. Search the address instead.'),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  function prepareConfirm() {
    const next = {
      ...value,
      location: value.location || [value.city, value.state].filter(Boolean).join(', '),
    };
    const errors = validateListingLocation({ ...next, confirmed: true });
    delete errors.confirmed;
    if (Object.keys(errors).length > 0) {
      setGpsHint(Object.values(errors)[0]);
      return;
    }
    setPending(next);
  }

  async function confirm() {
    if (!pending || pending.latitude === null || pending.longitude === null) return;
    const result = await hostApi.confirmLocation({
      latitude: pending.latitude,
      longitude: pending.longitude,
      displayName: pending.location,
      address: pending.address,
      city: pending.city,
      state: pending.state,
      country: pending.country,
      pincode: pending.pincode,
    });
    onChange({
      ...pending,
      location: result.location || pending.location,
      address: result.address || pending.address,
      city: result.city || pending.city,
      state: result.state || pending.state,
      country: result.country || pending.country,
      pincode: result.pincode || pending.pincode,
      latitude: result.latitude,
      longitude: result.longitude,
      confirmed: true,
      confirmedAddress: result.address || pending.address,
    });
    setPending(null);
  }

  const showMap = value.latitude !== null && value.longitude !== null;

  return (
    <div>
      <p className="t-label">Location</p>
      <h2 className="t-h3">Place the pin on the property</h2>
      <p className="t-body-small">
        Search the address, drag the pin if needed, then confirm. Browser GPS is optional and never saved until you confirm.
      </p>

      <div style={{ marginTop: 'var(--space-5)' }}>
        <Input
          id="location-search"
          label="Search address"
          value={value.query}
          onChange={(event) => onChange({ ...value, query: event.target.value, confirmed: false })}
          hint={searching ? 'Searching…' : 'Start typing a village, city, or street'}
          autoComplete="off"
        />
        {suggestions.length > 0 ? (
          <ul className={styles.suggestions}>
            {suggestions.map((place) => (
              <li key={`${place.latitude}-${place.longitude}-${place.displayName}`}>
                <button type="button" onClick={() => pickSuggestion(place)}>
                  {place.displayName}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className={styles.twoCol} style={{ marginTop: 'var(--space-5)' }}>
        <Input id="address" label="Address" required value={value.address} onChange={(e) => onChange({ ...value, address: e.target.value, confirmed: false })} />
        <Input id="city" label="City" required value={value.city} onChange={(e) => onChange({ ...value, city: e.target.value, confirmed: false })} />
        <Input id="state" label="State" required value={value.state} onChange={(e) => onChange({ ...value, state: e.target.value, confirmed: false })} />
        <Input id="pincode" label="PIN code" required value={value.pincode} onChange={(e) => onChange({ ...value, pincode: e.target.value, confirmed: false })} hint="6-digit Indian PIN where applicable" />
        <Input id="country" label="Country" required value={value.country} onChange={(e) => onChange({ ...value, country: e.target.value, confirmed: false })} />
        <Input
          id="lat"
          label="Latitude"
          value={value.latitude ?? ''}
          onChange={(e) => onChange({ ...value, latitude: e.target.value === '' ? null : Number(e.target.value), confirmed: false })}
        />
        <Input
          id="lng"
          label="Longitude"
          value={value.longitude ?? ''}
          onChange={(e) => onChange({ ...value, longitude: e.target.value === '' ? null : Number(e.target.value), confirmed: false })}
        />
      </div>

      <div className={styles.actions}>
        <Button type="button" variant="secondary" onClick={requestGps}>
          Use device location (optional)
        </Button>
      </div>
      {gpsHint ? <p className="t-body-small">{gpsHint}</p> : null}

      {showMap ? (
        <div className={styles.map}>
          <HostMap latitude={value.latitude as number} longitude={value.longitude as number} onMove={applyCoords} />
        </div>
      ) : (
        <p className="t-body-small" style={{ marginTop: 'var(--space-4)' }}>
          Search an address to open the map.
        </p>
      )}

      {value.confirmed ? (
        <div className={styles.confirmBox}>
          <p className="t-label">Confirmed address</p>
          <p className="t-body">{value.confirmedAddress}</p>
          <p className="t-caption">
            {value.latitude}, {value.longitude}
          </p>
        </div>
      ) : null}

      <div className={styles.actions}>
        <Button type="button" onClick={prepareConfirm} disabled={!showMap}>
          Use this location
        </Button>
      </div>

      {pending ? (
        <div className={styles.confirmBox} role="dialog" aria-labelledby="confirm-location">
          <h3 id="confirm-location" className="t-h3">
            Confirm this location?
          </h3>
          <p className="t-body-small">{pending.address}</p>
          <p className="t-body-small">
            {pending.city}, {pending.state} {pending.pincode}, {pending.country}
          </p>
          <p className="t-caption">
            {pending.latitude}, {pending.longitude}
          </p>
          <div className={styles.actions}>
            <Button type="button" onClick={() => void confirm()}>
              Save coordinates and address
            </Button>
            <Button type="button" variant="ghost" onClick={() => setPending(null)}>
              Adjust pin
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
