import { DAILY_LIVES, DAILY_ROUNDS, GAME_NAME, SCORING, THEMES } from '../config';
import { isPlayable } from '../data';
import { shortDateLabel } from '../lib/dateKey';
import { THEME_LABELS } from '../lib/share';
import { storage } from '../lib/storage';
import { dailyStreak } from '../lib/streak';
import type { Theme } from '../types';
import { Countdown } from './Bits';
import { ArrowIcon, FlameIcon, THEME_ICONS } from './Icons';
import { TopBar } from './TopBar';

const BLURB: Record<Theme, string> = {
  sport: 'Grounds, arenas, circuits and courses',
  music: 'Studios, venues, festivals and hometowns',
  geography: 'World-famous landmarks and capitals',
  history: 'Events, pinned to where they happened',
};

export function Home({ today }: { today: string }) {
  const streak = dailyStreak(storage.completedDays(), today);
  return (
    <div className="screen">
      <TopBar />
      <main className="home" id="main">
        <section className="hero">
          <p className="eyebrow">Daily · {shortDateLabel(today)}</p>
          <h1>
            Which is <em>closer</em>?
          </h1>
          <p className="lede">
            One anchor, two places. Pick the one nearer in a straight line over the Earth. The right answer becomes
            the next anchor.
          </p>
          <div className="hero-meta">
            <span className="streak-pill">
              <FlameIcon size={16} /> <span className="mono">{streak}</span> day streak
            </span>
            <Countdown />
          </div>
        </section>

        <section className="theme-grid" aria-label="Themes">
          {THEMES.map((t) => {
            const Icon = THEME_ICONS[t];
            const run = storage.getRun('daily', today, t);
            const best = storage.bestEndless(t);
            const playable = isPlayable(t);
            const status = run?.finished
              ? `Done · ${run.results.filter(Boolean).length}/${DAILY_ROUNDS} · ${run.score.toLocaleString('en-AU')} pts`
              : run?.picks.length
                ? `In progress · round ${run.picks.length + 1}`
                : 'Not played yet';
            return (
              <article key={t} className={`theme-card theme-${t}`}>
                <header>
                  <span className="theme-icon">
                    <Icon size={26} />
                  </span>
                  <div>
                    <h2>{THEME_LABELS[t]}</h2>
                    <p>{BLURB[t]}</p>
                  </div>
                </header>
                <a className="btn primary" href={`#/daily/${t}`} aria-label={`${THEME_LABELS[t]} daily: ${status}`}>
                  <span>{run?.finished ? 'View daily' : run?.picks.length ? 'Continue daily' : 'Play daily'}</span>
                  <ArrowIcon size={18} />
                </a>
                <p className="theme-status">{playable ? status : 'Coming soon'}</p>
                <a className="btn ghost" href={`#/endless/${t}`}>
                  Endless{best > 0 && <span className="muted"> · best {best}</span>}
                </a>
              </article>
            );
          })}
        </section>

        <section className="rules" aria-labelledby="rules-h">
          <h2 id="rules-h">How to play</h2>
          <ul>
            <li>
              <strong>Daily:</strong> {DAILY_ROUNDS} rounds, {DAILY_LIVES} lives, the same puzzle for everyone. It resets at
              midnight Melbourne time.
            </li>
            <li>
              <strong>Endless:</strong> keep going until your first wrong pick.
            </li>
            <li>
              Distances are great-circle (as the crow flies). Rounds get closer and harder as you go.
            </li>
            <li>
              {SCORING.correct} points per correct pick, +{SCORING.streakBonusPerPick} for each pick in a row (up to +
              {SCORING.streakBonusCap}), and +{SCORING.closeCallBonus} for a close call.
            </li>
          </ul>
          <p className="home-links">
            <a href="#/archive">Archive</a>
            <a href="#/credits">Photo credits</a>
          </p>
        </section>
      </main>
      <footer className="site-footer">
        <p>
          {GAME_NAME} · photos from Wikimedia Commons · map data from Natural Earth · no accounts, no tracking
        </p>
      </footer>
    </div>
  );
}
