import { DAILY_ROUNDS, ENDLESS_MAX_ROUNDS, THEMES } from '../config';
import { shortDateLabel } from '../lib/dateKey';
import type { GameState, Summary } from '../lib/game';
import { shareText, THEME_LABELS } from '../lib/share';
import { storage } from '../lib/storage';
import { dailyStreak } from '../lib/streak';
import { Countdown, ResultMark, ShareButtons } from './Bits';
import { THEME_ICONS } from './Icons';

interface Props {
  state: GameState;
  summary: Summary;
  today: string;
  prevEndlessBest: number;
  onRestart: () => void;
}

export function EndScreen({ state, summary, today, prevEndlessBest, onRestart }: Props) {
  const { mode, theme, dateKey, rounds, picks } = state;
  const Icon = THEME_ICONS[theme];

  return (
    <main className="end" id="main">
      <section className="end-hero">
        <span className="theme-chip">
          <Icon size={16} /> {THEME_LABELS[theme]}
        </span>
        {mode === 'endless' ? (
          <EndlessHero summary={summary} prevBest={prevEndlessBest} cleared={summary.correct >= ENDLESS_MAX_ROUNDS} />
        ) : (
          <DailyHero summary={summary} mode={mode} dateKey={dateKey!} today={today} />
        )}
      </section>

      {mode !== 'endless' && (
        <section className="end-card" aria-labelledby="share-h">
          <h2 id="share-h">Share your result</h2>
          <ShareButtons text={shareText({ theme, dateKey: dateKey!, results: summary.results, score: summary.score })} />
        </section>
      )}

      <section className="end-card" aria-labelledby="recap-h">
        <h2 id="recap-h">Your rounds</h2>
        <ol className="recap">
          {picks.map((p, i) => {
            const r = rounds[i];
            const right = p === r.closer;
            return (
              <li key={i}>
                <ResultMark correct={right} />
                <span className="recap-text">
                  <span className="muted">{r.anchor.name} →</span> {r.options[r.closer].name}
                  {!right && <span className="muted"> (you chose {r.options[p].name})</span>}
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      <section className="end-card end-next">
        {mode === 'endless' ? (
          <button type="button" className="btn primary big" onClick={onRestart}>
            Play again
          </button>
        ) : (
          <>
            <Countdown />
            <OtherThemes today={today} current={theme} />
          </>
        )}
        <p className="end-links">
          <a href="#/archive">Archive</a>
          {mode !== 'endless' && <a href={`#/endless/${theme}`}>Play Endless</a>}
          <a href="#/">Home</a>
        </p>
      </section>
    </main>
  );
}

function DailyHero({ summary, mode, dateKey, today }: { summary: Summary; mode: GameState['mode']; dateKey: string; today: string }) {
  const streak = mode === 'daily' ? dailyStreak([...storage.completedDays(), dateKey], today) : null;
  return (
    <>
      <p className="eyebrow">
        {mode === 'archive' ? 'Archive' : 'Daily'} · {shortDateLabel(dateKey)}
      </p>
      <h1 className="big-score">
        <span className="mono">{summary.score.toLocaleString('en-AU')}</span> <small>pts</small>
      </h1>
      <p className="end-sub">
        {summary.correct}/{DAILY_ROUNDS} correct
        {summary.lives === 0 && summary.results.length < DAILY_ROUNDS && ' · out of lives'}
      </p>
      <ol className="grid-squares" aria-label="Results by round">
        {Array.from({ length: DAILY_ROUNDS }, (_, i) => {
          const r = summary.results[i];
          return (
            <li key={i} className={r === undefined ? 'sq todo' : r ? 'sq right' : 'sq wrong'}>
              {r === undefined ? <span className="visually-hidden">not played</span> : <ResultMark correct={r} size={14} />}
            </li>
          );
        })}
      </ol>
      {streak != null ? (
        <p className="end-sub">
          Daily streak: <strong className="mono">{streak}</strong> {streak === 1 ? 'day' : 'days'}
        </p>
      ) : (
        <p className="end-sub muted">Archive games don't count toward your daily streak.</p>
      )}
    </>
  );
}

function EndlessHero({ summary, prevBest, cleared }: { summary: Summary; prevBest: number; cleared: boolean }) {
  const best = Math.max(prevBest, summary.correct);
  return (
    <>
      <p className="eyebrow">Endless</p>
      <h1 className="big-score">
        <span className="mono">{summary.correct}</span> <small>in a row</small>
      </h1>
      <p className="end-sub">
        {cleared ? `You cleared all ${ENDLESS_MAX_ROUNDS} rounds!` : summary.correct > prevBest ? 'New best streak!' : `Best: ${best}`}
        {' · '}
        <span className="mono">{summary.score.toLocaleString('en-AU')}</span> pts
      </p>
    </>
  );
}

function OtherThemes({ today, current }: { today: string; current: string }) {
  const others = THEMES.filter((t) => t !== current);
  return (
    <div className="other-themes">
      <p className="muted">Today's other dailies</p>
      <div className="other-theme-row">
        {others.map((t) => {
          const run = storage.getRun('daily', today, t);
          const Icon = THEME_ICONS[t];
          return (
            <a key={t} href={`#/daily/${t}`} className={`chip theme-${t}`}>
              <Icon size={16} /> {THEME_LABELS[t]}
              {run?.finished && <span className="chip-done"> · done</span>}
            </a>
          );
        })}
      </div>
    </div>
  );
}
