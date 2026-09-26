/**
 * Numeric search filters from the URL. A link can carry anything
 * ("guests=0", "guests=abc"), and the API refuses the whole search over one bad
 * value, so only positive numbers are passed on; the rest are dropped.
 */
export function positiveInt(value: string | undefined): number | undefined {
  const number = Number(value);
  return value && Number.isInteger(number) && number > 0 ? number : undefined;
}

export function positiveNumber(value: string | undefined): number | undefined {
  const number = Number(value);
  return value && Number.isFinite(number) && number > 0 ? number : undefined;
}
