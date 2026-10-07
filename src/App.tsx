import { useEffect, useState } from 'react';
import { GAME_NAME, LAUNCH_DATE, THEMES } from './config';
import { Archive } from './components/Archive';
import { Credits } from './components/Credits';
import { Game } from './components/Game';
import { Home } from './components/Home';
import { DEMO_MODE } from './data';
import { useHashRoute, useToday } from './hooks';
import type { Mode } from './lib/game';
import { THEME_LABELS } from './lib/share';
import { storage } from './lib/storage';
import type { Theme } from './types';

const isTheme = (t: string | undefined): t is Theme => !!t && (THEMES as readonly string[]).includes(t);
const isDateKey = (d: string | undefined): d is string => !!d && /^\d{4}-\d{2}-\d{2}$/.test(d);

export function App() {
  const route = useHashRoute();
  const today = useToday();
  const [unit, setUnit] = useState(storage.unit);
  const onUnit = (u: 'km' | 'mi') => {
    setUnit(u);
    storage.setUnit(u);
  };

  const [section, a, b] = route;
  let page: JSX.Element;
  let title = GAME_NAME;

  if ((section === 'daily' || section === 'endless') && isTheme(a)) {
    storage.setLastTheme(a);
    title = `${THEME_LABELS[a]} ${section === 'daily' ? 'Daily' : 'Endless'} · ${GAME_NAME}`;
    page = <PlayRoute key={route.join('/')} mode={section} theme={a} today={today} unit={unit} onUnit={onUnit} />;
  } else if (section === 'archive' && isDateKey(a) && isTheme(b) && a >= LAUNCH_DATE && a < today) {
    title = `${THEME_LABELS[b]} · ${a} · ${GAME_NAME}`;
    page = <Game key={route.join('/')} mode="archive" theme={b} dateKey={a} today={today} unit={unit} onUnit={onUnit} />;
  } else if (section === 'archive') {
    title = `Archive · ${GAME_NAME}`;
    page = <Archive today={today} />;
  } else if (section === 'credits') {
    title = `Credits · ${GAME_NAME}`;
    page = <Credits />;
  } else {
    page = <Home today={today} />;
  }

  useEffect(() => {
    document.title = title;
  }, [title]);

  return (
    <>
      {DEMO_MODE && (
        <div className="demo-banner" role="note">
          Demo data: synthetic filler points pad each theme (dev server only)
        </div>
      )}
      {page}
    </>
  );
}

/** Captures the puzzle date when a daily starts, so a run that crosses midnight keeps its puzzle. */
function PlayRoute(props: { mode: Exclude<Mode, 'archive'>; theme: Theme; today: string; unit: 'km' | 'mi'; onUnit: (u: 'km' | 'mi') => void }) {
  const [dateKey] = useState(props.today);
  return <Game {...props} dateKey={dateKey} />;
}
