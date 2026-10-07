import sport from '../data/sport.json';
import music from '../data/music.json';
import geography from '../data/geography.json';
import history from '../data/history.json';
import creditsJson from '../data/photo-credits.json';
import { DAILY_ROUNDS } from './config';
import { syntheticPool } from './lib/demo';
import type { Item, PhotoCredit, Theme } from './types';

const REAL: Record<Theme, Item[]> = {
  sport: sport as Item[],
  music: music as Item[],
  geography: geography as Item[],
  history: history as Item[],
};

export const CREDITS = creditsJson as Record<string, PhotoCredit>;

/**
 * Dev-only demo mode (`?demo` on the dev server): pads each theme with synthetic
 * filler points so the game is playable before the full data set exists.
 * `import.meta.env.DEV` is false in production builds, so this never ships.
 */
export const DEMO_MODE =
  import.meta.env.DEV && typeof location !== 'undefined' && new URLSearchParams(location.search).has('demo');

export function poolFor(theme: Theme): Item[] {
  const real = REAL[theme];
  if (!DEMO_MODE) return real;
  return [...real, ...syntheticPool(theme, 45, `demo-${theme}`)];
}

export function realItems(theme: Theme): Item[] {
  return REAL[theme];
}

export function isPlayable(theme: Theme): boolean {
  return poolFor(theme).length >= DAILY_ROUNDS * 2 + 1;
}

export function photoUrl(id: string): string | null {
  return CREDITS[id] ? `${import.meta.env.BASE_URL}photos/${id}.webp` : null;
}
