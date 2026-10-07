import { DAILY_ROUNDS, GAME_NAME } from '../config';
import type { Theme } from '../types';
import { shortDateLabel } from './dateKey';

export const THEME_LABELS: Record<Theme, string> = {
  sport: 'Sport',
  music: 'Music',
  geography: 'Geography',
  history: 'History',
};

/**
 * Spoiler-free share text. One square per round: green right, red wrong,
 * white for rounds not reached because the run ended early on lives.
 */
export function shareText(opts: { theme: Theme; dateKey: string; results: boolean[]; score: number }): string {
  const { theme, dateKey, results, score } = opts;
  const squares = Array.from({ length: DAILY_ROUNDS }, (_, i) =>
    i < results.length ? (results[i] ? '🟩' : '🟥') : '⬜',
  ).join('');
  const right = results.filter(Boolean).length;
  return [
    `${GAME_NAME} · ${THEME_LABELS[theme]} · ${shortDateLabel(dateKey)}`,
    `${squares} ${right}/${DAILY_ROUNDS}`,
    `${score.toLocaleString('en-AU')} pts`,
  ].join('\n');
}
