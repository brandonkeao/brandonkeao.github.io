import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';

const port = await new Promise((resolve, reject) => {
  const probe = createServer();
  probe.once('error', reject);
  probe.listen(0, '127.0.0.1', () => {
    const selected = probe.address().port;
    probe.close(() => resolve(selected));
  });
});
const base = `http://127.0.0.1:${port}/`;
const preview = spawn('node', ['node_modules/astro/bin/astro.mjs', 'preview', '--host', '127.0.0.1', '--port', String(port), '--ignore-lock'], {
  stdio: ['ignore', 'inherit', 'inherit'],
  env: process.env,
});

async function ready() {
  for (let attempt = 0; attempt < 40; attempt++) {
    if (preview.exitCode !== null) throw new Error('Preview server exited before it was ready');
    try {
      const response = await fetch(base, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch {
      // The local server is still starting.
    }
    await delay(250);
  }
  throw new Error('Preview server did not respond within 10 seconds');
}

async function run(script) {
  const child = spawn('npm', ['run', script], {
    stdio: 'inherit',
    env: { ...process.env, SITE_URL: base },
  });
  return await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', code => resolve(code ?? 1));
  });
}

try {
  await ready();
  let failures = 0;
  for (const script of ['test:navigation', 'test:stage']) {
    failures += Number((await run(script)) !== 0);
  }
  process.exitCode = failures ? 1 : 0;
} finally {
  if (preview.exitCode === null) preview.kill('SIGTERM');
}
