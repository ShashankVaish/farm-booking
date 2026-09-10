/*
  Clock-time helpers for host-facing time fields.

  Times are stored as 24-hour "HH:MM" strings, which is what the listing meta
  block has always held and what sorts and compares correctly. They are shown to
  people as 12-hour with am/pm, because that is how check-in times are spoken
  and written in India — a host reading "23:00" has to stop and convert.
*/

/** Minutes between selectable times. Check-in is never at 14:07. */
export const TIME_STEP_MINUTES = 30;

const TIME_PATTERN = /^([01]?\d|2[0-3]):([0-5]\d)$/;

export function isValidTime(value: string): boolean {
  return TIME_PATTERN.test((value ?? '').trim());
}

/** Minutes since midnight, or null when the string is not a time. */
export function toMinutes(value: string): number | null {
  const match = TIME_PATTERN.exec((value ?? '').trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function fromMinutes(minutes: number): string {
  const wrapped = ((minutes % 1440) + 1440) % 1440;
  const hours = Math.floor(wrapped / 60);
  const mins = wrapped % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

/** "14:00" -> "2:00 pm". Returns the input unchanged if it is not a time. */
export function formatTime12(value: string): string {
  const minutes = toMinutes(value);
  if (minutes === null) return value;
  const hours24 = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const suffix = hours24 < 12 ? 'am' : 'pm';
  // 0 and 12 both display as 12; every other hour is its remainder.
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return `${hours12}:${String(mins).padStart(2, '0')} ${suffix}`;
}

/** Every selectable time in a day, as value/label pairs. */
export function timeOptions(
  stepMinutes: number = TIME_STEP_MINUTES,
): Array<{ value: string; label: string }> {
  const step = Math.max(1, Math.trunc(stepMinutes));
  const options: Array<{ value: string; label: string }> = [];
  for (let minutes = 0; minutes < 1440; minutes += step) {
    const value = fromMinutes(minutes);
    options.push({ value, label: formatTime12(value) });
  }
  return options;
}

/**
 * Snaps a stored time onto the option grid so a value saved before the step
 * changed — or typed by hand — still selects something rather than leaving the
 * control blank.
 */
export function snapToStep(
  value: string,
  stepMinutes: number = TIME_STEP_MINUTES,
): string {
  const minutes = toMinutes(value);
  if (minutes === null) return value;
  const step = Math.max(1, Math.trunc(stepMinutes));
  return fromMinutes(Math.round(minutes / step) * step);
}

/**
 * How long a slot runs, in minutes, treating an end at or before the start as
 * crossing midnight.
 *
 * A night slot is the normal case here: 19:00 to 06:00 is eleven hours, not
 * minus thirteen.
 */
export function durationMinutes(start: string, end: string): number | null {
  const from = toMinutes(start);
  const to = toMinutes(end);
  if (from === null || to === null) return null;
  return to > from ? to - from : 1440 - from + to;
}

/** "11 hrs", "9 hrs 30 min" — for showing what a slot actually covers. */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours} hr${hours === 1 ? '' : 's'}`;
  return `${hours} hr${hours === 1 ? '' : 's'} ${mins} min`;
}

/** "9:00 am – 6:00 pm · 9 hrs", the way a slot reads on a listing. */
export function formatSlotRange(start: string, end: string): string {
  const span = durationMinutes(start, end);
  const range = `${formatTime12(start)} – ${formatTime12(end)}`;
  return span === null ? range : `${range} · ${formatDuration(span)}`;
}
