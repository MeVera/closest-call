import { THEMES } from '../config';
import type { Theme } from '../types';

// Every access is wrapped: private mode, blocked storage or quota errors must never
// break the game. Keys are versioned and independent of GAME_NAME so a rename keeps saves.
const PREFIX = 'cc:v1:';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = globalThis.localStorage?.getItem(PREFIX + key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    globalThis.localStorage?.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage unavailable: play continues without saving */
  }
}

export interface SavedRun {
  picks: (0 | 1)[];
  finished: boolean;
  score: number;
  results: boolean[];
}

const runKey = (kind: 'daily' | 'archive', date: string, theme: Theme) => `${kind}:${date}:${theme}`;

export const storage = {
  getRun: (kind: 'daily' | 'archive', date: string, theme: Theme) => read<SavedRun | null>(runKey(kind, date, theme), null),
  setRun: (kind: 'daily' | 'archive', date: string, theme: Theme, run: SavedRun) => write(runKey(kind, date, theme), run),

  completedDays: () => read<string[]>('completedDays', []),
  markDayComplete(date: string) {
    const days = new Set(this.completedDays());
    if (days.has(date)) return;
    days.add(date);
    write('completedDays', [...days].sort().slice(-1000));
  },

  bestDailyScore: (theme: Theme) => read<Partial<Record<Theme, number>>>('bestDailyScore', {})[theme] ?? 0,
  setBestDailyScore(theme: Theme, score: number) {
    const all = read<Partial<Record<Theme, number>>>('bestDailyScore', {});
    if ((all[theme] ?? 0) >= score) return;
    write('bestDailyScore', { ...all, [theme]: score });
  },

  bestEndless: (theme: Theme) => read<Partial<Record<Theme, number>>>('bestEndless', {})[theme] ?? 0,
  /** Returns true when this is a new best. */
  setBestEndless(theme: Theme, streak: number): boolean {
    const all = read<Partial<Record<Theme, number>>>('bestEndless', {});
    if ((all[theme] ?? 0) >= streak) return false;
    write('bestEndless', { ...all, [theme]: streak });
    return true;
  },

  unit: () => read<'km' | 'mi'>('unit', 'km'),
  setUnit: (u: 'km' | 'mi') => write('unit', u),

  lastTheme: () => {
    const t = read<string>('lastTheme', 'geography');
    return (THEMES as readonly string[]).includes(t) ? (t as Theme) : 'geography';
  },
  setLastTheme: (t: Theme) => write('lastTheme', t),
};
