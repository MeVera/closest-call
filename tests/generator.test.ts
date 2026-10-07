import { describe, expect, it } from 'vitest';
import { DAILY_ROUNDS, ENDLESS_MAX_ROUNDS, LAUNCH_DATE, THEMES } from '../src/config';
import { addDays } from '../src/lib/dateKey';
import { bandFor, checkRound, dailyPuzzle, endlessRun, GenerationError, type Round } from '../src/lib/generator';
import { loadAll } from '../scripts/lib';
import type { Item } from '../src/types';
import { syntheticPool } from './helpers';

const signature = (rounds: Round[]) => rounds.map((r) => `${r.anchor.id}>${r.options.map((o) => o.id).join('|')}`).join(' ');

function assertChain(rounds: Round[], expected: number) {
  expect(rounds).toHaveLength(expected);
  const ids = new Set([rounds[0].anchor.id]);
  rounds.forEach((r, i) => {
    expect(r.round).toBe(i + 1);
    expect(checkRound(r.anchor, r.options[0], r.options[1], r.round)).toBeNull();
    const [d0, d1] = r.distances;
    expect(r.closer).toBe(d0 < d1 ? 0 : 1);
    for (const o of r.options) {
      expect(ids.has(o.id), `${o.id} repeats`).toBe(false);
      ids.add(o.id);
    }
    if (i + 1 < rounds.length) expect(rounds[i + 1].anchor.id).toBe(r.options[r.closer].id);
  });
}

describe('ratio bands', () => {
  it('match the brief', () => {
    expect(bandFor(1)).toEqual({ min: 3, max: Infinity });
    expect(bandFor(3)).toEqual({ min: 3, max: Infinity });
    expect(bandFor(4)).toEqual({ min: 1.8, max: 3 });
    expect(bandFor(7)).toEqual({ min: 1.3, max: 1.8 });
    expect(bandFor(10)).toEqual({ min: 1.15, max: 1.3 });
  });
  it('Endless lowers the floor by 0.02 per round down to 1.05', () => {
    expect(bandFor(11)).toEqual({ min: 1.13, max: 1.3 });
    expect(bandFor(14)).toEqual({ min: 1.07, max: 1.3 });
    expect(bandFor(15)).toEqual({ min: 1.05, max: 1.3 });
    expect(bandFor(40)).toEqual({ min: 1.05, max: 1.3 });
  });
});

describe('checkRound on the brief fixtures', () => {
  const byId = new Map<string, Item>(Object.values(loadAll()).flat().map((i) => [i.id, i]));
  const g = (id: string) => byId.get(id)!;
  it('MCG round is valid in rounds 1–3 (ratio ~3.68)', () => {
    expect(checkRound(g('melbourne-cricket-ground'), g('sydney-cricket-ground'), g('eden-park'), 1)).toBeNull();
    expect(checkRound(g('melbourne-cricket-ground'), g('sydney-cricket-ground'), g('eden-park'), 5)).toMatch(/ratio/);
  });
  it('Old Trafford round breaks the 25 km gap rule (44 vs 61 km)', () => {
    expect(checkRound(g('old-trafford'), g('anfield'), g('headingley'), 8)).toMatch(/less than 25 km/);
  });
  it('Bastille round (ratio 1.06) is never allowed: the 15 km gap is under 25 km', () => {
    for (const r of [10, 14, 15, 20])
      expect(checkRound(g('storming-of-the-bastille'), g('battle-of-waterloo'), g('battle-of-hastings'), r)).not.toBeNull();
  });
});

describe('generator', () => {
  const pools = Object.fromEntries(THEMES.map((t) => [t, syntheticPool(t)])) as Record<(typeof THEMES)[number], Item[]>;

  it('is deterministic for a date and theme', () => {
    const a = dailyPuzzle(pools.music, 'music', '2026-10-07');
    const b = dailyPuzzle([...pools.music].reverse(), 'music', '2026-10-07');
    expect(signature(a)).toBe(signature(b));
  });

  it('differs across dates and themes', () => {
    const days = Array.from({ length: 30 }, (_, i) => signature(dailyPuzzle(pools.music, 'music', addDays('2026-10-07', i))));
    expect(new Set(days).size).toBe(30);
    expect(signature(dailyPuzzle(pools.sport, 'sport', '2026-10-07'))).not.toBe(
      signature(dailyPuzzle(pools.music, 'music', '2026-10-07')).replaceAll('music', 'sport'),
    );
  });

  for (const theme of THEMES) {
    it(`all constraints hold across 400 days: ${theme}`, () => {
      for (let d = 0; d < 400; d++) assertChain(dailyPuzzle(pools[theme], theme, addDays(LAUNCH_DATE, d)), DAILY_ROUNDS);
    });
  }

  it('Endless runs hold all constraints and never repeat items', () => {
    for (let i = 0; i < 25; i++) assertChain(endlessRun(pools.history, 'history', `t${i}`), ENDLESS_MAX_ROUNDS);
  });

  it('enforces the Sport same-city rule', () => {
    const pool = syntheticPool('sport').map((it, i) => ({ ...it, place: `City${i % 5}, Testland` }));
    try {
      for (let d = 0; d < 20; d++) {
        for (const r of dailyPuzzle(pool, 'sport', addDays(LAUNCH_DATE, d))) {
          const cities = [r.anchor, ...r.options].map((x) => x.place);
          expect(new Set(cities).size).toBe(3);
        }
      }
    } catch (e) {
      // Five cities can be too few for ten rounds; failing loudly is also acceptable, relaxing is not.
      expect(e).toBeInstanceOf(GenerationError);
    }
  });

  it('fails loudly instead of relaxing rules when the pool is too small', () => {
    expect(() => dailyPuzzle(pools.music.slice(0, 6), 'music', '2026-10-07')).toThrow(GenerationError);
    // A large pool where every point sits in one tiny area cannot meet the 10 km rule.
    const clumped = pools.music.map((it, i) => ({ ...it, lat: 10 + i * 1e-5, lon: 10 }));
    expect(() => dailyPuzzle(clumped, 'music', '2026-10-07')).toThrow(GenerationError);
  });
});

describe('real data', () => {
  const all = loadAll();
  for (const theme of THEMES) {
    const pool = all[theme];
    it.skipIf(pool.length < DAILY_ROUNDS * 2 + 1)(`${theme}: 400 days generate (pool ${pool.length})`, () => {
      for (let d = 0; d < 400; d++) assertChain(dailyPuzzle(pool, theme, addDays(LAUNCH_DATE, d)), DAILY_ROUNDS);
    });
  }
});
