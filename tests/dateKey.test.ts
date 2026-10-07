import { describe, expect, it } from 'vitest';
import { addDays, dateKeyFor, daysBetween, formatCountdown, nextResetAt, shortDateLabel, startOfDay } from '../src/lib/dateKey';

// Melbourne: AEDT (UTC+11) from the first Sunday in October to the first Sunday in April,
// AEST (UTC+10) otherwise.

describe('date key rolls over at midnight Australia/Melbourne', () => {
  it('daylight saving time (AEDT, UTC+11): 15 Jan 2026', () => {
    // 00:00 AEDT on 15 Jan = 13:00 UTC on 14 Jan
    expect(dateKeyFor(new Date('2026-01-14T12:59:59Z'))).toBe('2026-01-14');
    expect(dateKeyFor(new Date('2026-01-14T13:00:00Z'))).toBe('2026-01-15');
    expect(dateKeyFor(new Date('2026-01-14T13:00:01Z'))).toBe('2026-01-15');
  });

  it('standard time (AEST, UTC+10): 15 Jul 2026', () => {
    // 00:00 AEST on 15 Jul = 14:00 UTC on 14 Jul
    expect(dateKeyFor(new Date('2026-07-14T13:59:59Z'))).toBe('2026-07-14');
    expect(dateKeyFor(new Date('2026-07-14T14:00:00Z'))).toBe('2026-07-15');
  });

  it('is not UTC midnight', () => {
    expect(dateKeyFor(new Date('2026-07-15T00:00:00Z'))).toBe('2026-07-15'); // 10:00 local
    expect(dateKeyFor(new Date('2026-07-14T23:59:59Z'))).toBe('2026-07-15'); // 09:59 local
  });

  it('handles the DST start and end days', () => {
    // DST starts 4 Oct 2026 at 02:00 AEST -> 03:00 AEDT. Midnight that day is still AEST.
    expect(startOfDay('2026-10-04').toISOString()).toBe('2026-10-03T14:00:00.000Z');
    expect(startOfDay('2026-10-05').toISOString()).toBe('2026-10-04T13:00:00.000Z');
    // DST ends 5 Apr 2026 at 03:00 AEDT -> 02:00 AEST. Midnight that day is still AEDT.
    expect(startOfDay('2026-04-05').toISOString()).toBe('2026-04-04T13:00:00.000Z');
    expect(startOfDay('2026-04-06').toISOString()).toBe('2026-04-05T14:00:00.000Z');
  });

  it('next reset is the coming Melbourne midnight', () => {
    expect(nextResetAt(new Date('2026-01-14T12:59:59Z')).toISOString()).toBe('2026-01-14T13:00:00.000Z');
    expect(nextResetAt(new Date('2026-01-14T13:00:00Z')).toISOString()).toBe('2026-01-15T13:00:00.000Z');
    expect(nextResetAt(new Date('2026-07-14T13:59:59Z')).toISOString()).toBe('2026-07-14T14:00:00.000Z');
  });
});

describe('date helpers', () => {
  it('adds days across months and years', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(daysBetween('2026-10-01', '2027-11-05')).toBe(400);
  });
  it('labels and countdowns', () => {
    expect(shortDateLabel('2026-10-07')).toBe('7 Oct');
    expect(formatCountdown(3_723_000)).toBe('01:02:03');
    expect(formatCountdown(-5)).toBe('00:00:00');
  });
});
