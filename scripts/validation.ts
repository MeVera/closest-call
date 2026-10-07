import fs from 'node:fs';
import path from 'node:path';
import { DAILY_ROUNDS, ENDLESS_MAX_ROUNDS, LAUNCH_DATE, THEMES, VALIDATION } from '../src/config';
import { KINDS_BY_THEME, type Item, type PhotoCredits, type Theme } from '../src/types';
import { addDays } from '../src/lib/dateKey';
import { checkRound, dailyPuzzle, endlessRun, GenerationError, type Round } from '../src/lib/generator';
import { isAcceptableLicence } from './licence';

export interface ValidationOptions {
  photosDir: string;
  credits: PhotoCredits;
  checkPhotos?: boolean;
}

const COORD_SOURCE = /^https:\/\/(www\.wikidata\.org\/wiki\/Q\d+|www\.openstreetmap\.org\/(node|way|relation)\/\d+)/;
const URL_RE = /^https?:\/\/\S+$/;

/** Field-level checks. Returns a list of human-readable errors (empty means valid). */
export function validateItems(byTheme: Partial<Record<Theme, unknown[]>>, opts: ValidationOptions): string[] {
  const errors: string[] = [];
  const seen = new Map<string, string>();

  for (const [theme, list] of Object.entries(byTheme) as [Theme, unknown[]][]) {
    if (!Array.isArray(list)) {
      errors.push(`${theme}: data file is not an array`);
      continue;
    }
    list.forEach((raw, idx) => {
      const it = raw as Partial<Item>;
      const where = `${theme}/${it?.id ?? `#${idx}`}`;
      const err = (m: string) => errors.push(`${where}: ${m}`);

      if (typeof it.id !== 'string' || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(it.id)) err('id missing or not kebab-case');
      else if (seen.has(it.id)) err(`duplicate id (also in ${seen.get(it.id)})`);
      else seen.set(it.id, theme);

      if (it.theme !== theme) err(`theme is "${it.theme}" but item is in ${theme}.json`);
      for (const f of ['name', 'place', 'hint'] as const)
        if (typeof it[f] !== 'string' || !it[f]!.trim()) err(`missing ${f}`);

      if (!KINDS_BY_THEME[theme]?.includes(it.kind as never)) {
        if (theme === 'geography') err(`Geography items must be a landmark or a capital (got "${it.kind}")`);
        else err(`kind "${it.kind}" not allowed in ${theme}`);
      }

      if (typeof it.lat !== 'number' || typeof it.lon !== 'number' || !Number.isFinite(it.lat) || !Number.isFinite(it.lon))
        err('missing coordinates');
      else if (it.lat < -90 || it.lat > 90 || it.lon < -180 || it.lon > 180) err(`coordinates out of range (${it.lat}, ${it.lon})`);

      if (typeof it.wikidataId !== 'string' || !/^Q\d+$/.test(it.wikidataId)) err('missing or bad wikidataId');
      if (typeof it.coordRef !== 'string' || !/^(wikidata:Q\d+|osm:(node|way|relation)\/\d+)$/.test(it.coordRef))
        err('missing or bad coordRef');
      if (typeof it.coordSource !== 'string' || !COORD_SOURCE.test(it.coordSource))
        err('coordSource must be a Wikidata or OpenStreetMap URL');

      if (theme === 'music') {
        if (typeof it.fact !== 'string' || !it.fact.trim()) err('Music items need a fact');
        if (typeof it.factSource !== 'string' || !URL_RE.test(it.factSource)) err('Music items need a factSource URL');
      } else if (it.fact && (typeof it.factSource !== 'string' || !URL_RE.test(it.factSource))) {
        err('fact given without a factSource URL');
      }

      if (opts.checkPhotos !== false && typeof it.id === 'string') {
        if (!fs.existsSync(path.join(opts.photosDir, `${it.id}.webp`))) err('no photo (public/photos/<id>.webp)');
        const c = opts.credits[it.id];
        if (!c) err('no photo credit');
        else {
          for (const f of ['file', 'author', 'licence', 'licenceUrl', 'pageUrl'] as const)
            if (typeof c[f] !== 'string' || !c[f].trim()) err(`photo credit missing ${f}`);
          if (c.licence && !isAcceptableLicence(c.licence)) err(`photo licence "${c.licence}" not accepted`);
        }
      }
    });
  }
  return errors;
}

function verifyChain(rounds: Round[], expected: number): string | null {
  if (rounds.length !== expected) return `expected ${expected} rounds, got ${rounds.length}`;
  const ids = new Set<string>([rounds[0].anchor.id]);
  for (const r of rounds) {
    const why = checkRound(r.anchor, r.options[0], r.options[1], r.round);
    if (why) return `round ${r.round}: ${why}`;
    for (const o of r.options) {
      if (ids.has(o.id)) return `round ${r.round}: ${o.id} repeats`;
      ids.add(o.id);
    }
    const next = rounds[r.round];
    if (next && next.anchor.id !== r.options[r.closer].id) return `round ${r.round + 1}: anchor is not the previous closer option`;
  }
  return null;
}

export interface GenerationReport {
  theme: Theme;
  dailyFailures: { date: string; reason: string }[];
  endlessFailures: { seed: string; reason: string }[];
}

/** Simulate daily puzzles for `days` dates and `endlessRuns` Endless runs for one theme. */
export function checkGeneration(
  theme: Theme,
  pool: Item[],
  days = VALIDATION.days,
  endlessRuns = VALIDATION.endlessRuns,
  startDate = LAUNCH_DATE,
): GenerationReport {
  const report: GenerationReport = { theme, dailyFailures: [], endlessFailures: [] };
  const describe = (e: unknown) =>
    e instanceof GenerationError
      ? `${e.message}${e.details.band ? ` Stuck near band ${e.details.band.min}–${e.details.band.max}.` : ''}`
      : String(e);

  for (let d = 0; d < days; d++) {
    const date = addDays(startDate, d);
    try {
      const why = verifyChain(dailyPuzzle(pool, theme, date), DAILY_ROUNDS);
      if (why) report.dailyFailures.push({ date, reason: why });
    } catch (e) {
      report.dailyFailures.push({ date, reason: describe(e) });
      // A pool that is too small fails identically every day; stop early.
      if (e instanceof GenerationError && e.details.deepestRound === 0) break;
    }
  }
  for (let i = 0; i < endlessRuns; i++) {
    const seed = `validate-${i}`;
    try {
      const why = verifyChain(endlessRun(pool, theme, seed), ENDLESS_MAX_ROUNDS);
      if (why) report.endlessFailures.push({ seed, reason: why });
    } catch (e) {
      report.endlessFailures.push({ seed, reason: describe(e) });
      if (e instanceof GenerationError && e.details.deepestRound === 0) break;
    }
  }
  return report;
}

export { THEMES };
