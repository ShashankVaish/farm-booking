/*
  Map links for email.

  OpenStreetMap rather than Google Maps: the rest of the site moved back to OSM
  because Google Maps requires a billing account and stamps unbilled projects
  with a "For development purposes only" watermark. Keeping one map provider
  everywhere means a guest sees the same thing in the email and on the listing.

  These are deliberately plain URL builders. An email cannot run JavaScript and
  must not carry an API key, so the only thing worth sending is a link.
*/

/** Seven decimals is the precision the property record stores. */
function coord(value: number): string {
  return value.toFixed(7);
}

function usable(latitude: unknown, longitude: unknown): boolean {
  const lat = Number(latitude);
  const lng = Number(longitude);
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    // 0,0 is in the Atlantic. It is what an unset pair looks like, and sending
    // a guest a link to the middle of the ocean is worse than sending none.
    !(lat === 0 && lng === 0)
  );
}

/** A pin at the property, or null when the listing has no usable coordinates. */
export function mapPlaceUrl(
  latitude: unknown,
  longitude: unknown,
): string | null {
  if (!usable(latitude, longitude)) return null;
  const lat = coord(Number(latitude));
  const lng = coord(Number(longitude));
  // `mlat`/`mlon` drop a marker; the fragment sets the starting zoom.
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;
}

/** Directions to the property, with the start left for the guest to fill in. */
export function mapDirectionsUrl(
  latitude: unknown,
  longitude: unknown,
): string | null {
  if (!usable(latitude, longitude)) return null;
  const lat = coord(Number(latitude));
  const lng = coord(Number(longitude));
  return `https://www.openstreetmap.org/directions?to=${lat}%2C${lng}`;
}

/** Joins the address parts a property record holds, skipping the empty ones. */
export function formatPropertyAddress(property: {
  address?: string | null;
  location?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  country?: string | null;
}): string {
  return (
    [
      property.address,
      property.location,
      property.city,
      property.state,
      property.pincode,
      property.country,
    ]
      .map((part) => (part ?? '').trim())
      .filter(Boolean)
      // A host often repeats the city inside the free-text address line.
      .filter((part, index, parts) => parts.indexOf(part) === index)
      .join(', ')
  );
}
