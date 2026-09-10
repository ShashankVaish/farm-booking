import { afterEach, describe, expect, it, vi } from 'vitest';

async function withKey(key: string) {
  vi.resetModules();
  vi.doMock('@/lib/config/env', () => ({
    publicEnv: { brandName: 'Baagly', apiUrl: '', siteUrl: '', googleMapsApiKey: key },
  }));
  return import('@/lib/maps/google-maps');
}

afterEach(() => {
  vi.doUnmock('@/lib/config/env');
  vi.resetModules();
});

describe('googleMapsEmbedUrl', () => {
  it('builds an Embed API url with the key and centre', async () => {
    const maps = await withKey('test-key');
    const url = maps.googleMapsEmbedUrl({ latitude: 28.6259346, longitude: 77.4369007 });

    expect(url).toContain('https://www.google.com/maps/embed/v1/view');
    expect(url).toContain('key=test-key');
    expect(url).toContain('center=28.6259346%2C77.4369007');
    expect(url).toContain('zoom=13');
  });

  it('honours an explicit zoom', async () => {
    const maps = await withKey('test-key');
    expect(maps.googleMapsEmbedUrl({ latitude: 1, longitude: 2, zoom: 16 })).toContain('zoom=16');
  });

  it('returns null with no key, so the caller can show a real empty state', async () => {
    // Rendering the iframe anyway would put Google's grey "can't load this map"
    // tile on the listing page, which reads as our bug rather than missing config.
    const maps = await withKey('');
    expect(maps.googleMapsEmbedUrl({ latitude: 1, longitude: 2 })).toBeNull();
  });

  it('rounds coordinates to the precision the API stores', async () => {
    const maps = await withKey('test-key');
    // Geolocation hands back ~14 decimals; the API caps at 7.
    expect(maps.googleMapsEmbedUrl({ latitude: 28.62593461234567, longitude: 77.4 })).toContain(
      'center=28.6259346%2C77.4000000',
    );
  });
});

describe('googleMapsPlaceUrl', () => {
  it('opens the pin at the coordinates', async () => {
    const maps = await withKey('');
    const url = maps.googleMapsPlaceUrl(28.6259346, 77.4369007);

    expect(url).toContain('https://www.google.com/maps/search/');
    expect(url).toContain('api=1');
    expect(url).toContain('query=28.6259346%2C77.4369007');
  });

  it('needs no API key, so it works in email', async () => {
    // Emails cannot carry a browser key, and this link is what a guest taps to
    // navigate on the day.
    const maps = await withKey('');
    expect(maps.googleMapsPlaceUrl(1, 2)).toContain('query=1.0000000%2C2.0000000');
  });
});

describe('googleMapsDirectionsUrl', () => {
  it('targets the property as the destination', async () => {
    const maps = await withKey('');
    const url = maps.googleMapsDirectionsUrl(28.6259346, 77.4369007);
    expect(url).toContain('https://www.google.com/maps/dir/');
    expect(url).toContain('destination=28.6259346%2C77.4369007');
  });
});

describe('hasGoogleMapsKey', () => {
  it('reports whether maps can render at all', async () => {
    expect((await withKey('abc')).hasGoogleMapsKey()).toBe(true);
    expect((await withKey('')).hasGoogleMapsKey()).toBe(false);
  });
});

describe('loadGoogleMaps', () => {
  /** Minimal browser surface, so the loader gets past its "browser only" guard. */
  function stubBrowser() {
    const script = {
      id: '',
      src: '',
      async: false,
      defer: false,
      addEventListener: () => undefined,
    };
    vi.stubGlobal('window', {} as Window & typeof globalThis);
    vi.stubGlobal('document', {
      getElementById: () => null,
      createElement: () => script,
      head: { appendChild: () => undefined },
    });
  }

  it('refuses to run on the server rather than injecting a script tag', async () => {
    const maps = await withKey('a-key');
    await expect(maps.loadGoogleMaps()).rejects.toThrow(/only be loaded in the browser/);
  });

  it('rejects with an actionable message when the key is missing', async () => {
    stubBrowser();
    const maps = await withKey('');
    await expect(maps.loadGoogleMaps()).rejects.toThrow(
      /NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set/,
    );
    vi.unstubAllGlobals();
  });

  it('does not cache a failed load', async () => {
    // A cached rejection would leave every map broken for the whole session
    // after one transient failure.
    stubBrowser();
    const maps = await withKey('');
    await expect(maps.loadGoogleMaps()).rejects.toThrow();
    await expect(maps.loadGoogleMaps()).rejects.toThrow();
    vi.unstubAllGlobals();
  });
});

describe('DARK_MAP_STYLE', () => {
  it('never hides labels', async () => {
    // A map you cannot read place names on is decoration, not information.
    const maps = await withKey('');
    const hidden = maps.DARK_MAP_STYLE.filter((rule) =>
      (rule.stylers ?? []).some(
        (styler) => (styler as { visibility?: string }).visibility === 'off',
      ),
    );
    expect(hidden).toEqual([]);
  });
});
