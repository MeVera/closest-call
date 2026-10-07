import { describe, expect, it } from 'vitest';
import { scorePick, scoreRun } from '../src/lib/scoring';
import { shareText } from '../src/lib/share';

describe('scoring', () => {
  it('wrong picks score zero', () => {
    expect(scorePick(false, 0, 1.1).total).toBe(0);
  });
  it('first correct pick is 100 with no streak bonus', () => {
    expect(scorePick(true, 1, 4)).toEqual({ base: 100, streakBonus: 0, closeCallBonus: 0, total: 100 });
  });
  it('streak bonus is 10 per consecutive pick beyond the first, capped at 100', () => {
    expect(scorePick(true, 2, 4).streakBonus).toBe(10);
    expect(scorePick(true, 5, 4).streakBonus).toBe(40);
    expect(scorePick(true, 11, 4).streakBonus).toBe(100);
    expect(scorePick(true, 30, 4).streakBonus).toBe(100);
  });
  it('close-call bonus of 50 below ratio 1.3', () => {
    expect(scorePick(true, 1, 1.29).closeCallBonus).toBe(50);
    expect(scorePick(true, 1, 1.3).closeCallBonus).toBe(0);
  });
  it('a wrong pick resets the streak', () => {
    // 100, 110, 0, 100, 110+50
    expect(
      scoreRun([
        { correct: true, ratio: 4 },
        { correct: true, ratio: 4 },
        { correct: false, ratio: 2 },
        { correct: true, ratio: 2 },
        { correct: true, ratio: 1.2 },
      ]),
    ).toBe(470);
  });
  it('a perfect daily scores 1,000 + 450 streak + 50 close call', () => {
    const picks = [4, 4, 4, 2, 2, 2, 1.5, 1.5, 1.5, 1.2].map((ratio) => ({ correct: true, ratio }));
    expect(scoreRun(picks)).toBe(1500);
  });
});

describe('share text', () => {
  it('matches the brief format', () => {
    const results = [true, true, true, false, true, true, true, true, false, true];
    expect(shareText({ theme: 'music', dateKey: '2026-10-07', results, score: 1240 })).toBe(
      'Closest Call · Music · 7 Oct\n🟩🟩🟩🟥🟩🟩🟩🟩🟥🟩 8/10\n1,240 pts',
    );
  });
  it('pads rounds not reached after losing all lives', () => {
    const text = shareText({ theme: 'history', dateKey: '2026-01-02', results: [true, false, false, false], score: 100 });
    expect(text.split('\n')[1]).toBe('🟩🟥🟥🟥⬜⬜⬜⬜⬜⬜ 1/10');
    expect(text).toContain('History · 2 Jan');
  });
  it('contains no item names (spoiler-free)', () => {
    const text = shareText({ theme: 'sport', dateKey: '2026-10-07', results: [true], score: 100 });
    expect(text).not.toMatch(/Ground|Stadium|Anfield/);
  });
});
