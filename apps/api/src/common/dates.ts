export function toUtcDateOnly(input: Date | string): Date {
  const raw = typeof input === 'string' ? input : input.toISOString();
  const datePart = raw.slice(0, 10);
  const [year, month, day] = datePart.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function enumerateNights(
  checkIn: Date | string,
  checkOut: Date | string,
): Date[] {
  const start = toUtcDateOnly(checkIn);
  const end = toUtcDateOnly(checkOut);
  const nights: Date[] = [];
  const cursor = new Date(start);

  while (cursor < end) {
    nights.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return nights;
}

export function isWeekendUtc(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

export function datesAreValidRange(
  checkIn: Date | string,
  checkOut: Date | string,
): boolean {
  return toUtcDateOnly(checkIn) < toUtcDateOnly(checkOut);
}
