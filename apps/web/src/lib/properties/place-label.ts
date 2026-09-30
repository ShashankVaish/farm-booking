/*
  The area a listing is shown under: "Tungarli, Lonavala, Maharashtra".

  Built from the city and state the host saved, plus the `location` label only
  when it is a short locality name. A label with commas in it is a geocoder's
  full display name ("Sambhal, Uttar Pradesh, 244302, India"): it repeats the
  state, can carry a street and PIN, and — because older versions of the
  listing wizard kept it when the host typed a new address — could name a
  place the listing is no longer in. City and state are always what the host
  last saved, so they win.
*/

/** "noida" → "Noida"; anything already cased by a person is left alone. */
function tidy(part: string): string {
  const text = part.trim().replace(/\s+/g, ' ');
  if (text !== text.toLowerCase()) return text;
  return text.replace(/(^|[\s-])\p{L}/gu, (match) => match.toUpperCase());
}

/** Joins the parts that are present, skipping repeats regardless of case. */
export function placeLabel(...parts: Array<string | null | undefined>): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of parts) {
    if (!raw?.trim()) continue;
    const part = tidy(raw);
    const key = part.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(part);
  }
  return out.join(', ');
}

export function areaName(property: {
  location?: string | null;
  city?: string | null;
  state?: string | null;
}): string {
  const locality = property.location && !property.location.includes(',') ? property.location : '';
  return placeLabel(locality, property.city, property.state);
}
