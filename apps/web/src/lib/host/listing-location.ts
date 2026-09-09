export type LocationDraft = {
  query: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  confirmed: boolean;
  confirmedAddress: string;
};

const INDIAN_PIN = /^\d{6}$/;

/**
 * The API validates coordinates with `@IsNumber({ maxDecimalPlaces: 7 })`, so a
 * raw browser GPS reading (which carries far more precision than that) is
 * rejected outright. Round at every point where a coordinate enters the draft —
 * device location, search results, map drags and manual entry alike.
 * Seven decimals is roughly 1 cm, well beyond what a map pin needs.
 */
export const COORDINATE_PRECISION = 7;

export function roundCoordinate(value: number): number {
  return Number.isFinite(value) ? Number(value.toFixed(COORDINATE_PRECISION)) : Number.NaN;
}

export function isValidLatitude(value: number): boolean {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}

export function isValidLongitude(value: number): boolean {
  return Number.isFinite(value) && value >= -180 && value <= 180;
}

export function isIndia(country: string): boolean {
  return country.trim().toLowerCase() === 'india' || country.trim().toLowerCase() === 'in';
}

export function validateListingLocation(draft: LocationDraft): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!draft.address.trim() || draft.address.trim().length < 5) {
    errors.address = 'Enter the full street address.';
  }
  if (!draft.city.trim()) errors.city = 'City is required.';
  if (!draft.state.trim()) errors.state = 'State is required.';
  if (!draft.country.trim()) errors.country = 'Country is required.';
  if (isIndia(draft.country) && !INDIAN_PIN.test(draft.pincode.trim())) {
    errors.pincode = 'Enter a valid 6-digit Indian PIN code.';
  } else if (!draft.pincode.trim()) {
    errors.pincode = 'PIN / postal code is required.';
  }
  if (draft.latitude === null || !isValidLatitude(draft.latitude)) {
    errors.latitude = 'Latitude must be between -90 and 90.';
  }
  if (draft.longitude === null || !isValidLongitude(draft.longitude)) {
    errors.longitude = 'Longitude must be between -180 and 180.';
  }
  if (draft.latitude === 0 && draft.longitude === 0) {
    errors.latitude = 'Place the pin on the property. Do not leave it at 0,0.';
  }
  if (!draft.confirmed) {
    errors.confirmed = 'Confirm the map pin and address before continuing.';
  }
  return errors;
}
