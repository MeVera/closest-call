// Turns a candidate list (English Wikipedia titles plus a few hand-written fields) into
// data items, with every machine-checkable fact taken from Wikidata.
//
//   npm run resolve -- music            # resolve data/candidates/music.json, append new items
//   npm run resolve -- music --dry      # report only
//   npm run resolve -- music --candidates extra.json   # use another candidate file
//
// Candidate fields: title (enwiki), place, kind, and optionally id, name, hint, coord, photoRef,
// fact, factSource. `coord` chooses the canonical point:
//   'self' (default for non-artists): the item's own P625
//   'P19'  (default for solo artists): place of birth
//   'P740' (default for bands, i.e. when the item has P740): location of formation
//   'P276': the item's single location
//   'Q123' or 'osm:way/123': an explicit entity
// Afterwards run `npm run sync:coords` to fill lat/lon from coordRef.

import fs from 'node:fs';
import path from 'node:path';
import type { Item, Kind, Theme } from '../src/types';
import { DATA_DIR, fetchJson, loadTheme, writeJson } from './lib';

interface Candidate {
  title: string;
  place: string;
  kind: Kind;
  id?: string;
  name?: string;
  hint?: string;
  coord?: string;
  photoRef?: string;
  fact?: string;
  factSource?: string;
}

type Claims = Record<string, { rank: string; mainsnak: { datavalue?: { value: unknown } }; qualifiers?: Record<string, unknown[]> }[]>;
interface Entity {
  id: string;
  labels?: { en?: { value: string }; mul?: { value: string } };
  descriptions?: { en?: { value: string } };
  claims?: Claims;
}

const SOVEREIGN = new Set(['Q3624078', 'Q6256', 'Q7275', 'Q3024240']); // sovereign state, country, state, historical country
const COUNTRY_ALIASES: Record<string, string[]> = {
  'United States': ['USA', 'United States'],
  'United Kingdom': ['England', 'Scotland', 'Wales', 'Northern Ireland', 'United Kingdom', 'UK'],
  "People's Republic of China": ['China'],
  'Kingdom of the Netherlands': ['Netherlands'],
  Czechia: ['Czech Republic', 'Czechia'],
  'State of Palestine': ['Palestine'],
  Ukraine: ['Ukraine', 'Crimea'],
  'South Korea': ['South Korea', 'Korea'],
  Türkiye: ['Turkey', 'Türkiye'],
  Turkey: ['Turkey', 'Türkiye'],
  Denmark: ['Denmark'],
};

const claimValues = (e: Entity | undefined, p: string): unknown[] =>
  (e?.claims?.[p] ?? []).filter((c) => c.rank !== 'deprecated' && c.mainsnak.datavalue).map((c) => c.mainsnak.datavalue!.value);
const ids = (e: Entity | undefined, p: string) => claimValues(e, p).map((v) => (v as { id: string }).id);
/** Current countries: preferred rank first, and never a claim with an end time (P582). */
function countryIds(e: Entity | undefined): string[] {
  const claims = (e?.claims?.P17 ?? []).filter((c) => c.rank !== 'deprecated' && c.mainsnak.datavalue && !c.qualifiers?.P582);
  const preferred = claims.filter((c) => c.rank === 'preferred');
  return (preferred.length ? preferred : claims).map((c) => (c.mainsnak.datavalue!.value as { id: string }).id);
}
const COUNTRY_DISPLAY: Record<string, string> = {
  "People's Republic of China": 'China',
  'Kingdom of the Netherlands': 'Netherlands',
  'Kingdom of Denmark': 'Denmark',
};
// Wikidata now stores many names once, as a language-neutral 'mul' label.
const label = (e: Entity | undefined) => e?.labels?.en?.value ?? e?.labels?.mul?.value ?? e?.id ?? '?';
const slug = (s: string) =>
  s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

async function titlesToQids(titles: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50);
    const url =
      'https://en.wikipedia.org/w/api.php?' +
      new URLSearchParams({ action: 'query', titles: batch.join('|'), redirects: '1', prop: 'pageprops', ppprop: 'wikibase_item', format: 'json' });
    const json = await fetchJson<{
      query: {
        normalized?: { from: string; to: string }[];
        redirects?: { from: string; to: string }[];
        pages: Record<string, { title: string; pageprops?: { wikibase_item?: string } }>;
      };
    }>(url);
    const byTitle = new Map(Object.values(json.query.pages).map((p) => [p.title, p.pageprops?.wikibase_item]));
    for (const t of batch) {
      let cur = t;
      for (const n of json.query.normalized ?? []) if (n.from === cur) cur = n.to;
      for (const r of json.query.redirects ?? []) if (r.from === cur) cur = r.to;
      const q = byTitle.get(cur);
      if (q) out.set(t, q);
    }
  }
  return out;
}

async function getEntities(qids: string[]): Promise<Map<string, Entity>> {
  const out = new Map<string, Entity>();
  const unique = [...new Set(qids)];
  for (let i = 0; i < unique.length; i += 8) {
    const url =
      'https://www.wikidata.org/w/api.php?' +
      new URLSearchParams({ action: 'wbgetentities', ids: unique.slice(i, i + 8).join('|'), props: 'claims|labels|descriptions', languages: 'en|mul', format: 'json' });
    const json = await fetchJson<{ entities?: Record<string, Entity>; error?: { code: string; info: string; id?: string } }>(url);
    if (json.error) {
      // One bad id (e.g. a deleted item) fails the whole batch: fetch the batch one by one.
      console.warn(`  Wikidata error ${json.error.code}: ${json.error.info}; retrying batch item by item`);
      for (const q of unique.slice(i, i + 8)) {
        const one = await fetchJson<{ entities?: Record<string, Entity> }>(url.replace(/ids=[^&]*/, `ids=${q}`));
        for (const [k, v] of Object.entries(one.entities ?? {})) if (!('missing' in v)) out.set(k, v);
      }
      continue;
    }
    for (const [k, v] of Object.entries(json.entities ?? {})) out.set(k, v);
  }
  return out;
}

function yearOf(e: Entity | undefined): number | undefined {
  for (const p of ['P585', 'P580', 'P571']) {
    const v = claimValues(e, p)[0] as { time?: string } | undefined;
    const m = v?.time && /^([+-]\d+)-/.exec(v.time);
    if (m) return Number(m[1]);
  }
  return undefined;
}

function cleanDescription(d: string | undefined): string {
  if (!d) return '';
  const s = d.replace(/\s*\([^)]*\)\s*$/, '').trim();
  return s.charAt(0).toUpperCase() + s.slice(1);
}

async function main() {
  const [theme, ...flags] = process.argv.slice(2) as [Theme, ...string[]];
  const dry = flags.includes('--dry');
  const ci = flags.indexOf('--candidates');
  const candidatesFile = ci >= 0 ? path.resolve(flags[ci + 1]) : path.join(DATA_DIR, 'candidates', `${theme}.json`);
  const candidates: Candidate[] = JSON.parse(fs.readFileSync(candidatesFile, 'utf8'));
  const existing = loadTheme(theme);
  const existingQ = new Map(existing.map((i) => [i.wikidataId, i.id]));
  const existingIds = new Set(existing.map((i) => i.id));
  const problems: string[] = [];
  const warnings: string[] = [];
  // `coord` / `photoRef` may name an entity by English Wikipedia title: "enwiki:Ford's Theatre".
  const siteTitles = candidates.flatMap((c) => [c.coord, c.photoRef].filter((v): v is string => !!v?.startsWith('enwiki:')).map((v) => v.slice(7)));
  const qidByTitle = await titlesToQids([...candidates.map((c) => c.title), ...siteTitles]);
  for (const c of candidates) {
    for (const f of ['coord', 'photoRef'] as const) {
      const v = c[f];
      if (v?.startsWith('enwiki:')) {
        const q = qidByTitle.get(v.slice(7));
        if (q) c[f] = q;
        else problems.push(`${c.title}: ${f} title "${v.slice(7)}" not found`);
      }
    }
  }
  const ents = await getEntities(candidates.map((c) => qidByTitle.get(c.title)).filter((q): q is string => !!q));

  // Second hop: coordinate entities, countries, P1376 targets.
  const hop: string[] = [];
  for (const c of candidates) {
    const e = ents.get(qidByTitle.get(c.title) ?? '');
    if (!e) continue;
    hop.push(...ids(e, 'P19'), ...ids(e, 'P740'), ...ids(e, 'P276'), ...ids(e, 'P17'), ...ids(e, 'P1376'));
    if (c.coord && /^Q\d+$/.test(c.coord)) hop.push(c.coord);
    if (c.photoRef) hop.push(c.photoRef);
  }
  const ents2 = await getEntities(hop.filter((q) => !ents.has(q)));
  const get = (q: string) => ents.get(q) ?? ents2.get(q);
  const countryOfHop: string[] = [];
  for (const e of ents2.values()) countryOfHop.push(...ids(e, 'P17'));
  const ents3 = await getEntities(countryOfHop.filter((q) => !get(q)));
  const get3 = (q: string) => get(q) ?? ents3.get(q);

  const added: Item[] = [];
  for (const c of candidates) {
    const q = qidByTitle.get(c.title);
    const e = q ? get(q) : undefined;
    const tag = `${c.title}`;
    if (!q || !e) {
      problems.push(`${tag}: no Wikidata item for this Wikipedia title`);
      continue;
    }
    if (existingQ.has(q)) {
      warnings.push(`${tag}: already present as ${existingQ.get(q)} (skipped)`);
      continue;
    }

    // Canonical point.
    let coordEntity: Entity | undefined;
    let coordRef: string | undefined;
    const mode = c.coord ?? (c.kind === 'artist' ? (ids(e, 'P740').length ? 'P740' : 'P19') : 'self');
    if (mode.startsWith('osm:')) coordRef = mode;
    else if (/^Q\d+$/.test(mode)) coordEntity = get3(mode);
    else if (mode === 'self') {
      coordEntity = e;
      // Events without their own point fall back to their single location (P276).
      const loc = [...new Set(ids(e, 'P276'))];
      if (!claimValues(e, 'P625').length && loc.length === 1 && claimValues(get3(loc[0]), 'P625').length) coordEntity = get3(loc[0]);
    }
    else {
      const vals = [...new Set(ids(e, mode))];
      if (vals.length !== 1) {
        problems.push(`${tag}: ${mode} has ${vals.length} values (${vals.map((v) => label(get3(v))).join(', ') || 'none'}), so the origin is missing or disputed`);
        continue;
      }
      coordEntity = get3(vals[0]);
    }
    if (!coordRef) {
      if (!coordEntity || !claimValues(coordEntity, 'P625').length) {
        problems.push(`${tag}: no P625 on ${coordEntity ? `${label(coordEntity)} (${coordEntity.id})` : 'coordinate entity'}`);
        continue;
      }
      coordRef = `wikidata:${coordEntity.id}`;
      const pts = claimValues(coordEntity, 'P625') as { latitude: number; longitude: number }[];
      if (pts.length > 1) {
        const spread = Math.max(...pts.map((p) => Math.abs(p.latitude - pts[0].latitude) + Math.abs(p.longitude - pts[0].longitude)));
        if (spread > 0.05) warnings.push(`${tag}: ${pts.length} different P625 values on ${coordEntity.id} (sync uses the preferred/first)`);
      }
    }

    // Country check: last part of place vs P17 of the coordinate entity (or item).
    const countryQs = countryIds(coordEntity ?? e).length ? countryIds(coordEntity ?? e) : countryIds(e);
    const countryLabels = countryQs.map((cq) => label(get3(cq))).map((l) => COUNTRY_DISPLAY[l] ?? l);
    const placeCountry = c.place.split(',').at(-1)!.trim();
    const matches = countryLabels.some((cl) => cl === placeCountry || COUNTRY_ALIASES[cl]?.includes(placeCountry));
    if (countryLabels.length && !matches) warnings.push(`${tag}: place says "${placeCountry}" but Wikidata country is ${countryLabels.join(' / ')}`);

    // Capitals must be national capitals.
    if (c.kind === 'capital') {
      const ofSovereign = ids(e, 'P1376').filter((t) => ids(get3(t), 'P31').some((k) => SOVEREIGN.has(k)));
      if (!ofSovereign.length) {
        problems.push(`${tag}: not recorded on Wikidata (P1376) as the capital of a sovereign country`);
        continue;
      }
    }

    const name = c.name ?? label(e);
    let id = c.id ?? slug(name);
    if (existingIds.has(id) || added.some((a) => a.id === id)) id = `${id}-${theme}`;
    const hint = c.hint ?? (theme === 'geography' ? (countryLabels[0] ?? placeCountry) : cleanDescription(e.descriptions?.en?.value));
    if (!hint) warnings.push(`${tag}: no hint (no Wikidata description)`);

    const item = {
      id,
      theme,
      name,
      place: c.place,
      kind: c.kind,
      lat: null,
      lon: null,
      wikidataId: q,
      coordRef,
      coordSource: '',
      ...(c.photoRef ? { photoRef: c.photoRef } : {}),
      hint,
      ...(c.fact ? { fact: c.fact, factSource: c.factSource ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(c.title.replace(/ /g, '_'))}` } : {}),
      ...(theme === 'history' && yearOf(e) !== undefined ? { year: yearOf(e) } : {}),
    } as unknown as Item;
    added.push(item);
    const via = coordEntity && coordEntity.id !== q ? ` via ${label(coordEntity)}` : '';
    console.log(`+ ${id.padEnd(34)} ${q.padEnd(10)} ${coordRef}${via} | ${hint}`);
  }

  console.log(`\n${added.length} new, ${problems.length} rejected, ${warnings.length} warnings. Total would be ${existing.length + added.length}.`);
  for (const p of problems) console.log(`  ✗ ${p}`);
  for (const w of warnings) console.log(`  ! ${w}`);
  if (!dry && added.length) {
    writeJson(path.join(DATA_DIR, `${theme}.json`), [...existing, ...added]);
    console.log(`Wrote data/${theme}.json. Next: npm run sync:coords -- --theme ${theme}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
