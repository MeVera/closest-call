// Fills lat, lon and coordSource for every item from its coordRef:
//   wikidata:Q123      -> Wikidata P625 (preferred rank first)
//   osm:way/123 etc.   -> OpenStreetMap via Nominatim lookup (centroid)
// Usage: npm run sync:coords [-- --theme music] [-- --check]
//   --check reports differences without writing.

import path from 'node:path';
import { THEMES } from '../src/config';
import type { Item, Theme } from '../src/types';
import { haversineKm } from '../src/lib/geo';
import { DATA_DIR, fetchJson, loadTheme, parseCoordRef, writeJson } from './lib';

interface WdClaim {
  rank: string;
  mainsnak: { datavalue?: { value: { latitude: number; longitude: number } } };
}

const round5 = (x: number) => Math.round(x * 1e5) / 1e5;

async function wikidataCoords(ids: string[]): Promise<Map<string, { lat: number; lon: number }>> {
  const out = new Map<string, { lat: number; lon: number }>();
  for (let i = 0; i < ids.length; i += 15) {
    const batch = ids.slice(i, i + 15);
    const url =
      'https://www.wikidata.org/w/api.php?' +
      new URLSearchParams({ action: 'wbgetentities', ids: batch.join('|'), props: 'claims', format: 'json' });
    const json = await fetchJson<{ entities: Record<string, { claims?: { P625?: WdClaim[] } }> }>(url);
    for (const [id, ent] of Object.entries(json.entities)) {
      const claims = (ent.claims?.P625 ?? []).filter((c) => c.rank !== 'deprecated' && c.mainsnak.datavalue);
      const best = claims.find((c) => c.rank === 'preferred') ?? claims[0];
      if (best) {
        const v = best.mainsnak.datavalue!.value;
        out.set(id, { lat: round5(v.latitude), lon: round5(v.longitude) });
      }
    }
  }
  return out;
}

async function osmCoords(type: string, id: string): Promise<{ lat: number; lon: number } | null> {
  const prefix = { node: 'N', way: 'W', relation: 'R' }[type];
  const url = `https://nominatim.openstreetmap.org/lookup?osm_ids=${prefix}${id}&format=jsonv2`;
  // Nominatim policy: at most 1 request per second.
  const json = await fetchJson<{ lat: string; lon: string }[]>(url, 1100);
  if (!json[0]) return null;
  return { lat: round5(Number(json[0].lat)), lon: round5(Number(json[0].lon)) };
}

async function main() {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const ti = args.indexOf('--theme');
  const themes: Theme[] = ti >= 0 ? [args[ti + 1] as Theme] : [...THEMES];
  let problems = 0;

  for (const theme of themes) {
    const items = loadTheme(theme);
    const wdIds = [
      ...new Set(
        items.flatMap((it) => {
          const r = parseCoordRef(it.coordRef);
          return r.source === 'wikidata' ? [r.id] : [];
        }),
      ),
    ];
    const wd = await wikidataCoords(wdIds);

    for (const it of items as (Item & { lat: number | null; lon: number | null })[]) {
      const ref = parseCoordRef(it.coordRef);
      let c: { lat: number; lon: number } | null | undefined;
      let src: string;
      if (ref.source === 'wikidata') {
        c = wd.get(ref.id);
        src = `https://www.wikidata.org/wiki/${ref.id}#P625`;
      } else {
        c = await osmCoords(ref.type, ref.id);
        src = `https://www.openstreetmap.org/${ref.type}/${ref.id}`;
      }
      if (!c) {
        console.error(`✗ ${theme}/${it.id}: no coordinates found at ${it.coordRef}`);
        problems++;
        continue;
      }
      const moved = it.lat == null || it.lon == null ? Infinity : haversineKm(it as Item, c);
      if (moved > 0.01) {
        console.log(
          `${check ? '≠' : '✓'} ${theme}/${it.id}: ${it.lat},${it.lon} -> ${c.lat},${c.lon}` +
            (Number.isFinite(moved) ? ` (${moved.toFixed(2)} km)` : ''),
        );
        if (check) problems++;
      }
      if (!check) {
        it.lat = c.lat;
        it.lon = c.lon;
        it.coordSource = src;
      }
    }
    if (!check) writeJson(path.join(DATA_DIR, `${theme}.json`), items);
    console.log(`${theme}: ${items.length} items ${check ? 'checked' : 'synced'}`);
  }
  if (problems) {
    console.error(`${problems} problem(s).`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
