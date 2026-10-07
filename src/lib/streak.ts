import { addDays } from './dateKey';

/**
 * Daily streak: consecutive days with at least one daily theme completed.
 * A streak is still alive if today is not done yet but yesterday was.
 */
export function dailyStreak(completedDays: Iterable<string>, today: string): number {
  const done = new Set(completedDays);
  let day = done.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (done.has(day)) {
    n++;
    day = addDays(day, -1);
  }
  return n;
}
