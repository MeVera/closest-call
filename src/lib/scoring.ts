import { SCORING } from '../config';

export interface RoundScore {
  base: number;
  streakBonus: number;
  closeCallBonus: number;
  total: number;
}

/**
 * Score one pick. `streak` is the number of consecutive correct picks
 * including this one (so the first correct pick in a row has streak 1).
 */
export function scorePick(correct: boolean, streak: number, ratio: number): RoundScore {
  if (!correct) return { base: 0, streakBonus: 0, closeCallBonus: 0, total: 0 };
  const base = SCORING.correct;
  const streakBonus = Math.min(SCORING.streakBonusCap, SCORING.streakBonusPerPick * Math.max(0, streak - 1));
  const closeCallBonus = ratio < SCORING.closeCallRatio ? SCORING.closeCallBonus : 0;
  return { base, streakBonus, closeCallBonus, total: base + streakBonus + closeCallBonus };
}

/** Total for a sequence of picks. */
export function scoreRun(picks: { correct: boolean; ratio: number }[]): number {
  let streak = 0;
  let total = 0;
  for (const p of picks) {
    streak = p.correct ? streak + 1 : 0;
    total += scorePick(p.correct, streak, p.ratio).total;
  }
  return total;
}
