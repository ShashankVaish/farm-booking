import { WIZARD_STEPS } from './listing-types';

/*
  Where the listing wizard is, expressed so it survives a route change.

  The wizard starts at /host/properties/new and moves to
  /host/properties/{id}/edit the moment the listing is first saved. Those are
  different route segments, so the component is unmounted and remounted; any
  step held only in React state is lost and the host lands back on Basics
  halfway through. The step therefore travels in the URL, and these helpers are
  the only place that decides what a step in a URL means.
*/

const LAST_STEP = WIZARD_STEPS.length - 1;

/** Clamps any number into a step the wizard can actually show. */
export function clampStep(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(Math.trunc(value), 0), LAST_STEP);
}

/**
 * Reads ?step= from a URL.
 *
 * Anything unusable — absent, empty, not a number, out of range — resolves to
 * the first step rather than throwing, because a hand-edited or truncated URL
 * should still open the wizard.
 */
export function parseStepParam(raw: string | string[] | undefined | null): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === undefined || value === null || value.trim() === '') return 0;
  return clampStep(Number(value));
}

/**
 * Where the wizard should send the browser once a new listing has an id.
 *
 * Takes the step the host is moving *to*, not the one they are leaving: this
 * navigation replaces the component, so the step in the URL is the only thing
 * that decides where they arrive.
 */
export function listingEditUrl(propertyId: string, step: number): string {
  return `/host/properties/${propertyId}/edit?step=${clampStep(step)}`;
}
