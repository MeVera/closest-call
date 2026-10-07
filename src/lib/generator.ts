import { DAILY_ROUNDS, ENDLESS_MAX_ROUNDS, FAIRNESS, GENERATOR, RATIO_BANDS } from '../config';
import type { Item, Theme } from '../types';
import { haversineKm } from './geo';
import { createRng, shuffled } from './rng';

export interface Band {
  min: number;
  /** Exclusive. Infinity for the open first band. */
  max: number;
}

export interface Round {
  round: number;
  anchor: Item;
  /** Display order (already shuffled). */
  options: [Item, Item];
  distances: [number, number];
  /** Index into `options` of the truly closer option. */
  closer: 0 | 1;
  /** Farther distance divided by closer distance. */
  ratio: number;
}

export class GenerationError extends Error {
  constructor(
    message: string,
    public readonly details: { seed: string; rounds: number; poolSize: number; deepestRound: number; band?: Band },
  ) {
    super(message);
    this.name = 'GenerationError';
  }
}

const round2 = (x: number) => Math.round(x * 100) / 100;

/** Ratio band for a 1-based round number. Rounds past the table use the Endless rule. */
export function bandFor(round: number): Band {
  const fixed = RATIO_BANDS.find((b) => round >= b.fromRound && round <= b.toRound);
  if (fixed) return { min: fixed.min, max: fixed.max };
  const lastFixed = RATIO_BANDS[RATIO_BANDS.length - 1].toRound;
  const min = Math.max(
    FAIRNESS.endlessFloor,
    round2(FAIRNESS.endlessStartLower - FAIRNESS.endlessStepPerRound * (round - lastFixed)),
  );
  return { min, max: FAIRNESS.endlessUpper };
}

/** City key for the Sport same-city rule: the text before the first comma of `place`. */
export function cityOf(item: Item): string {
  return item.place.split(',')[0].trim().toLowerCase();
}

/**
 * Returns null when (anchor, a, b) is a fair round for `round`, otherwise the reason it is not.
 * Used by the generator and by tests/validation to re-check finished chains.
 */
export function checkRound(anchor: Item, a: Item, b: Item, round: number): string | null {
  if (a.id === b.id || a.id === anchor.id || b.id === anchor.id) return 'duplicate item';
  const da = haversineKm(anchor, a);
  const db = haversineKm(anchor, b);
  if (da < FAIRNESS.minOptionDistanceKm || db < FAIRNESS.minOptionDistanceKm)
    return `option closer than ${FAIRNESS.minOptionDistanceKm} km to anchor`;
  if (Math.abs(da - db) < FAIRNESS.minDistanceGapKm) return `distances differ by less than ${FAIRNESS.minDistanceGapKm} km`;
  const ratio = Math.max(da, db) / Math.min(da, db);
  const band = bandFor(round);
  if (ratio < band.min || ratio >= band.max) return `ratio ${ratio.toFixed(3)} outside band ${band.min}–${band.max}`;
  if (anchor.theme === 'sport') {
    const cities = [cityOf(anchor), cityOf(a), cityOf(b)];
    if (new Set(cities).size < 3) return 'two Sport venues from the same city';
  }
  return null;
}

interface Prepared {
  items: Item[];
  dist: Float64Array;
  city: string[];
}

const prepCache = new Map<string, Prepared>();

function prepare(pool: readonly Item[]): Prepared {
  const items = [...pool].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const key = items.map((i) => `${i.id}@${i.lat},${i.lon}`).join('|');
  const cached = prepCache.get(key);
  if (cached) return cached;
  const n = items.length;
  const dist = new Float64Array(n * n);
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      const d = haversineKm(items[i], items[j]);
      dist[i * n + j] = d;
      dist[j * n + i] = d;
    }
  const prepared = { items, dist, city: items.map(cityOf) };
  if (prepCache.size > 16) prepCache.clear();
  prepCache.set(key, prepared);
  return prepared;
}

/**
 * Build a deterministic chain of `rounds` rounds from `pool` using `seed`.
 * Depth-first search with backtracking; if one start item runs out of budget,
 * the chain restarts from the next start item. Rules are never relaxed:
 * if nothing works, a GenerationError is thrown.
 */
export function generateChain(pool: readonly Item[], rounds: number, seed: string): Round[] {
  const { items, dist, city } = prepare(pool);
  const n = items.length;
  const sport = items[0]?.theme === 'sport';
  if (n < rounds * 2 + 1) {
    throw new GenerationError(
      `Pool has ${n} items; ${rounds} rounds need at least ${rounds * 2 + 1} distinct items.`,
      { seed, rounds, poolSize: n, deepestRound: 0 },
    );
  }

  const rng = createRng(seed);
  const used = new Uint8Array(n);
  const path: { anchor: number; near: number; far: number }[] = [];
  let budget = 0;
  let deepest = 0;

  const validPairs = (a: number, round: number): [number, number][] => {
    const band = bandFor(round);
    const cands: number[] = [];
    for (let i = 0; i < n; i++) {
      if (used[i] || dist[a * n + i] < FAIRNESS.minOptionDistanceKm) continue;
      if (sport && city[i] === city[a]) continue;
      cands.push(i);
    }
    cands.sort((x, y) => dist[a * n + x] - dist[a * n + y]);
    const pairs: [number, number][] = [];
    for (let p = 0; p < cands.length; p++) {
      const dn = dist[a * n + cands[p]];
      for (let q = p + 1; q < cands.length; q++) {
        const df = dist[a * n + cands[q]];
        const ratio = df / dn;
        if (ratio >= band.max) break;
        if (ratio < band.min || df - dn < FAIRNESS.minDistanceGapKm) continue;
        if (sport && city[cands[p]] === city[cands[q]]) continue;
        pairs.push([cands[p], cands[q]]);
      }
    }
    return pairs;
  };

  const dfs = (a: number, round: number): boolean => {
    if (round > rounds) return true;
    if (--budget < 0) return false;
    deepest = Math.max(deepest, round);
    const pairs = shuffled(validPairs(a, round), rng).slice(0, GENERATOR.pairsPerRound);
    for (const [near, far] of pairs) {
      used[near] = used[far] = 1;
      path.push({ anchor: a, near, far });
      if (dfs(near, round + 1)) return true;
      path.pop();
      used[near] = used[far] = 0;
      if (budget < 0) return false;
    }
    return false;
  };

  const starts = shuffled(
    Array.from({ length: n }, (_, i) => i),
    rng,
  );
  for (const s of starts) {
    used.fill(0);
    path.length = 0;
    used[s] = 1;
    budget = GENERATOR.nodeBudgetPerStart;
    if (dfs(s, 1)) {
      return path.map((step, idx) => {
        const swap = rng() < 0.5;
        const near = items[step.near];
        const far = items[step.far];
        const dNear = dist[step.anchor * n + step.near];
        const dFar = dist[step.anchor * n + step.far];
        return {
          round: idx + 1,
          anchor: items[step.anchor],
          options: swap ? [far, near] : [near, far],
          distances: swap ? [dFar, dNear] : [dNear, dFar],
          closer: swap ? 1 : 0,
          ratio: dFar / dNear,
        };
      });
    }
  }
  throw new GenerationError(
    `Could not build ${rounds} rounds from ${n} items (seed "${seed}"). Deepest round reached: ${deepest}.`,
    { seed, rounds, poolSize: n, deepestRound: deepest, band: bandFor(Math.min(deepest + 1, rounds)) },
  );
}

export function dailySeed(dateKey: string, theme: Theme): string {
  return `${dateKey}:${theme}`;
}

export function dailyPuzzle(pool: readonly Item[], theme: Theme, dateKey: string): Round[] {
  return generateChain(pool, DAILY_ROUNDS, dailySeed(dateKey, theme));
}

export function endlessRun(pool: readonly Item[], theme: Theme, seed: string): Round[] {
  return generateChain(pool, ENDLESS_MAX_ROUNDS, `endless:${theme}:${seed}`);
}
