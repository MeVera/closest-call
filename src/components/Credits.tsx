import { THEMES } from '../config';
import { CREDITS, realItems } from '../data';
import { THEME_LABELS } from '../lib/share';
import { TopBar } from './TopBar';

export function Credits() {
  const usesOsm = THEMES.some((t) => realItems(t).some((i) => i.coordRef.startsWith('osm:')));
  return (
    <div className="screen">
      <TopBar />
      <main className="credits" id="main">
        <h1>Credits</h1>

        <section>
          <h2>Map and location data</h2>
          <ul className="credit-list">
            <li>
              Land and borders: <a href="https://www.naturalearthdata.com/">Natural Earth</a> 1:50m (public domain), via{' '}
              <a href="https://github.com/topojson/world-atlas">world-atlas</a>.
            </li>
            <li>
              Coordinates: <a href="https://www.wikidata.org/">Wikidata</a> (CC0)
              {usesOsm && (
                <>
                  {' '}
                  and <a href="https://www.openstreetmap.org/copyright">© OpenStreetMap contributors</a> (ODbL)
                </>
              )}
              . Each item links to its source in the data files.
            </li>
            <li>Facts are checked against the Wikipedia articles linked on each reveal.</li>
          </ul>
        </section>

        {THEMES.map((t) => (
          <section key={t}>
            <h2>{THEME_LABELS[t]} photos</h2>
            <ul className="credit-list">
              {realItems(t).map((item) => {
                const c = CREDITS[item.id];
                if (!c) return null;
                return (
                  <li key={item.id}>
                    <strong>{item.name}</strong>:{' '}
                    <a href={c.pageUrl} target="_blank" rel="noopener noreferrer">
                      {c.file.replace(/^File:/, '')}
                    </a>{' '}
                    by {c.author},{' '}
                    <a href={c.licenceUrl} target="_blank" rel="noopener noreferrer license">
                      {c.licence}
                    </a>
                    . Resized and converted to WebP.
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </main>
    </div>
  );
}
