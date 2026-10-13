import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const outputDirectory = path.resolve(process.argv[2] ?? 'dist');
const siteOrigin = 'https://brandonkeao.com';
const errors = [];

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...await walk(entryPath));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}

function relativeFile(file) {
  return path.relative(outputDirectory, file).split(path.sep).join('/');
}

function pagePath(file) {
  const relative = relativeFile(file);
  if (relative === 'index.html') return '/';
  if (relative.endsWith('/index.html')) return `/${relative.slice(0, -10)}`;
  return `/${relative}`;
}

function decodePathname(pathname) {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return pathname;
  }
}

function targetCandidates(pathname, type) {
  const relative = decodePathname(pathname).replace(/^\/+/, '');
  if (!relative) return ['index.html'];
  if (type === 'asset') return [relative];
  if (relative.endsWith('/')) return [`${relative}index.html`];
  return [relative, `${relative}/index.html`, `${relative}.html`];
}

function readAttributes(source) {
  const attributes = new Map();
  const pattern = /([:\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  for (const match of source.matchAll(pattern)) {
    attributes.set(match[1].toLowerCase(), match[2] ?? match[3] ?? match[4] ?? '');
  }
  return attributes;
}

function cssUrls(source) {
  const urls = [];
  const pattern = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)'"\s]+))\s*\)/gi;
  for (const match of source.matchAll(pattern)) {
    urls.push(match[1] ?? match[2] ?? match[3] ?? '');
  }
  return urls;
}

function srcsetUrls(source) {
  return source
    .split(',')
    .map((candidate) => candidate.trim().split(/\s+/, 1)[0])
    .filter(Boolean);
}

function fragmentId(fragment) {
  try {
    return decodeURIComponent(fragment);
  } catch {
    return fragment;
  }
}

function describeReference(source, value) {
  return `${source}: ${value}`;
}

let files;
try {
  files = (await walk(outputDirectory)).sort();
} catch (error) {
  console.error(`Static audit could not read ${outputDirectory}: ${error.message}`);
  process.exit(1);
}

const fileSet = new Set(files.map(relativeFile));
const htmlFiles = files.filter((file) => file.endsWith('.html'));
const idsByFile = new Map();

for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8');
  const markup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  const ids = new Set();
  for (const tagMatch of markup.matchAll(/<[a-z][\w:-]*\b([^>]*)>/gi)) {
    const id = readAttributes(tagMatch[1]).get('id');
    if (!id) continue;
    if (ids.has(id)) errors.push(`${relativeFile(file)}: duplicate id #${id}`);
    ids.add(id);
  }
  idsByFile.set(relativeFile(file), ids);
}

let internalLinks = 0;
let assetReferences = 0;
let fragmentTargets = 0;

function validateReference(sourceFile, pageUrl, rawValue, type) {
  const value = rawValue.trim();
  if (!value || value.startsWith('data:') || value.startsWith('mailto:') || value.startsWith('tel:')) return;

  let url;
  try {
    url = new URL(value, new URL(pageUrl, siteOrigin));
  } catch {
    errors.push(`${describeReference(relativeFile(sourceFile), value)} is not a valid URL`);
    return;
  }

  if (!['http:', 'https:'].includes(url.protocol) || url.origin !== siteOrigin) return;

  const candidates = targetCandidates(url.pathname, type);
  const target = candidates.find((candidate) => fileSet.has(candidate));
  if (!target) {
    errors.push(`${describeReference(relativeFile(sourceFile), value)} points to a missing ${type}`);
    return;
  }

  if (type === 'link') internalLinks += 1;
  else assetReferences += 1;

  if (type === 'link' && url.hash.length > 1 && target.endsWith('.html')) {
    fragmentTargets += 1;
    const id = fragmentId(url.hash.slice(1));
    if (!idsByFile.get(target)?.has(id)) {
      errors.push(`${describeReference(relativeFile(sourceFile), value)} points to a missing fragment #${id}`);
    }
  }
}

for (const file of htmlFiles) {
  const html = await readFile(file, 'utf8');
  const pageUrl = pagePath(file);
  const markup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');

  for (const tagMatch of markup.matchAll(/<([a-z][\w:-]*)\b([^>]*)>/gi)) {
    const tag = tagMatch[1].toLowerCase();
    const attributes = readAttributes(tagMatch[2]);

    if (tag === 'a' && attributes.has('href')) {
      validateReference(file, pageUrl, attributes.get('href'), 'link');
    }
    if (attributes.has('src')) validateReference(file, pageUrl, attributes.get('src'), 'asset');
    if (attributes.has('poster')) validateReference(file, pageUrl, attributes.get('poster'), 'asset');

    if (tag === 'link' && attributes.has('href')) {
      const rel = attributes.get('rel')?.toLowerCase().split(/\s+/) ?? [];
      if (rel.some((value) => ['stylesheet', 'icon', 'preload', 'manifest'].includes(value))) {
        validateReference(file, pageUrl, attributes.get('href'), 'asset');
      }
    }

    if (attributes.has('srcset')) {
      for (const value of srcsetUrls(attributes.get('srcset'))) {
        validateReference(file, pageUrl, value, 'asset');
      }
    }
  }

  for (const value of cssUrls(markup)) validateReference(file, pageUrl, value, 'asset');
}

for (const file of files.filter((candidate) => candidate.endsWith('.css'))) {
  const css = await readFile(file, 'utf8');
  const cssUrl = `/${relativeFile(file)}`;
  for (const value of cssUrls(css)) validateReference(file, cssUrl, value, 'asset');
}

if (htmlFiles.length === 0) errors.push('dist contains no HTML pages');

if (errors.length > 0) {
  console.error(`Static audit found ${errors.length} error${errors.length === 1 ? '' : 's'}:`);
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(
  `Static audit passed: ${htmlFiles.length} HTML pages, ${internalLinks} internal links, `
  + `${assetReferences} asset references, and ${fragmentTargets} fragment targets.`,
);
