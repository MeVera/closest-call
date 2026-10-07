import { afterEach, describe, expect, it, vi } from 'vitest';
import { DAILY_LIVES, DAILY_ROUNDS, ENDLESS_MAX_ROUNDS } from '../src/config';
import { dailyPuzzle, endlessRun } from '../src/lib/generator';
import { gameReducer, newGame, summarize, type GameState } from '../src/lib/game';
import { storage } from '../src/lib/storage';
import { dailyStreak } from '../src/lib/streak';
import { syntheticPool } from './helpers';

const pool = syntheticPool('geography');
const daily = () => newGame('daily', 'geography', dailyPuzzle(pool, 'geography', '2026-10-07'), '2026-10-07');

function play(state: GameState, correct: boolean[]): GameState {
  for (const c of correct) {
    const r = state.rounds[state.index];
    state = gameReducer(state, { type: 'pick', choice: (c ? r.closer : 1 - r.closer) as 0 | 1 });
    state = gameReducer(state, { type: 'next' });
  }
  return state;
}

describe('game flow', () => {
  it('a perfect daily ends after round 10', () => {
    const s = play(daily(), Array(DAILY_ROUNDS).fill(true));
    expect(s.phase).toBe('over');
    expect(summarize(s)).toMatchObject({ correct: 10, lives: DAILY_LIVES, finished: true, score: 1450 + (s.rounds[9].ratio < 1.3 ? 50 : 0) });
  });

  it('a daily ends when the third life is lost', () => {
    const s = play(daily(), [true, false, false, true, false]);
    expect(s.phase).toBe('over');
    expect(s.picks).toHaveLength(5);
    expect(summarize(s).lives).toBe(0);
  });

  it('a wrong pick still moves on from the true closer option', () => {
    let s = daily();
    const r1 = s.rounds[0];
    s = gameReducer(s, { type: 'pick', choice: (1 - r1.closer) as 0 | 1 });
    s = gameReducer(s, { type: 'next' });
    expect(s.rounds[s.index].anchor.id).toBe(r1.options[r1.closer].id);
    expect(s.phase).toBe('choosing');
  });

  it('ignores picks during a reveal and Next during choosing', () => {
    let s = daily();
    const same = gameReducer(s, { type: 'next' });
    expect(same).toBe(s);
    s = gameReducer(s, { type: 'pick', choice: 0 });
    expect(gameReducer(s, { type: 'pick', choice: 1 })).toBe(s);
  });

  it('Endless ends at the first wrong pick', () => {
    const s0 = newGame('endless', 'geography', endlessRun(pool, 'geography', 'x'));
    const s = play(s0, [true, true, true, false]);
    expect(s.phase).toBe('over');
    expect(summarize(s)).toMatchObject({ correct: 3, lives: Infinity });
  });

  it('Endless ends as cleared after the last round', () => {
    const s = play(newGame('endless', 'geography', endlessRun(pool, 'geography', 'y')), Array(ENDLESS_MAX_ROUNDS).fill(true));
    expect(s.phase).toBe('over');
    expect(summarize(s).correct).toBe(ENDLESS_MAX_ROUNDS);
  });

  it('restores saved picks: unfinished resumes at the next round, finished opens the end screen', () => {
    const rounds = dailyPuzzle(pool, 'geography', '2026-10-07');
    const finished = play(daily(), [true, true, true]);
    const resumed = newGame('daily', 'geography', rounds, '2026-10-07', finished.picks);
    expect(resumed).toMatchObject({ index: 3, phase: 'choosing' });
    const done = play(daily(), Array(DAILY_ROUNDS).fill(true));
    expect(newGame('daily', 'geography', rounds, '2026-10-07', done.picks).phase).toBe('over');
  });
});

describe('daily streak', () => {
  it('counts consecutive days ending today or yesterday', () => {
    expect(dailyStreak([], '2026-10-07')).toBe(0);
    expect(dailyStreak(['2026-10-07'], '2026-10-07')).toBe(1);
    expect(dailyStreak(['2026-10-05', '2026-10-06'], '2026-10-07')).toBe(2);
    expect(dailyStreak(['2026-10-04', '2026-10-06', '2026-10-07'], '2026-10-07')).toBe(2);
    expect(dailyStreak(['2026-10-05'], '2026-10-07')).toBe(0);
    expect(dailyStreak(['2026-12-31', '2027-01-01'], '2027-01-01')).toBe(2);
  });
});

describe('storage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('falls back silently when localStorage throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    });
    expect(storage.completedDays()).toEqual([]);
    expect(() => storage.markDayComplete('2026-10-07')).not.toThrow();
    expect(storage.unit()).toBe('km');
    expect(storage.setBestEndless('music', 5)).toBe(true);
  });

  it('records best scores and completed days', () => {
    const mem = new Map<string, string>();
    vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => mem.set(k, v) });
    storage.markDayComplete('2026-10-07');
    storage.markDayComplete('2026-10-07');
    expect(storage.completedDays()).toEqual(['2026-10-07']);
    expect(storage.setBestEndless('music', 5)).toBe(true);
    expect(storage.setBestEndless('music', 3)).toBe(false);
    expect(storage.bestEndless('music')).toBe(5);
  });
});
