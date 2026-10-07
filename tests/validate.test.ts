import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { THEMES } from '../src/config';
import type { Item, PhotoCredits } from '../src/types';
import { ROOT } from '../scripts/lib';
import { checkGeneration, validateItems } from '../scripts/validation';
import { syntheticPool } from './helpers';

const goodItem = (over: Partial<Item> = {}): Item => ({
  id: 'test-item',
  theme: 'music',
  name: 'Test',
  place: 'Somewhere, Earth',
  kind: 'studio',
  lat: 1,
  lon: 2,
  wikidataId: 'Q1',
  coordRef: 'wikidata:Q1',
  coordSource: 'https://www.wikidata.org/wiki/Q1#P625',
  hint: 'A hint',
  fact: 'A fact.',
  factSource: 'https://en.wikipedia.org/wiki/Test',
  ...over,
});

const credit = {
  file: 'File:Test.jpg',
  author: 'Someone',
  licence: 'CC BY-SA 4.0',
  licenceUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
  pageUrl: 'https://commons.wikimedia.org/wiki/File:Test.jpg',
  via: 'p18' as const,
  width: 800,
  height: 533,
};

function withPhotos(ids: string[]): { photosDir: string; credits: PhotoCredits } {
  const photosDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-photos-'));
  for (const id of ids) fs.writeFileSync(path.join(photosDir, `${id}.webp`), 'x');
  return { photosDir, credits: Object.fromEntries(ids.map((id) => [id, credit])) };
}

describe('validateItems', () => {
  const opts = withPhotos(['test-item']);
  const run = (items: unknown[], theme = 'music', o = opts) => validateItems({ [theme]: items }, o);

  it('accepts a good item', () => {
    expect(run([goodItem()])).toEqual([]);
  });
  it('fails without coordinates', () => {
    expect(run([{ ...goodItem(), lat: undefined }]).join()).toMatch(/missing coordinates/);
  });
  it('fails with coordinates out of range', () => {
    expect(run([goodItem({ lat: 91 })]).join()).toMatch(/out of range/);
    expect(run([goodItem({ lon: -181 })]).join()).toMatch(/out of range/);
  });
  it('fails without a coordinate source', () => {
    expect(run([goodItem({ coordSource: '' })]).join()).toMatch(/coordSource/);
    expect(run([goodItem({ coordSource: 'https://maps.google.com/x' })]).join()).toMatch(/coordSource/);
  });
  it('fails without a photo or credit', () => {
    expect(run([goodItem()], 'music', withPhotos([])).join()).toMatch(/no photo.*no photo credit|no photo/);
    const noCredit = { ...withPhotos(['test-item']), credits: {} };
    expect(run([goodItem()], 'music', noCredit).join()).toMatch(/no photo credit/);
  });
  it('fails on a non-free licence', () => {
    const o = withPhotos(['test-item']);
    o.credits['test-item'] = { ...credit, licence: 'CC BY-NC 2.0' };
    expect(run([goodItem()], 'music', o).join()).toMatch(/not accepted/);
  });
  it('fails when a Music item lacks a fact or fact source', () => {
    expect(run([goodItem({ fact: undefined })]).join()).toMatch(/need a fact/);
    expect(run([goodItem({ factSource: undefined })]).join()).toMatch(/factSource/);
  });
  it('fails when a Geography item is not a landmark or capital', () => {
    expect(run([goodItem({ theme: 'geography', kind: 'stadium' })], 'geography').join()).toMatch(
      /landmark or a capital/,
    );
  });
  it('fails on duplicate ids, even across themes', () => {
    const errs = validateItems(
      { music: [goodItem()], sport: [goodItem({ theme: 'sport', kind: 'stadium' })] },
      opts,
    );
    expect(errs.join()).toMatch(/duplicate id/);
  });
});

describe('checkGeneration', () => {
  it('passes on a healthy pool', () => {
    const r = checkGeneration('geography', syntheticPool('geography'), 30, 20);
    expect(r.dailyFailures).toEqual([]);
    expect(r.endlessFailures).toEqual([]);
  });
  it('reports failures on a pool that is too small', () => {
    const r = checkGeneration('geography', syntheticPool('geography', 8), 5, 5);
    expect(r.dailyFailures.length).toBeGreaterThan(0);
    expect(r.dailyFailures[0].reason).toMatch(/at least 21/);
  });
});

describe('validate:data CLI', () => {
  const runCli = (dataDir: string, photosDir: string) =>
    spawnSync(
      process.execPath,
      ['--import', 'tsx', path.join(ROOT, 'scripts/validate-data.ts'), '--data-dir', dataDir, '--photos-dir', photosDir],
      { cwd: ROOT, encoding: 'utf8' },
    );

  function writeData(mutate: (items: Record<string, Item[]>) => void) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-data-'));
    const items = Object.fromEntries(THEMES.map((t) => [t, syntheticPool(t, 70)])) as Record<string, Item[]>;
    mutate(items);
    const ids = Object.values(items).flat().map((i) => i.id);
    const { photosDir, credits } = withPhotos(ids);
    for (const t of THEMES) fs.writeFileSync(path.join(dir, `${t}.json`), JSON.stringify(items[t]));
    fs.writeFileSync(path.join(dir, 'photo-credits.json'), JSON.stringify(credits));
    return { dir, photosDir };
  }

  it('exits 1 on bad data', () => {
    const { dir, photosDir } = writeData((d) => {
      d.music[0].fact = undefined;
    });
    const res = runCli(dir, photosDir);
    expect(res.status).toBe(1);
    expect(res.stdout).toMatch(/Music items need a fact/);
  });

  it('exits 1 when generation fails', () => {
    const { dir, photosDir } = writeData((d) => {
      d.history = d.history.slice(0, 10);
    });
    const res = runCli(dir, photosDir);
    expect(res.status).toBe(1);
    expect(res.stdout).toMatch(/✗ history/);
  });
});
