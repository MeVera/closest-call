import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { DAILY_ROUNDS, SHOW_HISTORY_YEAR } from '../config';
import { poolFor } from '../data';
import { shortDateLabel } from '../lib/dateKey';
import { formatDistance } from '../lib/geo';
import { dailyPuzzle, endlessRun, GenerationError, type Round } from '../lib/generator';
import { gameReducer, newGame, summarize, type GameState, type Mode } from '../lib/game';
import { THEME_LABELS } from '../lib/share';
import { storage } from '../lib/storage';
import type { Item, Theme } from '../types';
import { Coords, ResultMark, UnitToggle } from './Bits';
import { EndScreen } from './EndScreen';
import { ArrowIcon, THEME_ICONS } from './Icons';
import { MapView } from './MapView';
import { NotReady } from './NotReady';
import { Credit, Photo } from './Photo';
import { TopBar } from './TopBar';

interface Props {
  mode: Mode;
  theme: Theme;
  /** Puzzle date (daily/archive). */
  dateKey: string;
  today: string;
  unit: 'km' | 'mi';
  onUnit: (u: 'km' | 'mi') => void;
}

function buildRounds(mode: Mode, theme: Theme, dateKey: string, seed: string): Round[] | GenerationError {
  try {
    const pool = poolFor(theme);
    return mode === 'endless' ? endlessRun(pool, theme, seed) : dailyPuzzle(pool, theme, dateKey);
  } catch (e) {
    if (e instanceof GenerationError) return e;
    throw e;
  }
}

const randomSeed = () => {
  const a = new Uint32Array(2);
  crypto.getRandomValues(a);
  return `${a[0].toString(36)}${a[1].toString(36)}`;
};

export function Game(props: Props) {
  const { mode, theme, dateKey } = props;
  const [seed, setSeed] = useState(randomSeed);
  const rounds = useMemo(() => buildRounds(mode, theme, dateKey, seed), [mode, theme, dateKey, seed]);
  if (rounds instanceof GenerationError) {
    return (
      <>
        <TopBar theme={theme} mode={mode} dateKey={dateKey} />
        <NotReady theme={theme} error={rounds} />
      </>
    );
  }
  return <GameRun key={`${mode}:${theme}:${dateKey}:${seed}`} {...props} rounds={rounds} onRestart={() => setSeed(randomSeed())} />;
}

function GameRun({ mode, theme, dateKey, today, unit, onUnit, rounds, onRestart }: Props & { rounds: Round[]; onRestart: () => void }) {
  const kind = mode === 'archive' ? 'archive' : 'daily';
  const [state, dispatch] = useReducer(gameReducer, undefined, (): GameState => {
    const saved = mode === 'endless' ? null : storage.getRun(kind, dateKey, theme);
    return newGame(mode, theme, rounds, mode === 'endless' ? undefined : dateKey, saved?.picks ?? []);
  });
  const [prevEndlessBest] = useState(() => storage.bestEndless(theme));
  const summary = summarize(state);
  const round = state.rounds[state.index];
  const picked = state.picks[state.index];
  const nextRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  // Persist progress and records.
  useEffect(() => {
    if (mode !== 'endless' && state.picks.length) {
      storage.setRun(kind, dateKey, theme, {
        picks: state.picks,
        finished: summary.finished,
        score: summary.score,
        results: summary.results,
      });
    }
    if (summary.finished && state.phase === 'over') {
      if (mode === 'daily') {
        storage.markDayComplete(dateKey);
        storage.setBestDailyScore(theme, summary.score);
      }
      if (mode === 'endless') storage.setBestEndless(theme, summary.correct);
    }
  }, [state.picks, state.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Focus: the Next button after a reveal, the round heading on a new round.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (state.phase === 'revealed') nextRef.current?.focus({ preventScroll: true });
    if (state.phase === 'choosing') headingRef.current?.focus({ preventScroll: true });
    if (state.phase !== 'revealed') window.scrollTo({ top: 0 });
  }, [state.phase, state.index]);

  // Keyboard: 1 / 2 or Left / Right to pick.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || state.phase !== 'choosing') return;
      if ((e.target as HTMLElement)?.closest?.('input, textarea, select')) return;
      if (e.key === '1' || e.key === 'ArrowLeft') {
        e.preventDefault();
        dispatch({ type: 'pick', choice: 0 });
      } else if (e.key === '2' || e.key === 'ArrowRight') {
        e.preventDefault();
        dispatch({ type: 'pick', choice: 1 });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state.phase]);

  const stats = { lives: summary.lives, streak: summary.streak, score: summary.score };
  const ThemeIcon = THEME_ICONS[theme];
  const roundLabel = mode === 'endless' ? `Round ${state.index + 1}` : `Round ${state.index + 1} of ${DAILY_ROUNDS}`;
  const subtitle =
    mode === 'endless' ? 'Endless' : `${mode === 'archive' ? 'Archive' : 'Daily'} · ${shortDateLabel(dateKey)}`;

  if (state.phase === 'over') {
    return (
      <div className={`screen theme-${theme}`}>
        <TopBar theme={theme} mode={mode} dateKey={dateKey} stats={stats} />
        <EndScreen
          state={state}
          summary={summary}
          today={today}
          prevEndlessBest={prevEndlessBest}
          onRestart={onRestart}
        />
      </div>
    );
  }

  return (
    <div className={`screen theme-${theme}`}>
      <TopBar theme={theme} mode={mode} dateKey={dateKey} stats={stats} />
      <main className="play" id="main">
        <div className="round-meta">
          <span className="theme-chip">
            <ThemeIcon size={16} /> {THEME_LABELS[theme]}
          </span>
          <span>{subtitle}</span>
          <h1 className="round-label" ref={headingRef} tabIndex={-1}>
            {roundLabel}
          </h1>
          <Progress results={summary.results} total={mode === 'endless' ? undefined : DAILY_ROUNDS} current={state.index} />
        </div>

        {state.phase === 'choosing' ? (
          <Choosing round={round} onPick={(choice) => dispatch({ type: 'pick', choice })} />
        ) : (
          <Reveal round={round} picked={picked} unit={unit} onUnit={onUnit} points={summary.points[state.index]} />
        )}
      </main>
      {state.phase === 'revealed' && (
        <div className="next-bar">
          <button ref={nextRef} type="button" className="btn primary big" onClick={() => dispatch({ type: 'next' })}>
            {summary.finished ? 'See results' : 'Next round'} <ArrowIcon size={20} />
          </button>
        </div>
      )}
    </div>
  );
}

function Progress({ results, total, current }: { results: boolean[]; total?: number; current: number }) {
  if (!total) return null;
  return (
    <ol className="progress" aria-label="Rounds">
      {Array.from({ length: total }, (_, i) => {
        const r = results[i];
        const state = r === undefined ? (i === current ? 'current' : 'todo') : r ? 'right' : 'wrong';
        return (
          <li key={i} className={`pip ${state}`}>
            <span className="visually-hidden">
              Round {i + 1}: {state === 'todo' ? 'not played' : state}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function ItemText({ item, showHint }: { item: Item; showHint?: boolean }) {
  return (
    <>
      <span className="item-name">{item.name}</span>
      <span className="item-place">{item.place}</span>
      {showHint && <span className="item-hint">{item.hint}</span>}
      {SHOW_HISTORY_YEAR && item.theme === 'history' && item.year != null && <span className="item-year mono">{item.year}</span>}
      <Coords item={item} />
    </>
  );
}

function Choosing({ round, onPick }: { round: Round; onPick: (c: 0 | 1) => void }) {
  const { anchor, options } = round;
  return (
    <>
      <section className="anchor-card" aria-labelledby="anchor-name">
        <Photo item={anchor} className="anchor-photo" />
        <div className="anchor-body">
          <span className="eyebrow">Anchor</span>
          <h2 id="anchor-name" className="item-name">
            {anchor.name}
          </h2>
          <span className="item-place">{anchor.place}</span>
          <span className="item-hint">{anchor.hint}</span>
          {SHOW_HISTORY_YEAR && anchor.theme === 'history' && anchor.year != null && (
            <span className="item-year mono">{anchor.year}</span>
          )}
          <Coords item={anchor} />
        </div>
        <Credit item={anchor} />
      </section>

      <p className="question">
        Which is closer to <strong>{anchor.name}</strong>?
      </p>

      <div className="options">
        {options.map((o, i) => (
          <div className="option" key={o.id}>
            <button
              type="button"
              className="option-button"
              onClick={() => onPick(i as 0 | 1)}
              aria-keyshortcuts={i === 0 ? '1 ArrowLeft' : '2 ArrowRight'}
            >
              <Photo item={o} className="option-photo" />
              <span className="keycap" aria-hidden="true">
                {i + 1}
              </span>
              <span className="option-body">
                <ItemText item={o} />
              </span>
            </button>
            <Credit item={o} />
          </div>
        ))}
      </div>
      <p className="kbd-hint" aria-hidden="true">
        Tap a card, or press <kbd>1</kbd> / <kbd>2</kbd>
      </p>
    </>
  );
}

function Reveal({
  round,
  picked,
  unit,
  onUnit,
  points,
}: {
  round: Round;
  picked: 0 | 1;
  unit: 'km' | 'mi';
  onUnit: (u: 'km' | 'mi') => void;
  points: number;
}) {
  const { anchor, options, distances, closer, ratio } = round;
  const correct = picked === closer;
  const near = options[closer];
  return (
    <section className="reveal" aria-labelledby="verdict">
      <div className={`verdict ${correct ? 'is-right' : 'is-wrong'}`} role="status">
        <ResultMark correct={correct} size={22} />
        <div>
          <h2 id="verdict">{correct ? 'Correct' : 'Not quite'}</h2>
          <p>
            {near.name} is closer by <span className="mono">{formatDistance(Math.abs(distances[0] - distances[1]), unit)}</span>
            {ratio < 1.3 && <span className="close-call"> · close call</span>}
          </p>
        </div>
        <span className="points mono" aria-label={`${points} points`}>
          +{points}
        </span>
      </div>

      <div className="map-wrap">
        <MapView round={round} unit={unit} picked={picked} />
        <div className="map-tools">
          <UnitToggle unit={unit} onChange={onUnit} />
        </div>
      </div>

      <div className="anchor-strip">
        <Photo item={anchor} className="thumb" />
        <div>
          <span className="eyebrow">Anchor</span>
          <span className="item-name">{anchor.name}</span>
          <Credit item={anchor} />
        </div>
      </div>

      <ul className="results">
        {options.map((o, i) => {
          const isCloser = i === closer;
          return (
            <li key={o.id} className={`result ${isCloser ? 'is-closer' : 'is-farther'}`}>
              <Photo item={o} className="thumb" />
              <div className="result-body">
                <div className="result-head">
                  <ResultMark correct={isCloser} />
                  <span className="item-name">{o.name}</span>
                  {picked === i && <span className="tag">Your pick</span>}
                </div>
                <span className="distance mono">{formatDistance(distances[i], unit)}</span>
                <span className="item-place">{o.place}</span>
                {o.fact && (
                  <p className="fact">
                    {o.fact}{' '}
                    {o.factSource && (
                      <a href={o.factSource} target="_blank" rel="noopener noreferrer">
                        Source
                      </a>
                    )}
                  </p>
                )}
                <Credit item={o} />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
