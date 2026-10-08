import { expect, test, type Page } from '@playwright/test';

async function shot(page: Page, project: string, name: string, fullPage = false) {
  await page.waitForFunction(() => [...document.images].every((i) => i.complete && i.naturalWidth > 0));
  await page.screenshot({ path: `screenshots/${project}/${name}.png`, fullPage, animations: 'disabled' });
}

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, 'page should not scroll horizontally').toBeLessThanOrEqual(0);
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  (page as unknown as { errors: string[] }).errors = errors;
});

test.afterEach(async ({ page }) => {
  expect((page as unknown as { errors: string[] }).errors).toEqual([]);
});

test('home, archive and credits', async ({ page }, info) => {
  await page.goto('/#/');
  await expect(page.getByRole('heading', { name: /closer/i })).toBeVisible();
  await noHorizontalScroll(page);
  await shot(page, info.project.name, '01-home');
  await page.goto('/#/archive');
  await noHorizontalScroll(page);
  await shot(page, info.project.name, '07-archive');
  await page.goto('/#/credits');
  await noHorizontalScroll(page);
  await shot(page, info.project.name, '08-credits');
});

test('daily: choose, reveal, end', async ({ page }, info) => {
  await page.goto('/#/daily/music');
  await expect(page.getByText('Round 1 of 10')).toBeVisible();
  await noHorizontalScroll(page);
  await shot(page, info.project.name, '02-choose');

  await page.keyboard.press('1');
  await expect(page.getByRole('button', { name: /Next round/ })).toBeFocused();
  await page.waitForTimeout(1200); // map line animation
  await noHorizontalScroll(page);
  await shot(page, info.project.name, '03-reveal');
  await shot(page, info.project.name, '03-reveal-full', true);

  for (let i = 0; i < 30; i++) {
    const next = page.getByRole('button', { name: /Next round|See results/ });
    if (await next.count()) {
      await next.click();
      continue;
    }
    if (await page.getByRole('heading', { name: /Share your result/ }).count()) break;
    await page.keyboard.press(i % 3 ? '1' : '2');
  }
  await expect(page.getByRole('heading', { name: /Share your result/ })).toBeVisible();
  await noHorizontalScroll(page);
  await shot(page, info.project.name, '04-daily-end');
  await shot(page, info.project.name, '04-daily-end-full', true);
});

test('endless: choose and end', async ({ page }, info) => {
  await page.goto('/#/endless/history');
  await shot(page, info.project.name, '05-endless-choose');
  for (let i = 0; i < 50; i++) {
    const next = page.getByRole('button', { name: /Next round|See results/ });
    if (await next.count()) {
      await next.click();
      continue;
    }
    if (await page.getByRole('button', { name: 'Play again' }).count()) break;
    await page.keyboard.press(i % 4 ? '1' : '2');
  }
  await expect(page.getByRole('button', { name: 'Play again' })).toBeVisible();
  await noHorizontalScroll(page);
  await shot(page, info.project.name, '06-endless-end');
});
