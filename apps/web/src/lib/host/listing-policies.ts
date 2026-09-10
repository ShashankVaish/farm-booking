/*
  Fixed choices for the house-policy fields in the listing wizard.

  These were free-text inputs, which produced exactly the mess you would expect
  across real listings: "Not allowed" on some, a lowercase "allowed" on others.
  Guests cannot filter on prose and it reads inconsistently on the listing page.

  The values are still stored as plain strings inside the host-meta block, so
  nothing about the storage format changes — the wizard just stops letting
  someone invent a new spelling.
*/

export const SMOKING_OPTIONS = [
  'Not allowed',
  'Allowed in outdoor areas only',
  'Allowed',
] as const;

export const PET_OPTIONS = [
  'Not allowed',
  'Allowed on request',
  'Allowed',
] as const;

/**
 * Matches a stored value to its canonical option, ignoring case and padding.
 *
 * Listings saved before this was a dropdown hold values like "allowed", which
 * mean the same thing as the option but do not match it character for
 * character. Folding them keeps the select from looking empty on an old listing
 * — and, worse, from saving a policy the host never chose.
 */
export function canonicalPolicy(
  options: readonly string[],
  stored: string | null | undefined,
): string | null {
  const text = (stored ?? '').trim();
  if (!text) return null;
  const match = options.find(
    (option) => option.toLowerCase() === text.toLowerCase(),
  );
  return match ?? null;
}

/**
 * The list to render, keeping any stored value that is genuinely not one of the
 * options so editing an old listing cannot quietly rewrite its policy. Whatever
 * the host typed years ago stays selectable until they change it themselves.
 */
export function policyOptions(
  options: readonly string[],
  stored: string | null | undefined,
): string[] {
  const text = (stored ?? '').trim();
  if (!text || canonicalPolicy(options, text)) {
    return [...options];
  }
  return [...options, text];
}

/** What the select should show as selected for a stored value. */
export function selectedPolicy(
  options: readonly string[],
  stored: string | null | undefined,
): string {
  const text = (stored ?? '').trim();
  if (!text) return options[0] ?? '';
  return canonicalPolicy(options, text) ?? text;
}
