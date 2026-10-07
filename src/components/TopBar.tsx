import { DAILY_LIVES, GAME_NAME, THEMES } from '../config';
import type { Mode } from '../lib/game';
import { THEME_LABELS } from '../lib/share';
import type { Theme } from '../types';
import { FlameIcon, HeartIcon, LogoMark, THEME_ICONS } from './Icons';

interface Props {
  theme?: Theme;
  mode?: Mode;
  dateKey?: string;
  stats?: { lives: number; streak: number; score: number };
}

export function themeHref(mode: Mode, theme: Theme, dateKey?: string): string {
  if (mode === 'archive' && dateKey) return `#/archive/${dateKey}/${theme}`;
  return `#/${mode === 'endless' ? 'endless' : 'daily'}/${theme}`;
}

export function TopBar({ theme, mode, dateKey, stats }: Props) {
  return (
    <header className="topbar">
      <div className="topbar-row">
        <a href="#/" className="brand" aria-label={`${GAME_NAME} home`}>
          <LogoMark size={22} />
          <span>{GAME_NAME}</span>
        </a>
        {stats && (
          <dl className="stats" aria-label="Run status">
            {mode !== 'endless' && (
              <div className="stat lives" title={`${stats.lives} of ${DAILY_LIVES} lives left`}>
                <dt className="visually-hidden">Lives</dt>
                <dd>
                  <span aria-hidden="true" className="hearts">
                    {Array.from({ length: DAILY_LIVES }, (_, i) => (
                      <HeartIcon key={i} size={16} filled={i < stats.lives} className={i < stats.lives ? 'full' : 'empty'} />
                    ))}
                  </span>
                  <span className="visually-hidden">
                    {stats.lives} of {DAILY_LIVES}
                  </span>
                </dd>
              </div>
            )}
            <div className="stat" title="Correct picks in a row">
              <dt className="visually-hidden">Streak</dt>
              <dd>
                <FlameIcon size={16} />
                <span className="mono">{stats.streak}</span>
              </dd>
            </div>
            <div className="stat score">
              <dt className="visually-hidden">Score</dt>
              <dd>
                <span className="mono">{stats.score.toLocaleString('en-AU')}</span>
                <small aria-hidden="true">pts</small>
                <span className="visually-hidden">points</span>
              </dd>
            </div>
          </dl>
        )}
      </div>
      {theme && mode && (
        <div className="topbar-row controls">
          <nav className="theme-tabs" aria-label="Theme">
            {THEMES.map((t) => {
              const Icon = THEME_ICONS[t];
              return (
                <a
                  key={t}
                  href={themeHref(mode, t, dateKey)}
                  className={`theme-tab theme-${t}`}
                  aria-current={t === theme ? 'page' : undefined}
                  title={THEME_LABELS[t]}
                >
                  <Icon size={18} />
                  <span className="theme-tab-label">{THEME_LABELS[t]}</span>
                </a>
              );
            })}
          </nav>
          {mode === 'archive' ? (
            <span className="mode-pill">Archive</span>
          ) : (
            <nav className="segmented" aria-label="Mode">
              <a href={themeHref('daily', theme)} aria-current={mode === 'daily' ? 'page' : undefined}>
                Daily
              </a>
              <a href={themeHref('endless', theme)} aria-current={mode === 'endless' ? 'page' : undefined}>
                Endless
              </a>
            </nav>
          )}
        </div>
      )}
    </header>
  );
}
