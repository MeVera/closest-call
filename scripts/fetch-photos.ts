// Fetch one openly licensed photo of each item's place from Wikimedia Commons.
//
//   npm run fetch:photos                 # every item without a photo
//   npm run fetch:photos -- --only abba  # one item (refetches it)
//   npm run fetch:photos -- --force      # refetch everything
//   npm run fetch:photos -- --theme music # one theme
//
// Order of preference: data/photo-overrides.json, then Wikidata P18 of the photo entity
// (photoRef, else the coordRef entity, else wikidataId), then a Commons search.
// Licences: CC0, public domain, CC BY, CC BY-SA only. Landscape >= 1200 px preferred.
// Output: public/photos/<id>.webp (~800 px, q75) and data/photo-credits.json.

import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { THEMES } from '../src/config';
import type { Item, PhotoCredit, PhotoCredits } from '../src/types';
import { buildContactSheet } from './contact-sheet';
import { classifyLicence } from './licence';
import { DATA_DIR, fetchJson, loadCredits, loadTheme, parseCoordRef, PHOTOS_DIR, politeFetch, readJson, writeJson } from './lib';

const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
const THUMB_WIDTH = 900;
const OUTPUT_WIDTH = 800;
const WEBP_QUALITY = 75;
const PREFERRED_MIN_WIDTH = 1200;
const ABSOLUTE_MIN_WIDTH = 800;
/** Filenames that suggest the image is not a photo of the place. */
const DENY_FILENAME =
  /logo|poster|album|cover|portrait|signature|\bmap\b|locator|flag|coat[_ ]of[_ ]arms|\bseal\b|diagram|plan\b|ticket|stamp|banknote|tapestry|painting|engraving|lithograph|drawing|\bNARA\b|\.svg$|\.gif$/i;
let verbose = false;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/tiff']);

interface ImageInfo {
  url: string;
  thumburl?: string;
  thumbwidth?: number;
  width: number;
  height: number;
  mime: string;
  descriptionurl: string;
  extmetadata?: Record<string, { value: string } | undefined>;
}

interface Candidate {
  title: string;
  via: PhotoCredit['via'];
  info: ImageInfo;
}

const stripHtml = (s: string) =>
  s
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const normTitle = (t: string) => (t.startsWith('File:') ? t : `File:${t}`).replace(/_/g, ' ');

async function imageInfos(titles: string[]): Promise<Map<string, ImageInfo>> {
  const out = new Map<string, ImageInfo>();
  if (!titles.length) return out;
  const url =
    COMMONS_API +
    '?' +
    new URLSearchParams({
      action: 'query',
      format: 'json',
      formatversion: '2',
      titles: titles.map(normTitle).join('|'),
      prop: 'imageinfo',
      iiprop: 'url|size|mime|extmetadata',
      iiurlwidth: String(THUMB_WIDTH),
      iiextmetadatafilter: 'LicenseShortName|License|LicenseUrl|Artist|Credit|UsageTerms|NonFree|Copyrighted',
    });
  const json = await fetchJson<{ query?: { normalized?: { from: string; to: string }[]; pages: { title: string; missing?: boolean; imageinfo?: ImageInfo[] }[] } }>(url);
  for (const p of json.query?.pages ?? []) if (!p.missing && p.imageinfo?.[0]) out.set(p.title, p.imageinfo[0]);
  return out;
}

async function p18Titles(entity: string): Promise<string[]> {
  const url =
    'https://www.wikidata.org/w/api.php?' +
    new URLSearchParams({ action: 'wbgetclaims', entity, property: 'P18', format: 'json' });
  const json = await fetchJson<{ claims?: { P18?: { rank: string; mainsnak: { datavalue?: { value: string } } }[] } }>(url);
  const claims = (json.claims?.P18 ?? []).filter((c) => c.rank !== 'deprecated' && c.mainsnak.datavalue);
  claims.sort((a, b) => (a.rank === 'preferred' ? -1 : 0) - (b.rank === 'preferred' ? -1 : 0));
  return claims.map((c) => normTitle(c.mainsnak.datavalue!.value));
}

async function searchTitles(query: string): Promise<string[]> {
  const url =
    COMMONS_API +
    '?' +
    new URLSearchParams({
      action: 'query',
      format: 'json',
      formatversion: '2',
      list: 'search',
      srnamespace: '6',
      srsearch: `${query} filetype:bitmap`,
      srlimit: '20',
    });
  const json = await fetchJson<{ query?: { search: { title: string }[] } }>(url);
  return (json.query?.search ?? []).map((s) => s.title);
}

function photoEntity(item: Item): string {
  if (item.photoRef) return item.photoRef;
  const ref = parseCoordRef(item.coordRef);
  return ref.source === 'wikidata' ? ref.id : item.wikidataId;
}

async function entityLabel(id: string): Promise<string | null> {
  const url =
    'https://www.wikidata.org/w/api.php?' +
    new URLSearchParams({ action: 'wbgetentities', ids: id, props: 'labels', languages: 'en', format: 'json' });
  const json = await fetchJson<{ entities: Record<string, { labels?: { en?: { value: string } } }> }>(url);
  return json.entities[id]?.labels?.en?.value ?? null;
}

/**
 * Search text: the label of the photo entity (the site, or an artist's city), plus the
 * first part of `place` for context. Searching the event or artist name finds people.
 */
async function searchQuery(item: Item): Promise<string> {
  const entity = photoEntity(item);
  const label = entity !== item.wikidataId ? await entityLabel(entity) : null;
  if (item.kind === 'artist') return item.place.split(',').slice(0, 2).join('');
  return label ? `${label} ${item.place.split(',').at(-2)?.trim() ?? ''}`.trim() : `${item.name} ${item.place.split(',')[0]}`;
}

type Judged = { ok: true; credit: PhotoCredit; preferred: boolean } | { ok: false; reason: string };

function judge(c: Candidate, ignoreFilenameRules = false): Judged {
  const { info } = c;
  const meta = info.extmetadata ?? {};
  const m = (k: string) => meta[k]?.value ?? '';
  if (!ALLOWED_MIME.has(info.mime)) return { ok: false, reason: `mime ${info.mime}` };
  if (!ignoreFilenameRules && DENY_FILENAME.test(c.title)) return { ok: false, reason: 'filename suggests not a place photo' };
  if (m('NonFree').toLowerCase() === 'true') return { ok: false, reason: 'marked non-free' };
  const licence = classifyLicence(m('LicenseShortName'), m('License'));
  if (!licence) return { ok: false, reason: `licence not accepted ("${m('LicenseShortName') || 'none'}")` };
  // Some files put licence boilerplate in the Artist field ("This image's author is X Attribution — You must…").
  let author = stripHtml(m('Artist'))
    .replace(/^This (?:image|file|photo)'s author is\s+/i, '')
    .split(/\s+(?:Attribution\b|—|-\s+You must)/)[0]
    .trim();
  if (!author) {
    if (licence === 'CC0' || licence === 'Public domain') author = 'Unknown author';
    else return { ok: false, reason: 'no author for an attribution licence' };
  }
  if (author.length > 120) author = author.slice(0, 117) + '…';
  if (info.width < ABSOLUTE_MIN_WIDTH) return { ok: false, reason: `too small (${info.width}px)` };
  const licenceUrl =
    m('LicenseUrl') ||
    (licence === 'CC0'
      ? 'https://creativecommons.org/publicdomain/zero/1.0/'
      : licence === 'Public domain'
        ? 'https://creativecommons.org/publicdomain/mark/1.0/'
        : '');
  if (!licenceUrl) return { ok: false, reason: 'no licence URL' };
  return {
    ok: true,
    preferred: info.width >= PREFERRED_MIN_WIDTH && info.width > info.height,
    credit: {
      file: c.title,
      author,
      licence,
      licenceUrl: licenceUrl.replace(/^http:/, 'https:'),
      pageUrl: info.descriptionurl,
      via: c.via,
      width: info.width,
      height: info.height,
    },
  };
}

async function choosePhoto(item: Item, override: string | undefined): Promise<{ cand: Candidate; credit: PhotoCredit } | { error: string }> {
  const log: string[] = [];
  const evaluate = async (titles: string[], via: PhotoCredit['via']) => {
    const infos = await imageInfos(titles.slice(0, 20));
    const judged: { cand: Candidate; j: Judged }[] = [];
    for (const t of titles) {
      const info = infos.get(normTitle(t));
      if (!info) {
        log.push(`${via} ${t}: not found`);
        continue;
      }
      const cand = { title: normTitle(t), via, info };
      const j = judge(cand, via === 'override');
      if (!j.ok) log.push(`${via} ${t}: ${j.reason}`);
      judged.push({ cand, j });
    }
    return judged;
  };

  if (override) {
    const [o] = await evaluate([override], 'override');
    if (o?.j.ok) return { cand: o.cand, credit: o.j.credit };
    // A pinned file that fails the licence policy is an error, never a silent fallback.
    return { error: `override ${override} rejected: ${log.join('; ')}` };
  }

  const p18 = await evaluate(await p18Titles(photoEntity(item)), 'p18');
  const p18Preferred = p18.find((x) => x.j.ok && x.j.preferred);
  if (p18Preferred && p18Preferred.j.ok) return { cand: p18Preferred.cand, credit: p18Preferred.j.credit };

  const landscape = (x: { cand: Candidate }) => x.cand.info.width > x.cand.info.height;
  const p18Landscape = p18.find((x) => x.j.ok && landscape(x));
  if (p18Landscape && p18Landscape.j.ok) return { cand: p18Landscape.cand, credit: p18Landscape.j.credit };

  const search = await evaluate(await searchTitles(await searchQuery(item)), 'search');
  const ordered = [
    search.find((x) => x.j.ok && x.j.preferred),
    search.find((x) => x.j.ok && landscape(x)),
    p18.find((x) => x.j.ok),
  ];
  if (verbose) for (const l of log) console.log(`    ${l}`);
  for (const x of ordered) if (x && x.j.ok) return { cand: x.cand, credit: x.j.credit };
  return { error: `no acceptable photo. Tried: ${log.slice(0, 12).join('; ') || 'nothing found'}` };
}

async function downloadWebp(info: ImageInfo, dest: string): Promise<void> {
  const src = info.thumburl ?? info.url;
  const res = await politeFetch(src, 800);
  if (!res.ok) throw new Error(`HTTP ${res.status} downloading ${src}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await sharp(buf)
    .rotate()
    .resize({ width: OUTPUT_WIDTH, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toFile(dest);
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  verbose = args.includes('--verbose');
  const oi = args.indexOf('--only');
  const only = oi >= 0 ? new Set(args[oi + 1].split(',')) : null;
  const ti = args.indexOf('--theme');
  const themes = ti >= 0 ? THEMES.filter((t) => args[ti + 1].split(',').includes(t)) : THEMES;

  fs.mkdirSync(PHOTOS_DIR, { recursive: true });
  const overridesFile = path.join(DATA_DIR, 'photo-overrides.json');
  const overrides = fs.existsSync(overridesFile) ? readJson<Record<string, string>>(overridesFile) : {};
  const credits: PhotoCredits = loadCredits();
  const creditsFile = path.join(DATA_DIR, 'photo-credits.json');
  const failures: string[] = [];
  let fetched = 0;
  let skipped = 0;

  for (const theme of themes) {
    for (const item of loadTheme(theme)) {
      if (only && !only.has(item.id)) continue;
      const dest = path.join(PHOTOS_DIR, `${item.id}.webp`);
      const override = overrides[item.id] ? normTitle(overrides[item.id]) : undefined;
      const existing = credits[item.id];
      const upToDate = fs.existsSync(dest) && existing && (!override || existing.file === override);
      if (upToDate && !force && !only) {
        skipped++;
        continue;
      }
      process.stdout.write(`${theme}/${item.id} … `);
      try {
        const pick = await choosePhoto(item, override);
        if ('error' in pick) {
          console.log(`✗ ${pick.error}`);
          failures.push(`${theme}/${item.id}: ${pick.error}`);
          continue;
        }
        await downloadWebp(pick.cand.info, dest);
        credits[item.id] = pick.credit;
        writeJson(creditsFile, sortKeys(credits));
        fetched++;
        console.log(`✓ ${pick.credit.via} ${pick.credit.file} (${pick.credit.licence}, ${pick.credit.width}×${pick.credit.height})`);
      } catch (e) {
        console.log(`✗ ${(e as Error).message}`);
        failures.push(`${theme}/${item.id}: ${(e as Error).message}`);
      }
    }
  }

  const sheet = buildContactSheet();
  console.log(`\nFetched ${fetched}, skipped ${skipped} (already present), failed ${failures.length}.`);
  console.log(`Contact sheet: ${sheet}`);
  if (failures.length) {
    console.log('\nItems without an acceptable photo (validation will fail until fixed or overridden):');
    for (const f of failures) console.log(`  - ${f}`);
    process.exit(1);
  }
}

function sortKeys<T>(o: Record<string, T>): Record<string, T> {
  return Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
