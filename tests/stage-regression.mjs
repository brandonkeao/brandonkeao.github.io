import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const base = (process.env.SITE_URL ?? 'http://127.0.0.1:4321').replace(/\/$/, '');
assert(['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname), 'SITE_URL must be local');
const output = process.env.RESULT_PATH;
const browser = await chromium.launch({ args: process.platform === 'darwin' ? ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] : [] });
const results = [];
async function page(options = {}) {
  const p = await browser.newPage({ viewport: { width: 1440, height: 900 }, ...options });
  p.errors = [];
  p.on('pageerror', e => p.errors.push(e.message));
  await p.route('https://**/*', r => r.abort());
  await p.addInitScript(() => {
    window.__review = { loads: 0, maxWidth: 0, flashSeen: false };
    document.addEventListener('astro:page-load', () => window.__review.loads++);
    const sample = () => {
      window.__review.maxWidth = Math.max(window.__review.maxWidth, document.documentElement.scrollWidth);
      window.__review.flashSeen ||= !!document.querySelector('.meteor-flash');
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  return p;
}
async function test(name, fn) {
  let p;
  try {
    p = await page(fn.options);
    const evidence = await fn(p);
    const pass = evidence.pass && p.errors.length === 0;
    results.push({ name, ...evidence, pass, errors: p.errors });
  } catch (error) { results.push({ name, pass: false, error: String(error) }); }
  finally { await p?.close(); }
  if (output) writeFileSync(output, JSON.stringify({ base, results }, null, 2));
  console.log(JSON.stringify(results.at(-1)));
}
const stageState = p => p.evaluate(() => {
  const stage = document.querySelector('.map-stage');
  const visiblePoster = [...(stage?.querySelectorAll('.stage-poster img,.stage-pose img') ?? [])].some(image => image.getBoundingClientRect().width > 0 && Number(getComputedStyle(image).opacity) > 0.9 && image.complete && image.naturalWidth > 0);
  return {
    stage: stage?.className, mode: stage?.dataset.mode,
    posterVisible: visiblePoster,
    selected: document.querySelector('[data-wwm-tab][aria-pressed="true"]')?.getAttribute('data-wwm-tab'),
    query: location.search,
    canvasCount: document.querySelectorAll('.scene-host canvas').length,
    renderedFrames: Number(stage?.querySelector('.scene-host')?.getAttribute('data-frame-count') ?? 0),
    heavyResources: performance.getEntriesByType('resource').filter(e => /\/(?:map-scene|formation-craft|collection-scene)\./.test(e.name)).map(e => e.name.split('/').pop())
  };
});
await test('Reduced-motion home keeps its poster and does not fetch WebGL', Object.assign(async p => {
  await p.goto(base + '/'); await p.waitForTimeout(2200);
  const state = await stageState(p);
  return { pass: state.posterVisible && state.canvasCount === 0 && state.heavyResources.length === 0, state };
}, { options: { reducedMotion: 'reduce' } }));
await test('Selected Work with me has a visible fallback without WebGL', async p => {
  await p.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (kind, ...args) { return String(kind).startsWith('webgl') ? null : original.call(this, kind, ...args); };
  });
  await p.goto(base + '/services/?engagement=fractional'); await p.waitForTimeout(1800);
  const first = await stageState(p);
  await p.locator('.engagement-chip[data-id]:visible').last().click(); await p.waitForTimeout(300);
  const second = await stageState(p);
  return { pass: first.posterVisible && second.posterVisible && second.selected === 'advisory', first, second };
});
await test('Context loss restores poster and leaves selection usable', async p => {
  await p.goto(base + '/services/?engagement=fractional');
  await p.waitForSelector('.map-stage.is-ready', { timeout: 15000 });
  const lost = await p.evaluate(() => {
    const gl = document.querySelector('.scene-host canvas')?.getContext('webgl2');
    const extension = gl?.getExtension('WEBGL_lose_context'); extension?.loseContext(); return !!extension;
  });
  await p.waitForTimeout(700);
  const failed = await stageState(p);
  await p.locator('.engagement-chip[data-id]:visible').last().click(); await p.waitForTimeout(1100);
  const switched = await stageState(p);
  return { pass: lost && failed.posterVisible && switched.posterVisible && switched.selected === 'advisory', lost, failed, switched };
});
for (const route of ['portfolio', 'playbooks']) await test(route + ' Back/Forward preserves the page and canvas', async p => {
  await p.goto(base + '/' + route + '/'); await p.waitForTimeout(1600);
  const before = await p.evaluate(() => {
    window.__savedCanvas = document.querySelector('.scene-host canvas');
    window.__savedCollection = document.querySelector('[data-collection]');
    return window.__review.loads;
  });
  await p.locator('[data-cl-select]').first().click();
  const first = await p.locator('[data-collection]').getAttribute('data-cl-state');
  await p.locator('[data-cl-tab]').nth(1).click();
  const second = await p.locator('[data-collection]').getAttribute('data-cl-state');
  await p.evaluate(() => history.back()); await p.waitForTimeout(900);
  const back = await p.locator('[data-collection]').getAttribute('data-cl-state');
  await p.evaluate(() => history.forward()); await p.waitForTimeout(900);
  const forward = await p.locator('[data-collection]').getAttribute('data-cl-state');
  const identity = await p.evaluate(() => ({ loads: window.__review.loads, sameCanvas: window.__savedCanvas === document.querySelector('.scene-host canvas'), sameCollection: window.__savedCollection === document.querySelector('[data-collection]') }));
  return { pass: back === first && forward === second && identity.loads === before && identity.sameCanvas && identity.sameCollection, before, first, second, back, forward, identity };
});
await test('Astro navigation preserves the JavaScript enhancement marker', async p => {
  await p.goto(base + '/about/');
  await p.locator('header a[href="/"]').first().click();
  await p.waitForURL(base + '/'); await p.waitForTimeout(900);
  const js = await p.evaluate(() => document.documentElement.classList.contains('js'));
  return { pass: js, js };
});
for (const width of [1440, 1280, 390]) await test('Meteor stays within viewport at ' + width, Object.assign(async p => {
  await p.goto(base + '/'); await p.waitForTimeout(6500);
  const state = await p.evaluate(() => ({ ...window.__review, width: innerWidth }));
  return { pass: state.flashSeen && state.maxWidth <= state.width, state };
}, { options: { viewport: { width, height: 900 } } }));
await test('Reduced-motion selected services shows a still without WebGL', Object.assign(async p => {
  await p.goto(base + '/services/?engagement=fractional'); await p.waitForTimeout(1500);
  const state = await stageState(p);
  return { pass: state.posterVisible && state.canvasCount === 0 && state.heavyResources.length === 0 && state.selected === 'fractional', state };
}, { options: { reducedMotion: 'reduce' } }));
await test('Cross-page Forward restores the selected services stage', async p => {
  await p.goto(base + '/about/');
  await p.locator('header a[href="/services/"]').first().evaluate(link => { link.href = '/services/?engagement=fractional'; link.click(); });
  await p.waitForURL(base + '/services/?engagement=fractional');
  await p.waitForSelector('.map-stage.is-ready');
  await p.evaluate(() => history.back()); await p.waitForURL(base + '/about/');
  await p.waitForFunction(() => !document.querySelector('.map-stage[data-orbit="work"]'));
  await p.evaluate(() => history.forward()); await p.waitForURL(base + '/services/?engagement=fractional');
  await p.waitForTimeout(1000);
  const state = await stageState(p);
  return { pass: (state.posterVisible || (state.stage?.includes('is-ready') && state.canvasCount === 1 && state.renderedFrames > 0)) && state.selected === 'fractional', state };
});
await test('Phone selection and offscreen moon switch settle promptly', Object.assign(async p => {
  await p.goto(base + '/services/'); await p.waitForSelector('.map-stage.is-ready');
  await p.locator('[data-wwm-choose="fractional"]').click();
  await p.waitForFunction(() => document.querySelector('.map-stage')?.getAttribute('data-mode') === 'collection', null, { timeout: 1500 });
  await p.locator('[data-wwm-switcher]').scrollIntoViewIfNeeded();
  const first = await stageState(p);
  const start = Date.now();
  await p.locator('[data-wwm-tab="advisory"]').click();
  await p.waitForFunction(() => document.querySelector('.map-stage')?.getAttribute('data-mode') === 'collection', null, { timeout: 1500 });
  const elapsed = Date.now() - start;
  const second = await stageState(p);
  return { pass: first.selected === 'fractional' && second.selected === 'advisory' && elapsed <= 1500, first, second, elapsed };
}, { options: { viewport: { width: 390, height: 844 } } }));
await browser.close();
process.exitCode = results.every(result => result.pass) ? 0 : 1;
