import { DAILY_ROUNDS, LAUNCH_DATE, THEMES } from '../config';
import { addDays, daysBetween, shortDateLabel } from '../lib/dateKey';
import { THEME_LABELS } from '../lib/share';
import { storage } from '../lib/storage';
import { THEME_ICONS } from './Icons';
import { TopBar } from './TopBar';

const weekday = (key: string) =>
  new Date(`${key}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' });

export function Archive({ today }: { today: string }) {
  const count = Math.max(0, daysBetween(LAUNCH_DATE, today));
  const days = Array.from({ length: count }, (_, i) => addDays(today, -(i + 1)));
  return (
    <div className="screen">
      <TopBar />
      <main className="archive" id="main">
        <h1>Archive</h1>
        <p className="lede">Replay any past daily. Archive games don't count toward your daily streak.</p>
        {days.length === 0 ? (
          <p className="muted">No past puzzles yet. Come back tomorrow.</p>
        ) : (
          <ul className="archive-list">
            {days.map((d) => (
              <li key={d}>
                <span className="archive-date">
                  <span className="muted">{weekday(d)}</span> {shortDateLabel(d)} <span className="muted">{d.slice(0, 4)}</span>
                </span>
                <span className="archive-themes">
                  {THEMES.map((t) => {
                    const Icon = THEME_ICONS[t];
                    const run = storage.getRun('archive', d, t) ?? storage.getRun('daily', d, t);
                    const label = `${THEME_LABELS[t]} for ${shortDateLabel(d)}${
                      run?.finished ? `: ${run.results.filter(Boolean).length} correct` : ''
                    }`;
                    return (
                      <a key={t} href={`#/archive/${d}/${t}`} className={`chip theme-${t}`} aria-label={label} title={label}>
                        <Icon size={16} />
                        {run?.finished && (
                          <span className="chip-score mono">
                            {run.results.filter(Boolean).length}/{DAILY_ROUNDS}
                          </span>
                        )}
                      </a>
                    );
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
