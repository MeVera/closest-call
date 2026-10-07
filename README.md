# Closest Call

A daily map-based guessing game. You see an anchor place and two options, and you pick the option that is closer to the anchor in a straight line over the Earth (great-circle, haversine). The true closer option becomes the next anchor.

Static site: Vite + React + TypeScript, no backend. The name and every tunable number live in [`src/config.ts`](src/config.ts).

## Commands

| Command | What it does |
| --- | --- |
| `npm install` | Install dependencies |
| `npm run dev` | Start the dev server |
| `npm run build` | Typecheck and build static output to `dist/` |
| `npm run preview` | Serve the built `dist/` locally |
| `npm test` | Run the Vitest unit tests |
| `npm run typecheck` | TypeScript only |
| `npm run validate:data` | Validate all data, photos and credits, and simulate 400 days plus 500 Endless runs per theme. Exits 1 on any problem. Dev-only flags: `-- --skip-photos`, `-- --skip-generation` |
| `npm run sync:coords` | Fill `lat`, `lon` and `coordSource` for every item from its `coordRef` (Wikidata P625 or OpenStreetMap). `-- --check` reports drift without writing; `-- --theme music` limits it to one theme |
| `npm run fetch:photos` | Fetch, licence-check and convert photos from Wikimedia Commons, write credits and the contact sheet |
| `npm run contact-sheet` | Rebuild `photo-review/contact-sheet.html` only |

Set `CLOSEST_CALL_CONTACT` (an email address or URL) before running the network scripts, so Wikimedia and OSM can reach you, as their User-Agent policies ask:

```bash
CLOSEST_CALL_CONTACT="you@yourdomain" npm run fetch:photos
```

## Data

`data/<theme>.json` holds one array of items per theme:

| Field | Notes |
| --- | --- |
| `id` | kebab-case, unique across all themes; also the photo filename |
| `theme`, `name`, `place`, `kind`, `hint` | `hint` is shown with the anchor. For Geography it names the country |
| `wikidataId` | The item itself (the band, the event, the stadium) |
| `coordRef` | Where the canonical point comes from: `wikidata:Q…` (P625 of that entity) or `osm:way/…`, `osm:node/…`, `osm:relation/…` |
| `lat`, `lon`, `coordSource` | Written by `npm run sync:coords`. Never typed by hand |
| `photoRef` | Optional Wikidata entity whose image shows the place. It defaults to the `coordRef` entity, then `wikidataId` |
| `fact`, `factSource` | Required for Music, optional elsewhere |
| `year` | Optional. Shown for History only when `SHOW_HISTORY_YEAR` is on |

The point an item resolves to:

- A band uses its formation city (Wikidata P740).
- A solo artist uses their birthplace (P19).
- A historical event uses the site where it happened (for example, the Potsdam Conference resolves to Cecilienhof).

## Decisions and defaults

Where the brief left a choice open, these are the defaults:

- **Sport same-city rule.** No two of the three items in a round (anchor and both options) share a city. The city is the text before the first comma in `place`.
- **Ratio bands.** Each lower bound is inclusive and each upper bound is exclusive. Round 10's band is [1.15, 1.3), so the 50-point close-call bonus (ratio below 1.3) only appears from round 10 onward.
- **Endless length.** An Endless run is generated in full when it starts, up to `ENDLESS_MAX_ROUNDS` (20), so every round is guaranteed to exist. Clearing all 20 ends the run as a win.
- **Generator search.** The generator is a seeded depth-first search with backtracking. If one start item exhausts its node budget, it tries the next start item. It never relaxes a rule; if nothing works, it throws a `GenerationError`.
- **Share text.** It adds a third line with the points total. Rounds not reached after losing all three lives show as ⬜.
- **Validation window.** It covers `LAUNCH_DATE` plus 399 days. `LAUNCH_DATE` is `2026-10-01`.
- **Ryman Auditorium coordinates.** Wikidata's P625 for the Ryman (36.2068, -86.6921) is about 10 km off, near Opryland, so the Ryman uses OpenStreetMap way 130905906 instead.
- **Fall of the Berlin Wall.** It uses the Brandenburg Gate (Q82425), as the seed list specifies. Wikidata's event point is a generic East Berlin location.
- **Dolly Parton.** Wikidata P19 gives her birthplace as Pittman Center, Tennessee. The Elvis → Dolly fixture is therefore 511 km, not 501 km (+2.1%, outside the 2% tolerance), and the test uses 511.
- **Two brief fixtures can never be live rounds.** Their distances differ by less than 25 km:
  - Old Trafford: Anfield 44 km vs Headingley 61 km.
  - Bastille: Waterloo 250 km vs Hastings 266 km. This one is excluded even in Endless round 15 or later, where its 1.06 ratio alone would pass.

  The tests assert both.
