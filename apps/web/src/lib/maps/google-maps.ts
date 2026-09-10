import { publicEnv } from '@/lib/config/env';

/*
  Google Maps plumbing, shared by every map on the site.

  One loader exists because the Maps JavaScript API must be injected exactly
  once per page: adding the script twice logs "You have included the Google Maps
  JavaScript API multiple times" and re-initialises the namespace underneath any
  map already running. The promise is cached at module scope so several map
  components mounting together all await the same load.
*/

export function googleMapsApiKey(): string {
  return publicEnv.googleMapsApiKey;
}

export function hasGoogleMapsKey(): boolean {
  return googleMapsApiKey().length > 0;
}

/** Rounded the way the API stores coordinates, so URLs stay stable. */
function coord(value: number): string {
  return value.toFixed(7);
}

/**
 * A place link that opens the Google Maps app on a phone and the site on
 * desktop. Used in emails and as the "open in Maps" affordance.
 */
export function googleMapsPlaceUrl(latitude: number, longitude: number): string {
  const url = new URL('https://www.google.com/maps/search/');
  url.searchParams.set('api', '1');
  // Coordinates rather than a place name: the exact address stays private until
  // a booking is confirmed, and a name would resolve to the wrong pin anyway.
  url.searchParams.set('query', `${coord(latitude)},${coord(longitude)}`);
  return url.toString();
}

/** Turn-by-turn directions to the property. */
export function googleMapsDirectionsUrl(latitude: number, longitude: number): string {
  const url = new URL('https://www.google.com/maps/dir/');
  url.searchParams.set('api', '1');
  url.searchParams.set('destination', `${coord(latitude)},${coord(longitude)}`);
  return url.toString();
}

/**
 * Embed API URL for a non-interactive map in an iframe.
 *
 * Used where a full JavaScript map would be wasted — a server-rendered listing
 * page only needs to show where the place roughly is. Returns null without a
 * key so the caller can render an honest empty state instead of Google's grey
 * "can't load" tile.
 */
export function googleMapsEmbedUrl(options: {
  latitude: number;
  longitude: number;
  zoom?: number;
}): string | null {
  const key = googleMapsApiKey();
  if (!key) return null;
  const url = new URL('https://www.google.com/maps/embed/v1/view');
  url.searchParams.set('key', key);
  url.searchParams.set('center', `${coord(options.latitude)},${coord(options.longitude)}`);
  url.searchParams.set('zoom', String(options.zoom ?? 13));
  url.searchParams.set('maptype', 'roadmap');
  return url.toString();
}

/*
  A restrained dark style.

  The site is dark throughout, and Google's default light map dropped into it
  reads as a bright rectangle pasted onto the page. Only lightness and hue are
  moved — no labels are hidden, because a map you cannot read place names on is
  decoration rather than information.
*/
export const DARK_MAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#15131a' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#9a908e' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0d0c10' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#332e3d' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#c6bbb3' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#9a908e' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#16261f' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#221f29' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#9a908e' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#2b2733' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3a3441' }] },
  { featureType: 'transit', elementType: 'geometry', stylers: [{ color: '#221f29' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0b1620' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#4a5a6a' }] },
];

declare global {
  interface Window {
    google?: typeof google;
  }
}

const SCRIPT_ID = 'google-maps-js-api';
let loader: Promise<typeof google.maps> | null = null;

/**
 * Injects the Maps JavaScript API once and resolves with the `google.maps`
 * namespace. Rejects when no key is configured, so callers show a real message
 * rather than waiting forever on a script that will never load.
 */
export function loadGoogleMaps(): Promise<typeof google.maps> {
  if (loader) return loader;

  loader = new Promise((resolve, reject) => {
    if (typeof window === 'undefined') {
      reject(new Error('Google Maps can only be loaded in the browser.'));
      return;
    }
    if (window.google?.maps) {
      resolve(window.google.maps);
      return;
    }
    const key = googleMapsApiKey();
    if (!key) {
      reject(
        new Error(
          'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set, so maps cannot load.',
        ),
      );
      return;
    }

    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    const script = existing ?? document.createElement('script');
    if (!existing) {
      const url = new URL('https://maps.googleapis.com/maps/api/js');
      url.searchParams.set('key', key);
      url.searchParams.set('libraries', 'marker');
      url.searchParams.set('loading', 'async');
      url.searchParams.set('v', 'weekly');
      script.id = SCRIPT_ID;
      script.src = url.toString();
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    script.addEventListener('load', () => {
      if (window.google?.maps) resolve(window.google.maps);
      else reject(new Error('Google Maps loaded without a maps namespace.'));
    });
    script.addEventListener('error', () =>
      reject(new Error('Google Maps failed to load. Check the API key and its referrer restrictions.')),
    );
  });

  // A failed load must not be cached, or a transient network error would leave
  // every map on the session permanently broken.
  loader.catch(() => {
    loader = null;
  });

  return loader;
}
