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

/**
 * Weekend nights are priced differently by the server, which decides using the
 * UTC weekday (`isWeekendUtc`). Parsing the date as UTC here keeps the price
 * shown on the calendar identical to the price the server will charge.
 */
export function isWeekendIso(iso: string): boolean {
  const day = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

export function nightlyPrice(
  iso: string,
  basePrice: number,
  weekendPrice?: number | null,
): number {
  return isWeekendIso(iso) && weekendPrice ? weekendPrice : basePrice;
}

/** Compact rupee label so a price fits inside a calendar cell. */
export function compactInr(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return '';
  if (amount >= 10000000) return `₹${trimZero(amount / 10000000)}Cr`;
  if (amount >= 100000) return `₹${trimZero(amount / 100000)}L`;
  if (amount >= 1000) return `₹${trimZero(amount / 1000)}k`;
  return `₹${Math.round(amount)}`;
}

function trimZero(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function rangeHasUnavailable(
  checkIn: string,
  checkOut: string,
  statusByDate: Map<string, string>,
): boolean {
  return nightsBetween(checkIn, checkOut).some((date) => isUnavailableStatus(statusByDate.get(date)));
}

/**
 * Whether a calendar cell can be clicked, given what is already selected.
 *
 * A stay occupies the nights `[checkIn, checkOut)` — the check-out day itself
 * is never occupied, because the guest leaves that morning and the next guest
 * arrives that afternoon. So a date that is BOOKED or BLOCKED is a perfectly
 * valid check-out, as long as every night before it is free.
 *
 * Treating every booked date as unclickable made the last free night before a
 * booked run impossible to reserve: with the 16th free and the 17th taken, the
 * only check-out that could end a stay on the 16th was disabled, so a one-night
 * stay there could not be selected at all.
 *
 * The server has always agreed with this: `enumerateNights` stops before the
 * check-out date, so it prices and accepts exactly these stays.
 */
export function isSelectableDate(
  date: string,
  current: { checkIn: string; checkOut: string },
  statusByDate: Map<string, string>,
  today = todayIso(),
): boolean {
  if (isPastDate(date, today)) return false;

  // Choosing a check-out: the clicked day is the departure, not a night.
  const choosingCheckOut = Boolean(current.checkIn) && !current.checkOut;
  if (choosingCheckOut && date > current.checkIn) {
    return !rangeHasUnavailable(current.checkIn, date, statusByDate);
  }

  // Otherwise the click starts a new stay, so the day is a night to sleep in.
  return !isUnavailableStatus(statusByDate.get(date));
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

  /*
    The clicked day means two different things depending on what is already
    selected, and only one of them is a night the guest sleeps in.

    Completing a stay: the click is the departure date. Whether that day is
    itself booked is irrelevant — what matters is that every night from the
    check-in up to it is free. This is what makes the last free night before a
    booked run reservable.
  */
  const choosingCheckOut =
    Boolean(current.checkIn) && !current.checkOut && clicked > current.checkIn;

  if (choosingCheckOut) {
    if (rangeHasUnavailable(current.checkIn, clicked, statusByDate)) {
      return { ...current, error: 'Your stay includes unavailable dates. Choose another range.' };
    }
    return { checkIn: current.checkIn, checkOut: clicked };
  }

  // Starting a stay: the click is the first night, so it has to be free.
  if (isUnavailableStatus(statusByDate.get(clicked))) {
    return { ...current, error: 'That date is booked or blocked.' };
  }

  return { checkIn: clicked, checkOut: '' };
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

/**
 * A one-night stay to pre-fill the booking card with, so a guest on a phone
 * can reserve in one tap and change the date only if they want to.
 *
 * Picks at random among the first few free nights from tomorrow on — close
 * enough to be a plausible plan, varied enough that every guest is not steered
 * onto the same night. Returns null when nothing in the window is free.
 */
export function suggestOneNight(
  days: Array<{ date: string; status: string }>,
  options: { today?: string; windowDays?: number; pickFrom?: number; random?: () => number } = {},
): { checkIn: string; checkOut: string } | null {
  const today = options.today ?? todayIso();
  const windowDays = options.windowDays ?? 30;
  const pickFrom = options.pickFrom ?? 7;
  const random = options.random ?? Math.random;
  const status = new Map(days.map((day) => [day.date, day.status]));

  const free: string[] = [];
  for (let offset = 1; offset <= windowDays && free.length < pickFrom; offset += 1) {
    const night = addDaysIso(today, offset);
    if (!isUnavailableStatus(status.get(night))) free.push(night);
  }
  if (!free.length) return null;

  const checkIn = free[Math.min(free.length - 1, Math.floor(random() * free.length))];
  return { checkIn, checkOut: addDaysIso(checkIn, 1) };
}

/** "9–10 Oct", or "31 Oct – 1 Nov" across a month boundary. */
export function shortStayLabel(checkIn: string, checkOut: string): string {
  const [inYear, inMonth, inDay] = checkIn.split('-').map(Number);
  const [outYear, outMonth, outDay] = checkOut.split('-').map(Number);
  const month = (year: number, m: number) =>
    new Date(year, m - 1, 1).toLocaleDateString('en-IN', { month: 'short' });
  if (inYear === outYear && inMonth === outMonth) {
    return `${inDay}–${outDay} ${month(inYear, inMonth)}`;
  }
  return `${inDay} ${month(inYear, inMonth)} – ${outDay} ${month(outYear, outMonth)}`;
}
