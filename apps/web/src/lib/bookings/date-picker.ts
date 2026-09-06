export function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayIso(now = new Date()): string {
  return toIsoDate(now);
}

export function addDaysIso(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const next = new Date(year, month - 1, day + days);
  return toIsoDate(next);
}

export function isBefore(a: string, b: string): boolean {
  return a < b;
}

export function isPastDate(iso: string, today = todayIso()): boolean {
  return iso < today;
}

export function nightsBetween(checkIn: string, checkOut: string): string[] {
  if (!checkIn || !checkOut || checkOut <= checkIn) {
    return [];
  }
  const nights: string[] = [];
  let cursor = checkIn;
  while (cursor < checkOut) {
    nights.push(cursor);
    cursor = addDaysIso(cursor, 1);
  }
  return nights;
}

export function isUnavailableStatus(status?: string | null): boolean {
  return status === 'BOOKED' || status === 'BLOCKED';
}

export function rangeHasUnavailable(
  checkIn: string,
  checkOut: string,
  statusByDate: Map<string, string>,
): boolean {
  return nightsBetween(checkIn, checkOut).some((date) => isUnavailableStatus(statusByDate.get(date)));
}

export type DateClickResult = {
  checkIn: string;
  checkOut: string;
  error?: string;
};

export function applyDateClick(
  current: { checkIn: string; checkOut: string },
  clicked: string,
  statusByDate: Map<string, string>,
  today = todayIso(),
): DateClickResult {
  if (isPastDate(clicked, today)) {
    return { ...current, error: 'Past dates cannot be selected.' };
  }
  if (isUnavailableStatus(statusByDate.get(clicked))) {
    return { ...current, error: 'That date is booked or blocked.' };
  }

  if (!current.checkIn || (current.checkIn && current.checkOut)) {
    return { checkIn: clicked, checkOut: '' };
  }

  if (clicked <= current.checkIn) {
    return { checkIn: clicked, checkOut: '' };
  }

  if (rangeHasUnavailable(current.checkIn, clicked, statusByDate)) {
    return { ...current, error: 'Your stay includes unavailable dates. Choose another range.' };
  }

  return { checkIn: current.checkIn, checkOut: clicked };
}

export function monthGrid(month: Date): Array<{ date: string; inMonth: boolean }> {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: Array<{ date: string; inMonth: boolean }> = [];
  for (let i = 0; i < startWeekday; i += 1) {
    const date = new Date(month.getFullYear(), month.getMonth(), 1 - (startWeekday - i));
    cells.push({ date: toIsoDate(date), inMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ date: toIsoDate(new Date(month.getFullYear(), month.getMonth(), day)), inMonth: true });
  }
  return cells;
}
