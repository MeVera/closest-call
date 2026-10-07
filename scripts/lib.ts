import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { THEMES } from '../src/config';
import type { Item, PhotoCredits, Theme } from '../src/types';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DATA_DIR = path.join(ROOT, 'data');
export const PHOTOS_DIR = path.join(ROOT, 'public', 'photos');

/**
 * Wikimedia and OSM ask for a descriptive User-Agent with contact details.
 * Set CLOSEST_CALL_CONTACT (an email or URL) before running the scripts at scale.
 * (Nominatim rejects example.com addresses, so the placeholder is plain text.)
 */
const CONTACT = process.env.CLOSEST_CALL_CONTACT ?? 'contact placeholder, set CLOSEST_CALL_CONTACT';
export const USER_AGENT = `ClosestCallGame/0.1 (static map quiz data build; ${CONTACT})`;

export function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

export function writeJson(file: string, value: unknown): void {
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
}

export function loadTheme(theme: Theme, dataDir = DATA_DIR): Item[] {
  return readJson<Item[]>(path.join(dataDir, `${theme}.json`));
}

export function loadAll(dataDir = DATA_DIR): Record<Theme, Item[]> {
  return Object.fromEntries(THEMES.map((t) => [t, loadTheme(t, dataDir)])) as Record<Theme, Item[]>;
}

export function loadCredits(dataDir = DATA_DIR): PhotoCredits {
  const file = path.join(dataDir, 'photo-credits.json');
  return fs.existsSync(file) ? readJson<PhotoCredits>(file) : {};
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let lastRequest = 0;
/** fetch with the project User-Agent, a minimum gap between requests, and retries on 429/5xx. */
export async function politeFetch(url: string, minGapMs = 1000): Promise<Response> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const wait = lastRequest + minGapMs - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequest = Date.now();
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, 'Api-User-Agent': USER_AGENT } });
    if (res.status !== 429 && res.status < 500) return res;
    const retryAfter = Number(res.headers.get('retry-after')) || 5 * (attempt + 1);
    console.warn(`  ${res.status} from ${new URL(url).host}, retrying in ${retryAfter}s`);
    await sleep(retryAfter * 1000);
  }
  throw new Error(`Gave up fetching ${url}`);
}

export async function fetchJson<T>(url: string, minGapMs?: number): Promise<T> {
  const res = await politeFetch(url, minGapMs);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return (await res.json()) as T;
}

export function parseCoordRef(ref: string): { source: 'wikidata'; id: string } | { source: 'osm'; type: string; id: string } {
  let m = /^wikidata:(Q\d+)$/.exec(ref);
  if (m) return { source: 'wikidata', id: m[1] };
  m = /^osm:(node|way|relation)\/(\d+)$/.exec(ref);
  if (m) return { source: 'osm', type: m[1], id: m[2] };
  throw new Error(`Bad coordRef "${ref}"`);
}
