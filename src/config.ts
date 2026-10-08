// Every tunable number and name lives here.

export const GAME_NAME = 'Closest Call';

/** First daily puzzle (YYYY-MM-DD, Melbourne date). The archive goes back to here. */
export const LAUNCH_DATE = '2026-10-01';

/** IANA zone that defines the daily rollover (handles AEST/AEDT automatically). */
export const PUZZLE_TIME_ZONE = 'Australia/Melbourne';

export const DAILY_ROUNDS = 10;
export const DAILY_LIVES = 3;

/**
 * Endless runs are generated up front as one fixed chain of this length so that
 * every round is guaranteed to exist. Reaching the end counts as clearing the run.
 */
export const ENDLESS_MAX_ROUNDS = 10;

export const SCORING = {
  correct: 100,
  /** Per consecutive correct pick beyond the first. */
  streakBonusPerPick: 10,
  streakBonusCap: 100,
  closeCallBonus: 50,
  /** Close-call bonus applies when ratio (far / near) is below this. */
  closeCallRatio: 1.3,
} as const;

export const FAIRNESS = {
  minOptionDistanceKm: 10,
  minDistanceGapKm: 25,
  /** Endless rounds after the last fixed band: upper bound stays, lower bound steps down. */
  endlessUpper: 1.3,
  endlessStartLower: 1.15,
  endlessStepPerRound: 0.02,
  endlessFloor: 1.05,
} as const;

/** Ratio bands: min is inclusive, max is exclusive. */
export const RATIO_BANDS: { fromRound: number; toRound: number; min: number; max: number }[] = [
  { fromRound: 1, toRound: 3, min: 3.0, max: Infinity },
  { fromRound: 4, toRound: 6, min: 1.8, max: 3.0 },
  { fromRound: 7, toRound: 9, min: 1.3, max: 1.8 },
  { fromRound: 10, toRound: 10, min: 1.15, max: 1.3 },
];

/** Generator search limits. Raising these trades speed for success on sparse pools. */
export const GENERATOR = {
  /** Max DFS nodes explored from one start item before trying the next start item. */
  nodeBudgetPerStart: 4000,
  /** Max valid pairs tried at each round before backtracking. */
  pairsPerRound: 12,
};

/** Show each History item's year in small type. */
export const SHOW_HISTORY_YEAR = false;

/** Validation: number of consecutive days and Endless runs simulated per theme. */
export const VALIDATION = {
  days: 400,
  endlessRuns: 500,
};

export const THEMES = ['sport', 'music', 'geography', 'history'] as const;
