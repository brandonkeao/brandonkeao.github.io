import assert from 'node:assert/strict';
import { chromium } from 'playwright';

// Release browser checks for the current staging design. Run against `npm run preview`.
const base = new URL(process.env.SITE_URL ?? 'http://127.0.0.1:4321');
assert(['localhost', '127.0.0.1', '[::1]'].includes(base.hostname), 'SITE_URL must be local');
const browser = await chromium.launch();
let failures = 0;

async function test(name, options, run) {
  const page = await browser.newPage(options);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('https://**/*', route => route.abort());
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
const selected = page => page.locator('[data-wwm-choose][aria-pressed="true"]').getAttribute('data-wwm-choose');

await test('Services deep link shows only the selected model', {}, async page => {
  await page.goto(url('/services/?engagement=fractional'));
  assert.equal(await selected(page), 'fractional');
  assert.equal(await page.locator('[data-wwm-detail="fractional"]').isVisible(), true);
  assert.equal(await page.locator('[data-wwm-detail="advisory"]').isVisible(), false);
  assert.equal(await page.locator('[data-wwm-overview]').first().isVisible(), false);
});

await test('Services selection and browser history stay in sync', {}, async page => {
  await page.goto(url('/services/'));
  assert.equal(await page.locator('[data-wwm]').getAttribute('data-state'), 'overview');
  await page.locator('[data-wwm-choose="fractional"]').click();
  assert.equal(await selected(page), 'fractional');
  assert.equal(new URL(page.url()).searchParams.get('engagement'), 'fractional');
  await page.locator('[data-wwm-choose="advisory"]').click();
  assert.equal(await selected(page), 'advisory');
  await page.evaluate(() => history.back());
  await page.waitForFunction(() => document.querySelector('[data-wwm-choose="fractional"]')?.getAttribute('aria-pressed') === 'true');
  assert.equal(await page.locator('[data-wwm-detail="fractional"]').isVisible(), true);
  await page.evaluate(() => history.forward());
  await page.waitForFunction(() => document.querySelector('[data-wwm-choose="advisory"]')?.getAttribute('aria-pressed') === 'true');
});

await test('Services selection works at phone width', { viewport: { width: 390, height: 844 } }, async page => {
  await page.goto(url('/services/'));
  await page.locator('[data-wwm-choose="full-time"]').click();
  assert.equal(await selected(page), 'full-time');
  assert.equal(await page.locator('[data-wwm-detail="full-time"]').isVisible(), true);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
});

await test('Services choices remain usable without JavaScript', { javaScriptEnabled: false }, async page => {
  await page.goto(url('/services/'));
  const card = page.locator('[data-wwm-choose="fractional"]');
  assert.equal(await card.isVisible(), true);
  assert.equal(new URL(await card.getAttribute('href'), page.url()).searchParams.get('engagement'), 'fractional');
  assert.equal(await page.locator('[data-wwm-overview]').first().isVisible(), true);
});

await test('Custom 404 has recovery links and is excluded from indexing', {}, async page => {
  await page.goto(url('/404.html'));
  assert.equal(await page.locator('h1').innerText(), 'Page not found');
  assert.match(await page.locator('meta[name="robots"]').getAttribute('content'), /\bnoindex\b/);
  assert.equal(await page.locator('a[href="/"]').count() > 0, true);
  assert.equal(await page.locator('a[href="/contact/"]').count() > 0, true);
});

await browser.close();
process.exitCode = failures ? 1 : 0;
