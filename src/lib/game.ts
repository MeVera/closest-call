import { DAILY_LIVES } from '../config';
import type { Theme } from '../types';
import type { Round } from './generator';
import { scorePick } from './scoring';

/** daily = today's puzzle (counts for streaks); archive = a past day (never counts). */
export type Mode = 'daily' | 'archive' | 'endless';

export interface GameState {
  mode: Mode;
  theme: Theme;
  /** Puzzle date for daily/archive. */
  dateKey?: string;
  rounds: Round[];
  /** Index of the current round. */
  index: number;
  /** Option index (0 or 1) chosen in each round so far. */
  picks: (0 | 1)[];
  phase: 'choosing' | 'revealed' | 'over';
}

export type GameAction = { type: 'pick'; choice: 0 | 1 } | { type: 'next' };

export interface Summary {
  results: boolean[];
  correct: number;
  wrong: number;
  /** Lives left (daily/archive only; Infinity in Endless). */
  lives: number;
  /** Current run of consecutive correct picks. */
  streak: number;
  score: number;
  /** Per-round points, aligned with results. */
  points: number[];
  finished: boolean;
}

export function summarize(state: Pick<GameState, 'mode' | 'rounds' | 'picks'>): Summary {
  const { mode, rounds, picks } = state;
  const results = picks.map((p, i) => p === rounds[i].closer);
  let streak = 0;
  let score = 0;
  const points: number[] = [];
  for (let i = 0; i < results.length; i++) {
    streak = results[i] ? streak + 1 : 0;
    const pts = scorePick(results[i], streak, rounds[i].ratio).total;
    points.push(pts);
    score += pts;
  }
  const wrong = results.filter((r) => !r).length;
  const correct = results.length - wrong;
  const lives = mode === 'endless' ? Infinity : Math.max(0, DAILY_LIVES - wrong);
  const finished =
    picks.length >= rounds.length || (mode === 'endless' ? wrong >= 1 : wrong >= DAILY_LIVES);
  return { results, correct, wrong, lives, streak, score, points, finished };
}

export function newGame(mode: Mode, theme: Theme, rounds: Round[], dateKey?: string, picks: (0 | 1)[] = []): GameState {
  const base: GameState = { mode, theme, dateKey, rounds, index: 0, picks: [], phase: 'choosing' };
  return restore(base, picks);
}

/** Rebuild a game from saved picks. A finished game opens on its end screen. */
export function restore(state: GameState, picks: (0 | 1)[]): GameState {
  const valid = picks.slice(0, state.rounds.length).filter((p) => p === 0 || p === 1);
  const s = { ...state, picks: valid };
  if (summarize(s).finished && valid.length > 0) return { ...s, index: valid.length - 1, phase: 'over' };
  return { ...s, index: valid.length, phase: 'choosing' };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'pick':
      if (state.phase !== 'choosing') return state;
      return { ...state, picks: [...state.picks, action.choice], phase: 'revealed' };
    case 'next':
      if (state.phase !== 'revealed') return state;
      if (summarize(state).finished) return { ...state, phase: 'over' };
      return { ...state, index: state.index + 1, phase: 'choosing' };
  }
}
