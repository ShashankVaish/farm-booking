/*
  Google Maps links for email.

  Deliberately plain URL builders rather than anything that calls Google: an
  email cannot run JavaScript and must not carry an API key, so the only thing
  worth sending is a link that opens the Maps app on a phone and the website on
  a desktop. `api=1` is the documented, stable form for exactly that.
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
export function googleMapsPlaceUrl(
  latitude: unknown,
  longitude: unknown,
): string | null {
  if (!usable(latitude, longitude)) return null;
  const url = new URL('https://www.google.com/maps/search/');
  url.searchParams.set('api', '1');
  url.searchParams.set('query', `${coord(Number(latitude))},${coord(Number(longitude))}`);
  return url.toString();
}

/** Directions from wherever the guest is, to the property. */
export function googleMapsDirectionsUrl(
  latitude: unknown,
  longitude: unknown,
): string | null {
  if (!usable(latitude, longitude)) return null;
  const url = new URL('https://www.google.com/maps/dir/');
  url.searchParams.set('api', '1');
  url.searchParams.set(
    'destination',
    `${coord(Number(latitude))},${coord(Number(longitude))}`,
  );
  return url.toString();
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
  return [
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
    .join(', ');
}
