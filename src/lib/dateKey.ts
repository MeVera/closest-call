import { PUZZLE_TIME_ZONE } from '../config';

const keyFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: PUZZLE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const partsFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: PUZZLE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Puzzle date key (YYYY-MM-DD) for an instant, using the Melbourne calendar date. */
export function dateKeyFor(instant: Date): string {
  return keyFormatter.format(instant);
}

function parseKey(key: string): [number, number, number] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) throw new Error(`Bad date key: ${key}`);
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** Calendar arithmetic on date keys (no time zone involved). */
export function addDays(key: string, days: number): string {
  const [y, m, d] = parseKey(key);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}

export function daysBetween(fromKey: string, toKey: string): number {
  const [y1, m1, d1] = parseKey(fromKey);
  const [y2, m2, d2] = parseKey(toKey);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

/**
 * The instant at which Melbourne's calendar reaches 00:00 on `key`.
 * Melbourne is UTC+10 (AEST) or UTC+11 (AEDT); DST changes happen at 02:00/03:00,
 * so midnight always exists exactly once. We try both offsets and keep the one that checks out.
 */
export function startOfDay(key: string): Date {
  const [y, m, d] = parseKey(key);
  for (const offsetHours of [11, 10]) {
    const candidate = new Date(Date.UTC(y, m - 1, d, 0, 0) - offsetHours * 3_600_000);
    const parts = partsFormatter.formatToParts(candidate);
    const get = (t: string) => parts.find((p) => p.type === t)?.value;
    if (dateKeyFor(candidate) === key && get('hour') === '00' && get('minute') === '00') return candidate;
  }
  throw new Error(`Could not resolve midnight for ${key} in ${PUZZLE_TIME_ZONE}`);
}

/** The next reset instant after `now`. */
export function nextResetAt(now: Date): Date {
  return startOfDay(addDays(dateKeyFor(now), 1));
}

/** "7 Oct" style label for share text. */
export function shortDateLabel(key: string): string {
  const [y, m, d] = parseKey(key);
  const month = new Date(Date.UTC(y, m - 1, d)).toLocaleString('en-GB', { month: 'short', timeZone: 'UTC' });
  return `${d} ${month}`;
}

export function formatCountdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, '0')).join(':');
}
