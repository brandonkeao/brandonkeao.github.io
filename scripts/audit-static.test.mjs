import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const auditScript = fileURLToPath(new URL('./audit-static.mjs', import.meta.url));

async function withFixture(files, assertion) {
  const directory = await mkdtemp(path.join(tmpdir(), 'website-static-audit-'));
  try {
    for (const [relativePath, contents] of Object.entries(files)) {
      const file = path.join(directory, relativePath);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, contents);
    }
    await assertion(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function runAudit(directory) {
  return spawnSync(process.execPath, [auditScript, directory], { encoding: 'utf8' });
}

test('reports a missing local script source', async () => {
  await withFixture({
    'index.html': '<!doctype html><script src="/_astro/missing.js"></script>',
  }, (directory) => {
    const result = runAudit(directory);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /\/_astro\/missing\.js points to a missing asset/);
  });
});

test('reports missing pages, assets, and anchor targets', async () => {
  await withFixture({
    'index.html': '<!doctype html><a href="/missing/">Page</a><img src="/missing.png"><a href="#missing">Anchor</a>',
  }, (directory) => {
    const result = runAudit(directory);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /\/missing\/ points to a missing link/);
    assert.match(result.stderr, /\/missing\.png points to a missing asset/);
    assert.match(result.stderr, /#missing points to a missing fragment #missing/);
  });
});

test('allows local SVG filter references while checking HTML anchors', async () => {
  await withFixture({
    'index.html': `<!doctype html>
      <link rel="stylesheet" href="/styles.css">
      <svg><filter id="grain"></filter><rect style="filter: url(#grain)"></rect></svg>
      <p id="details">Details</p><a href="#details">Jump</a>`,
    'styles.css': '.texture { filter: url("#grain"); }',
  }, (directory) => {
    const result = runAudit(directory);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Static audit passed/);
  });
});
