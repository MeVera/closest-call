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
| `npm run screenshots` | Playwright: plays through every screen at 390×844 and 1280×800, in light and dark mode. It checks for console errors and horizontal scroll, and writes `screenshots/<project>/*.png` (git-ignored). The first time, run `npx playwright install chromium` |

### Playing before the data is complete

A daily needs at least 21 places per theme, and an Endless run needs 41. Until the pools are expanded, production builds show a "not ready yet" message for each theme. On the dev server, add `?demo` to pad every theme with synthetic filler points, so the whole game can be played and tested:

```
http://localhost:5173/?demo#/daily/music
```

Demo mode is compiled out of production builds (`import.meta.env.DEV`), and a striped banner marks it on screen.

Set `CLOSEST_CALL_CONTACT` (an email address or URL) before running the network scripts, so Wikimedia and OSM can reach you, as their User-Agent policies ask:

```bash
CLOSEST_CALL_CONTACT="you@yourdomain" npm run fetch:photos
```

## Deploying

Run `npm run build`, then upload `dist/` to any static host: Netlify, Vercel or GitHub Pages. No rewrites or server are needed, because routes use the URL hash and asset paths are relative (`base: './'`).

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

## Interface

The app uses hash routes, so it works on any static host with no rewrite rules:

| Route | Page |
| --- | --- |
| `#/` | Home: themes, today's status, daily streak, countdown |
| `#/daily/<theme>` | Today's daily (`sport`, `music`, `geography`, `history`) |
| `#/endless/<theme>` | An Endless run |
| `#/archive` | Past days, from `LAUNCH_DATE` up to yesterday |
| `#/archive/<YYYY-MM-DD>/<theme>` | Replay a past day. It never counts toward the daily streak |
| `#/credits` | Every photo credit, plus Natural Earth, Wikidata and OpenStreetMap |

- **Keyboard.** Press `1` or `←` for the left option and `2` or `→` for the right. After a reveal, focus moves to Next, so `Enter` continues. Everything else is reachable with `Tab`, and focus rings are visible.
- **Map.** The map is drawn with d3-geo in an azimuthal-equidistant projection centred on the anchor, so both great-circle lines are straight and their lengths are true to scale. It uses Natural Earth 1:50m land and borders (via `world-atlas`), loaded once on the first reveal. There are no tile servers and no API keys.
- **Saved data.** localStorage (key prefix `cc:v1:`) holds:
  - Daily progress per date and theme, so a refresh resumes where you were.
  - Archive results.
  - The days with a completed daily, which drive the daily streak.
  - Best daily score and best Endless streak per theme.
  - The km/mi setting.

  Every access is wrapped in try/catch, so the game still works without storage.
- **Midnight.** A daily keeps the date it started with, so a run that crosses midnight finishes the same puzzle.

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

## Photos

`npm run fetch:photos` uses only openly licensed Wikimedia Commons images, all hosted on this site and never hotlinked.

- **Where photos come from.** The fetcher checks three sources in order:
  1. A pinned file in `data/photo-overrides.json`.
  2. The Wikidata image (P18) of the photo entity. That entity is `photoRef`, then the `coordRef` entity, then `wikidataId`, so a band shows its city and an event shows its site.
  3. A Commons search for the site's name.
- **Licences.** CC0, public domain, CC BY and CC BY-SA are accepted. NonCommercial, NoDerivatives, non-free, and files with no author under an attribution licence are rejected.
- **Image choice.** A landscape image at least 1200 px wide is preferred. Filenames that look like logos, maps, posters, portraits, paintings or archive photos are skipped automatically.
- **Output.** The fetcher downloads an image about 900 px wide and converts it to `public/photos/<id>.webp` (800 px wide, quality 75). It writes `data/photo-credits.json` (file, author, licence, licence URL, Commons page) and rebuilds `photo-review/contact-sheet.html`.
- **Re-running.** Items that already have a photo and credit are skipped. Use `-- --only id1,id2` to refetch specific items, `-- --force` to refetch all of them, and `-- --verbose` to see why each candidate was rejected.
- **Rate limits.** Requests are throttled to about 1 per second and retried after HTTP 429.
- **Fixing a bad pick.** Add `"item-id": "File:Exact name.jpg"` to `data/photo-overrides.json`, then run `npm run fetch:photos -- --only item-id`. A pinned file still has to pass the licence policy, and a rejected override is an error rather than a silent fallback.

Seed items pinned after manual review:

| Item | Pinned photo | Reason |
| --- | --- | --- |
| Headingley | Headingley Stadium | The P18 has no author, and the search found a cinema |
| Yalta Conference | Livadia Palace exterior | The P18 has no author, and the search found a photo of the leaders |
| Elvis Presley | Downtown Tupelo | The P18 was Tupelo's airport |
| Johnny Cash | Old US 79, Kingsland | The only real photo in Commons' Kingsland, Arkansas category; it's portrait |
| Dolly Parton | Emert's Cove covered bridge, Pittman Center | The P18 is too small |
| Sun Studio | Sun Studio facade | The search found an interior with tourists |
