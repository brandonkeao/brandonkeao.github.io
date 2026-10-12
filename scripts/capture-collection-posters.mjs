// Captures the Portfolio/Playbooks hero posters (public/images/orbit/{portfolio,playbooks}-{desktop,mobile}.jpg) from the live scenes' settled frame: `npm run build`, serve dist on 127.0.0.1:4217, then `node scripts/capture-collection-posters.mjs` (Playwright from the repo or PLAYWRIGHT_FROM).
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
// Desktop at 1440×900 (the stage box is 760×630, the clamp's middle); mobile at 390×844 (390×400).
const sizes = { desktop: [1440, 900], mobile: [390, 844] };
// The GPU on macOS (Metal), SwiftShader elsewhere.
const gl = process.platform === 'darwin' ? ['--use-angle=metal', '--enable-gpu'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'];
const browser = await chromium.launch({ args: [...gl, '--ignore-gpu-blocklist'] });
for (const scene of ['portfolio', 'playbooks']) {
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
await browser.close();
