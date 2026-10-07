import { useEffect, useState } from 'react';
import { dateKeyFor, nextResetAt } from './lib/dateKey';

/** Today's puzzle date; re-renders when Melbourne midnight passes. */
export function useToday(): string {
  const [today, setToday] = useState(() => dateKeyFor(new Date()));
  useEffect(() => {
    const ms = nextResetAt(new Date()).getTime() - Date.now() + 500;
    const t = setTimeout(() => setToday(dateKeyFor(new Date())), Math.min(ms, 2 ** 31 - 1));
    return () => clearTimeout(t);
  }, [today]);
  return today;
}

/** Current time, ticking every `ms`. */
export function useNow(ms = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export function useHashRoute(): string[] {
  const parse = () => {
    const hash = location.hash.replace(/^#\/?/, '');
    if (!hash && /\/credits\/?$/.test(location.pathname)) return ['credits'];
    return hash.split('/').filter(Boolean).map(decodeURIComponent);
  };
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const on = () => {
      setRoute(parse());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function prefersReducedMotion(): boolean {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
