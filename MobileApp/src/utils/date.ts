/** Date helpers. All ISO strings are YYYY-MM-DD in local time. */

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** Parse a YYYY-MM-DD string into a local Date (midnight). */
export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function toISO(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayISO(): string {
  return toISO(new Date());
}

export function addDays(iso: string, days: number): string {
  const d = parseISO(iso);
  d.setDate(d.getDate() + days);
  return toISO(d);
}

/** Monday of the week containing `iso`. */
export function weekStart(iso: string): string {
  const d = parseISO(iso);
  const day = d.getDay(); // 0 = Sun ... 6 = Sat
  const diff = day === 0 ? -6 : 1 - day; // shift back to Monday
  d.setDate(d.getDate() + diff);
  return toISO(d);
}

/** Array of 7 ISO days starting from `startISO`. */
export function weekDays(startISO: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(startISO, i));
}

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_LONG = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
const MONTH = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function dayShort(iso: string): string {
  return WEEKDAY[parseISO(iso).getDay()];
}

export function dayLong(iso: string): string {
  return WEEKDAY_LONG[parseISO(iso).getDay()];
}

/** e.g. "Mon, Jul 6" */
export function formatShort(iso: string): string {
  const d = parseISO(iso);
  return `${WEEKDAY[d.getDay()]}, ${MONTH[d.getMonth()]} ${d.getDate()}`;
}

/** e.g. "Monday, July 6, 2026" */
export function formatLong(iso: string): string {
  const d = parseISO(iso);
  const monthLong = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ][d.getMonth()];
  return `${WEEKDAY_LONG[d.getDay()]}, ${monthLong} ${d.getDate()}, ${d.getFullYear()}`;
}

export function dayOfMonth(iso: string): number {
  return parseISO(iso).getDate();
}

export function monthLabel(iso: string): string {
  const d = parseISO(iso);
  return `${MONTH[d.getMonth()]} ${d.getFullYear()}`;
}

/** Human friendly relative timestamp for feedback etc. */
export function formatDateTime(value?: string): string {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  const h = d.getHours();
  const min = pad(d.getMinutes());
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${MONTH[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} · ${h12}:${min} ${ampm}`;
}

export function isToday(iso: string): boolean {
  return iso === todayISO();
}
