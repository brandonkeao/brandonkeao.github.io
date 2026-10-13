// Captures stage posters from the live scenes: `npm run build`, serve dist on 127.0.0.1:4217 (or BASE), then `node scripts/capture-collection-posters.mjs [collections|stages|poses|stories|all]` (default collections: {portfolio,playbooks}-{desktop,mobile}.jpg; stages: home-closeup-* and work-*.jpg with page masks and copy hidden; stories: formation/{full-time,fractional,advisory}.webp at 1152×1224, mid-story; poses: work-{full-time,fractional,advisory}-*.jpg, each way's settled moon) (Playwright from the repo or PLAYWRIGHT_FROM).
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  ({ chromium } = createRequire(process.env.PLAYWRIGHT_FROM || `${homedir()}/node_modules/`)('playwright'));
}
const base = process.env.BASE || 'http://127.0.0.1:4217';
const out = fileURLToPath(new URL('../public/images/orbit/', import.meta.url));
// Desktop at 1440×900 (the collection stage box is 760×520 since 2026-10-13); mobile at 390×844 (390×400).
const sizes = { desktop: [1440, 900], mobile: [390, 844] };
// The GPU on macOS (Metal), SwiftShader elsewhere.
const gl = process.platform === 'darwin' ? ['--use-angle=metal', '--enable-gpu'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const browser = await chromium.launch({ args: [...gl, '--ignore-gpu-blocklist'] });
const what = process.argv[2] || 'collections';
const want = (k) => what === k || what === 'all';
for (const scene of want('collections') ? ['portfolio', 'playbooks'] : []) {
  for (const [name, [width, height]] of Object.entries(sizes)) {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.goto(`${base}/${scene}/?scene-t=poster`);
    await page.waitForFunction(() => document.querySelector('.map-stage')?.classList.contains('is-ready'), null, { timeout: 30000 });
    await page.waitForTimeout(1500); // the canvas cross-fade
    const r = await page.locator('.scene-host canvas').evaluate((c) => { const b = c.getBoundingClientRect(); return { x: b.x, y: b.y + scrollY, width: b.width, height: b.height }; });
    const clip = { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
    await page.screenshot({ path: `${out}${scene}-${name}.jpg`, type: 'jpeg', quality: 90, clip, fullPage: true });
    console.log(`${scene}-${name}.jpg`);
    await page.close();
  }
}

// Orbital stages (Home close-up, Work with me overview): the live map after it settles, with the
// copy and header hidden and the page's CSS masks lifted, so the poster carries the raw frame and
// the page applies its masks to it as it does to the canvas.
const lift = `.hero-copy, header, .site-head { visibility: hidden !important; }
  .scene-host { -webkit-mask-image: none !important; mask-image: none !important; }`;
for (const [file, path] of want('stages') ? [['home-closeup', '/'], ['work', '/services/']] : []) {
  for (const [name, [width, height]] of Object.entries(sizes)) {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.goto(`${base}${path}`);
    await page.waitForFunction(() => document.querySelector('.map-stage')?.classList.contains('is-ready'), null, { timeout: 30000 });
    await page.addStyleTag({ content: lift });
    await page.waitForTimeout(3000);
    const r = await page.locator('.scene-host canvas').evaluate((c) => { const b = c.getBoundingClientRect(); return { x: b.x, y: b.y + scrollY, width: b.width, height: b.height }; });
    const clip = { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
    await page.screenshot({ path: `${out}${file}-${name}.jpg`, type: 'jpeg', quality: 90, clip, fullPage: true });
    console.log(`${file}-${name}.jpg`, clip.width, clip.height);
    await page.close();
  }
}

// Work with me's selected stills (ticket #21): each way's moon after the stage settles on it,
// shown in place of the live stage under reduced motion or without WebGL.
for (const id of want('poses') ? ['full-time', 'fractional', 'advisory'] : []) {
  for (const [name, [width, height]] of Object.entries(sizes)) {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.goto(`${base}/services/?engagement=${id}`);
    await page.evaluate(() => scrollTo(0, 0));
    await page.waitForFunction(() => { const s = document.querySelector('.map-stage'); return s?.classList.contains('is-ready') && s.dataset.mode === 'collection'; }, null, { timeout: 30000 });
    await page.addStyleTag({ content: lift });
    await page.waitForTimeout(3000);
    const r = await page.locator('.scene-host canvas').evaluate((c) => { const b = c.getBoundingClientRect(); return { x: b.x, y: b.y + scrollY, width: b.width, height: b.height }; });
    const clip = { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) };
    await page.screenshot({ path: `${out}work-${id}-${name}.jpg`, type: 'jpeg', quality: 90, clip, fullPage: true });
    console.log(`work-${id}-${name}.jpg`, clip.width, clip.height);
    await page.close();
  }
}

// Story scenes (Work with me): each model's story at mid-story (progress 0.5). The window is
// sized so the story box has the poster's 1152:1224 shape (583×620 CSS px at 1332×1000) and the
// scale factor makes the capture 1152×1224 (the renderer's own 1.5x cap means a mild upscale).
for (const slug of want('stories') ? ['full-time', 'fractional', 'advisory'] : []) {
  const page = await browser.newPage({ viewport: { width: 1332, height: 1000 }, deviceScaleFactor: 1152 / 583 });
  await page.goto(`${base}/services/?engagement=${slug}`);
  await page.waitForTimeout(2500);
  // Scroll so the reading line sits halfway down the second of three beats (p = 0.5).
  const scrollToMid = () => page.evaluate((slug) => {
    const story = document.querySelector(`[data-story="${slug}"]`);
    const c = story.querySelectorAll('[data-story-step] .step-copy')[1].getBoundingClientRect();
    scrollBy(0, c.top + c.height / 2 - innerHeight * 0.6);
  }, slug);
  await scrollToMid();
  await page.waitForFunction((slug) => document.querySelector(`[data-story="${slug}"]`)?.classList.contains('is-live'), slug, { timeout: 30000 });
  await scrollToMid();
  await page.waitForTimeout(3000); // the scene fades in and the camera eases to the beat
  const box = await page.locator(`[data-story="${slug}"] .story-media`).boundingBox();
  const png = await page.screenshot({ clip: { x: box.x, y: box.y, width: box.width, height: box.height } });
  // WebP through sharp (already installed with Astro's image service).
  const { default: sharp } = await import('sharp');
  const info = await sharp(png).resize(1152, 1224, { fit: 'cover' }).webp({ quality: 80 }).toFile(`${out}formation/${slug}.webp`);
  console.log(`formation/${slug}.webp`, info.width, info.height, 'box', Math.round(box.width), Math.round(box.height));
  await page.close();
}
await browser.close();
