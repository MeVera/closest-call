// Builds photo-review/contact-sheet.html: every item's photo with its name and credit,
// grouped by theme, with missing photos flagged. Open the file directly in a browser.

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { THEMES } from '../src/config';
import { loadCredits, loadTheme, PHOTOS_DIR, ROOT } from './lib';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

export function buildContactSheet(): string {
  const outDir = path.join(ROOT, 'photo-review');
  fs.mkdirSync(outDir, { recursive: true });
  const credits = loadCredits();
  let total = 0;
  let missing = 0;

  const sections = THEMES.map((theme) => {
    const cards = loadTheme(theme)
      .map((it) => {
        total++;
        const c = credits[it.id];
        const hasPhoto = fs.existsSync(path.join(PHOTOS_DIR, `${it.id}.webp`));
        if (!hasPhoto || !c) missing++;
        const img = hasPhoto
          ? `<img src="../public/photos/${esc(it.id)}.webp" alt="${esc(it.name)}" loading="lazy">`
          : `<div class="missing">NO PHOTO</div>`;
        const credit = c
          ? `<a href="${esc(c.pageUrl)}" target="_blank">${esc(c.file.replace(/^File:/, ''))}</a><br>
             ${esc(c.author)} · <a href="${esc(c.licenceUrl)}" target="_blank">${esc(c.licence)}</a><br>
             <span class="meta">via ${c.via} · original ${c.width}×${c.height}${c.width <= c.height ? ' · <b>portrait</b>' : ''}</span>`
          : '<span class="bad">no credit</span>';
        return `<figure class="${hasPhoto && c ? '' : 'flag'}">${img}<figcaption>
          <strong>${esc(it.name)}</strong> <code>${esc(it.id)}</code><br>
          <span class="meta">${esc(it.place)} · ${esc(it.kind)}</span><br>${credit}</figcaption></figure>`;
      })
      .join('\n');
    return `<h2>${theme}</h2><div class="grid">${cards}</div>`;
  }).join('\n');

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Closest Call · photo contact sheet</title>
<style>
  :root { color-scheme: light dark; --bg:#f6f5f2; --fg:#1b1b1b; --muted:#666; --card:#fff; --bad:#c62828; }
  @media (prefers-color-scheme: dark) { :root { --bg:#141414; --fg:#eee; --muted:#9a9a9a; --card:#1f1f1f; } }
  body { font: 14px/1.4 system-ui, sans-serif; margin: 24px; background: var(--bg); color: var(--fg); }
  h1 { margin: 0 0 4px } h2 { text-transform: capitalize; margin: 32px 0 12px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
  figure { margin: 0; background: var(--card); border-radius: 10px; overflow: hidden; box-shadow: 0 1px 3px #0002; }
  figure.flag { outline: 3px solid var(--bad); }
  img, .missing { width: 100%; aspect-ratio: 3 / 2; object-fit: cover; display: block; }
  .missing { display: grid; place-items: center; color: var(--bad); font-weight: 700; background: #8881; }
  figcaption { padding: 10px 12px 12px; word-break: break-word; }
  .meta { color: var(--muted); font-size: 12px; } .bad { color: var(--bad); font-weight: 600; }
  a { color: inherit; } code { font-size: 11px; color: var(--muted); }
</style></head><body>
<h1>Photo contact sheet</h1>
<p class="meta">${total} items · ${missing} missing · generated ${new Date().toISOString()}.
To replace a pick, add <code>"item-id": "File:Name.jpg"</code> to data/photo-overrides.json and run
<code>npm run fetch:photos -- --only item-id</code>.</p>
${sections}
</body></html>`;
  const out = path.join(outDir, 'contact-sheet.html');
  fs.writeFileSync(out, html);
  return out;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log(buildContactSheet());
}
