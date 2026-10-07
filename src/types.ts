import type { THEMES } from './config';

export type Theme = (typeof THEMES)[number];

export type Kind =
  | 'landmark'
  | 'capital'
  | 'stadium'
  | 'circuit'
  | 'studio'
  | 'venue'
  | 'festival'
  | 'artist'
  | 'event';

export const KINDS_BY_THEME: Record<Theme, readonly Kind[]> = {
  sport: ['stadium', 'circuit', 'venue'],
  music: ['studio', 'venue', 'festival', 'artist'],
  geography: ['landmark', 'capital'],
  history: ['event'],
};

export interface Item {
  id: string;
  theme: Theme;
  name: string;
  /** Human-readable location, e.g. "London, England". For Sport, the text before the first comma is the city. */
  place: string;
  kind: Kind;
  lat: number;
  lon: number;
  /** The item itself on Wikidata (the band, the event, the stadium). */
  wikidataId: string;
  /**
   * Where the canonical point comes from: "wikidata:Q123" (P625 of that entity, which may be
   * a place such as a band's formation city) or "osm:way/123" / "osm:node/123" / "osm:relation/123".
   * scripts/sync-coords.ts reads this and writes lat, lon and coordSource.
   */
  coordRef: string;
  /** URL of the coordinate source (Wikidata or OpenStreetMap). */
  coordSource: string;
  /** Optional Wikidata entity whose image (P18) shows the place. Defaults to the coordRef entity, then wikidataId. */
  photoRef?: string;
  hint: string;
  fact?: string;
  factSource?: string;
  year?: number;
}

export interface PhotoCredit {
  file: string;
  author: string;
  licence: string;
  licenceUrl: string;
  pageUrl: string;
  /** How the file was chosen: Wikidata P18, Commons search, or a manual override. */
  via: 'p18' | 'search' | 'override';
  width: number;
  height: number;
}

export type PhotoCredits = Record<string, PhotoCredit>;
