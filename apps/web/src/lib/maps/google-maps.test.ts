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
  type Listeners = Record<string, () => void>;

  /**
   * Minimal browser surface. `google` is what the injected script would install
   * on the window; returns the script's listeners so a test can fire `load`.
   */
  function stubBrowser(google?: unknown): Listeners {
    const listeners: Listeners = {};
    const script = {
      id: '',
      src: '',
      async: false,
      defer: false,
      addEventListener: (event: string, handler: () => void) => {
        listeners[event] = handler;
      },
    };
    const win = { google, clearTimeout: () => undefined, setTimeout: () => 0 };
    vi.stubGlobal('window', win as unknown as Window & typeof globalThis);
    vi.stubGlobal('document', {
      getElementById: () => null,
      createElement: () => script,
      head: { appendChild: () => undefined },
    });
    return listeners;
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

  it('is not poisoned by the script load event firing before the API is ready', async () => {
    /*
      The reported failure. The bootstrap script downloads and fires `load`
      while `google.maps` is still an empty stub — no Map, no importLibrary yet,
      because it has not fetched its own modules. A `load` listener that tried
      to settle there rejected the cached promise with "loaded without a usable
      Map constructor" moments before the callback would have resolved it, and
      the rejection stuck for the whole session.
    */
    const stub: Record<string, unknown> = {};
    const listeners = stubBrowser({ maps: stub });

    const maps = await withKey('a-key');
    const pending = maps.loadGoogleMaps();

    // The bootstrap file has executed but done nothing useful yet.
    listeners.load?.();

    // Only now does Google finish and invoke its callback.
    stub.Map = function Map() {};
    (window as unknown as Record<string, () => void>).__baaglyGoogleMapsReady?.();

    await expect(pending).resolves.toBe(stub);
    vi.unstubAllGlobals();
  });

  it('reports an auth failure instead of hanging', async () => {
    // Google never calls the ready callback for a bad key or a blocked
    // referrer — it calls gm_authFailure, so that has to reject the promise.
    stubBrowser({ maps: {} });
    const maps = await withKey('a-key');
    const pending = maps.loadGoogleMaps();

    (window as unknown as Record<string, () => void>).gm_authFailure?.();

    await expect(pending).rejects.toThrow(/rejected the API key/);
    vi.unstubAllGlobals();
  });

  it('imports the maps and marker libraries when the namespace is a stub', async () => {
    /*
      With `loading=async` the callback can fire while the namespace still only
      exposes importLibrary. Resolving there would hand callers a `maps` with no
      `Map`, and every map would die with "maps.Map is not a constructor".
    */
    const imported: string[] = [];
    const stub: Record<string, unknown> = {
      importLibrary: (name: string) => {
        imported.push(name);
        // Google installs the real classes onto the namespace as a side effect.
        stub.Map = function Map() {};
        stub.Marker = function Marker() {};
        return Promise.resolve({});
      },
    };
    stubBrowser({ maps: stub });

    const maps = await withKey('a-key');
    const pending = maps.loadGoogleMaps();
    (window as unknown as Record<string, () => void>).__baaglyGoogleMapsReady?.();

    const resolved = await pending;
    expect(typeof resolved.Map).toBe('function');
    expect(imported).toContain('maps');
    expect(imported).toContain('marker');
    vi.unstubAllGlobals();
  });

  it('resolves immediately when the namespace is already complete', async () => {
    const ready = { Map: function Map() {} };
    stubBrowser({ maps: ready });
    const maps = await withKey('a-key');
    // No load event is fired here; a second map mounting must not hang.
    await expect(maps.loadGoogleMaps()).resolves.toBe(ready);
    vi.unstubAllGlobals();
  });

  it('reports a namespace that never gains a Map constructor', async () => {
    const stub = { importLibrary: () => Promise.resolve({}) };
    stubBrowser({ maps: stub });
    const maps = await withKey('a-key');
    const pending = maps.loadGoogleMaps();
    (window as unknown as Record<string, () => void>).__baaglyGoogleMapsReady?.();
    await expect(pending).rejects.toThrow(/did not finish loading/);
    vi.unstubAllGlobals();
  });

  it('never settles from the script load event alone', async () => {
    // Guards the regression directly: if a `load` listener is ever reintroduced
    // as a resolution path, this promise settles early and the test fails.
    const listeners = stubBrowser({ maps: {} });
    const maps = await withKey('a-key');

    let settled = false;
    void maps.loadGoogleMaps().then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );

    listeners.load?.();
    await Promise.resolve();
    await Promise.resolve();

    expect(settled).toBe(false);
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
