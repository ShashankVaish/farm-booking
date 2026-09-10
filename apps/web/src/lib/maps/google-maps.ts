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
    /** Google calls this when the key is invalid or the referrer is blocked. */
    gm_authFailure?: () => void;
  }
}

const SCRIPT_ID = 'google-maps-js-api';
/** Global Google calls once the API is ready; must be a window-level name. */
const CALLBACK_NAME = '__baaglyGoogleMapsReady';
/** Long enough for a slow connection, short enough that a map never hangs. */
const LOAD_TIMEOUT_MS = 20000;
let loader: Promise<typeof google.maps> | null = null;

/**
 * True once the namespace actually carries the classes callers construct.
 *
 * `window.google.maps` existing is NOT enough. With `loading=async` the
 * bootstrap installs a stub that only has `importLibrary`, so resolving on the
 * script's load event handed callers a namespace whose `Map` was undefined —
 * "maps.Map is not a constructor".
 */
function isMapsReady(maps?: typeof google.maps): boolean {
  return typeof maps?.Map === 'function';
}

/**
 * Whether `ensureMapsLibrary` can complete without waiting for anything else:
 * the constructors are present, or `importLibrary` exists to fetch them.
 */
function canSettleNow(maps?: typeof google.maps): boolean {
  if (isMapsReady(maps)) return true;
  return (
    typeof (maps as { importLibrary?: unknown } | undefined)?.importLibrary ===
    'function'
  );
}

/**
 * Fills the stub in.
 *
 * The modern loader populates `google.maps.*` only after a library is imported;
 * importing "maps" brings in Map, Circle and InfoWindow, and "marker" brings in
 * Marker. Older bootstraps have no `importLibrary` and are already complete, so
 * they resolve straight through.
 */
async function ensureMapsLibrary(): Promise<typeof google.maps> {
  const maps = window.google?.maps;
  if (!maps) {
    throw new Error('Google Maps loaded without a maps namespace.');
  }
  if (isMapsReady(maps)) return maps;

  const importLibrary = (maps as { importLibrary?: (name: string) => Promise<unknown> })
    .importLibrary;
  if (typeof importLibrary !== 'function') {
    throw new Error('Google Maps loaded without a usable Map constructor.');
  }

  await importLibrary.call(maps, 'maps');
  await importLibrary.call(maps, 'marker');

  const ready = window.google?.maps;
  if (!isMapsReady(ready)) {
    throw new Error('Google Maps did not finish loading its map library.');
  }
  return ready;
}

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
    // Already fully loaded by an earlier mount — nothing to inject.
    if (isMapsReady(window.google?.maps)) {
      resolve(window.google!.maps);
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

    const globals = window as unknown as Record<string, unknown>;
    // Held in an object so  can clear a timer that is started further
    // down, after the handlers that reference it are defined.
    const timeout: { id?: number } = {};
    const done = (run: () => void) => {
      if (timeout.id !== undefined) window.clearTimeout(timeout.id);
      run();
    };
    const settle = () =>
      ensureMapsLibrary().then(
        (maps) => done(() => resolve(maps)),
        (cause: Error) => done(() => reject(cause)),
      );

    /*
      Resolution happens ONLY through Google's `callback`.

      The script's `load` event was previously wired up too, and it is a trap:
      it fires as soon as the bootstrap file has executed, at which point
      `google.maps` exists but carries neither `Map` nor `importLibrary` — the
      bootstrap has not fetched its modules yet. That listener therefore rejected
      the promise with "loaded without a usable Map constructor" a moment before
      the callback would have resolved it, and because the promise is cached the
      failure stuck for the rest of the session.
    */
    globals[CALLBACK_NAME] = settle;

    // Google never calls the callback for an auth problem — a bad key, or a
    // referrer the key does not allow. It calls this instead.
    globals.gm_authFailure = () =>
      done(() =>
        reject(
          new Error(
            'Google Maps rejected the API key. Check that the Maps JavaScript API is enabled and that this domain is allowed by the key referrer restrictions.',
          ),
        ),
      );

    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (!existing) {
      const url = new URL('https://maps.googleapis.com/maps/api/js');
      url.searchParams.set('key', key);
      url.searchParams.set('libraries', 'marker');
      url.searchParams.set('loading', 'async');
      url.searchParams.set('callback', CALLBACK_NAME);
      url.searchParams.set('v', 'weekly');

      const script = document.createElement('script');
      script.id = SCRIPT_ID;
      script.src = url.toString();
      script.async = true;
      script.defer = true;
      script.addEventListener('error', () =>
        done(() =>
          reject(
            new Error(
              'Google Maps failed to load. Check the network connection and that the script is not blocked.',
            ),
          ),
        ),
      );
      document.head.appendChild(script);
    } else if (canSettleNow(window.google?.maps)) {
      /*
        The script is already on the page from an earlier attempt and the API is
        far enough along to finish synchronously — its callback has already
        fired and will not fire again.

        If it is NOT far enough along the script is still loading, and settling
        here would throw for exactly the reason above. In that case the reassigned
        callback still runs when it lands, with the timeout as the backstop.
      */
      settle();
    }

    // Nothing above is guaranteed to fire if the request is silently dropped,
    // and a map that spins forever tells nobody anything.
    timeout.id = window.setTimeout(() => {
      reject(new Error('Google Maps took too long to load. Please try again.'));
    }, LOAD_TIMEOUT_MS);
  });

  // A failed load must not be cached, or a transient network error would leave
  // every map on the session permanently broken.
  loader.catch(() => {
    loader = null;
  });

  return loader;
}
