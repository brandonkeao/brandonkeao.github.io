import assert from 'node:assert/strict';
import { chromium } from 'playwright';

// Run against a production build served by `npm run preview`. These tests are local-only:
// analytics and web fonts are blocked so network availability cannot mask routing defects.
const base = new URL(process.env.SITE_URL ?? 'http://127.0.0.1:4321');
assert(['localhost', '127.0.0.1', '[::1]'].includes(base.hostname), 'SITE_URL must be local');
const browser = await chromium.launch({
  args: process.platform === 'darwin' ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] : [],
});
let failures = 0;
async function test(name, options, run) {
  const page = await browser.newPage(options);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://**/*', route => route.abort());
  await page.addInitScript(() => {
    window.__navigationTest = { loads: 0 };
    document.addEventListener('astro:page-load', () => window.__navigationTest.loads++);
  });
  try {
    await run(page);
    assert.deepEqual(errors, [], 'No uncaught browser errors');
    console.log(`PASS ${name}`);
  } catch (error) {
    failures++;
    console.error(`FAIL ${name}: ${error.stack}`);
  } finally { await page.close(); }
}
const url = path => new URL(path, base).href;
const state = page => page.locator('[data-collection]').getAttribute('data-cl-state');
async function waitState(page, expected) {
  await page.waitForFunction(value => document.querySelector('[data-collection]')?.getAttribute('data-cl-state') === value, expected);
}
async function history(page, direction) {
  await page.evaluate(direction => window.history[direction](), direction);
}

for (const width of [1440, 390]) {
  for (const route of ['portfolio', 'playbooks']) {
    await test(`${route}: selection, Back/Forward, and cross-page return at ${width}px`, { viewport: { width, height: 900 } }, async page => {
      await page.goto(url(`/${route}/`));
      await page.waitForSelector('.map-stage.is-ready');
      const before = await page.evaluate(() => {
        window.__navigationTest.root = document.querySelector('[data-collection]');
        window.__navigationTest.canvas = document.querySelector('.scene-host canvas');
        return window.__navigationTest.loads;
      });
      await page.locator('[data-cl-select]').first().click();
      const first = await state(page);
      await page.locator('[data-cl-tab]').nth(1).click();
      const second = await state(page);
      assert.notEqual(first, second);
      const selectedUrl = page.url();
      await history(page, 'back'); await waitState(page, first);
      await history(page, 'forward'); await waitState(page, second);
      // Also allow a mistakenly started Astro navigation to finish before testing identity.
      await page.waitForTimeout(400);
      const identity = await page.evaluate(() => ({
        loads: window.__navigationTest.loads,
        root: window.__navigationTest.root === document.querySelector('[data-collection]'),
        canvas: window.__navigationTest.canvas === document.querySelector('.scene-host canvas'),
      }));
      assert.deepEqual(identity, { loads: before, root: true, canvas: true });
      await page.locator('header a[href="/about/"]').first().evaluate(link => link.click());
      await page.waitForURL(url('/about/'));
      await page.waitForFunction(() => !!document.querySelector('main') && !document.querySelector('[data-collection]'));
      await history(page, 'back');
      await page.waitForURL(selectedUrl); await waitState(page, second);
      assert.equal(await page.evaluate(() => document.documentElement.classList.contains('js')), true);
      await history(page, 'forward'); await page.waitForURL(url('/about/'));
      await page.waitForFunction(() => !document.querySelector('[data-collection]'));
    });
  }
}

await test('Repeated client navigation restores html.js on every page', {}, async page => {
  await page.goto(url('/about/'));
  for (const path of ['/', '/portfolio/', '/playbooks/', '/about/']) {
    await page.locator(`header a[href="${path}"]`).first().evaluate(link => link.click());
    await page.waitForURL(url(path));
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains('js')), true, path);
  }
});

await test('Reduced-motion collection history works without a canvas', { reducedMotion: 'reduce' }, async page => {
  await page.goto(url('/portfolio/'));
  await page.locator('[data-cl-select]').first().click();
  const first = await state(page);
  await page.locator('[data-cl-tab]').nth(1).click();
  await history(page, 'back'); await waitState(page, first);
  assert.equal(await page.locator('.scene-host canvas').count(), 0);
});

await test('Without JavaScript the collection rows remain real links and details readable', { javaScriptEnabled: false }, async page => {
  await page.goto(url('/portfolio/'));
  const row = page.locator('[data-cl-select]').first();
  const param = await page.locator('[data-collection]').getAttribute('data-param');
  const href = new URL(await row.getAttribute('href'), page.url());
  assert.equal(href.searchParams.get(param), await row.getAttribute('data-cl-select'));
  assert.equal(await row.isVisible(), true);
  assert.equal(await page.locator('[data-cl-detail]').first().isVisible(), true);
});

await browser.close();
process.exitCode = failures ? 1 : 0;
