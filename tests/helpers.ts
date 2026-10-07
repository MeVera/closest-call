import { createRng } from '../src/lib/rng';
import type { Item, Theme } from '../src/types';
import { KINDS_BY_THEME } from '../src/types';

/**
 * Deterministic synthetic pool: scattered points worldwide plus dense regional
 * clusters so tight-ratio rounds exist. Every item gets its own "city" so the
 * Sport same-city rule never blocks it.
 */
export function syntheticPool(theme: Theme, size = 90, seed = 'synthetic'): Item[] {
  const rng = createRng(seed);
  const clusters = [
    [51.5, -0.1],
    [40.7, -74],
    [-33.9, 151.2],
    [35.7, 139.7],
    [48.9, 2.3],
    [-23.5, -46.6],
  ];
  const items: Item[] = [];
  for (let i = 0; i < size; i++) {
    let lat: number, lon: number;
    if (i % 3 === 0) {
      lat = -55 + rng() * 120;
      lon = -180 + rng() * 360;
    } else {
      const [clat, clon] = clusters[i % clusters.length];
      lat = clat + (rng() - 0.5) * 16;
      lon = clon + (rng() - 0.5) * 22;
    }
    items.push({
      id: `${theme}-syn-${i}`,
      theme,
      name: `Synthetic ${i}`,
      place: `City${i}, Testland`,
      kind: KINDS_BY_THEME[theme][0],
      lat: Math.round(lat * 1e4) / 1e4,
      lon: Math.round(lon * 1e4) / 1e4,
      wikidataId: 'Q1',
      coordRef: 'wikidata:Q1',
      coordSource: 'https://www.wikidata.org/wiki/Q1#P625',
      hint: 'Synthetic test item',
      ...(theme === 'music' ? { fact: 'Test fact.', factSource: 'https://example.org' } : {}),
    });
  }
  return items;
}
