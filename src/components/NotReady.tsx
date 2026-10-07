import type { GenerationError } from '../lib/generator';
import { THEME_LABELS } from '../lib/share';
import type { Theme } from '../types';

export function NotReady({ theme, error }: { theme: Theme; error: GenerationError }) {
  const { poolSize, rounds } = error.details;
  return (
    <main className="end" id="main">
      <section className="end-card">
        <h1>{THEME_LABELS[theme]} isn't ready yet</h1>
        {error.details.deepestRound === 0 ? (
          <p>
            This theme has {poolSize} places so far. A {rounds}-round game needs at least {rounds * 2 + 1}.
          </p>
        ) : (
          <p>No fair puzzle could be built from the current places. Rules are never relaxed, so this game is unavailable.</p>
        )}
        {import.meta.env.DEV && (
          <p className="muted">
            Dev tip: add <code>?demo</code> to the URL to pad every theme with synthetic filler points.
          </p>
        )}
        <p>
          <a className="btn" href="#/">
            Back home
          </a>
        </p>
      </section>
    </main>
  );
}
