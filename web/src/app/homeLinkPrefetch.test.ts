import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// A <Link href="/"> in view prefetches the home page, and the home page's
// client chunks come with it: three.js (237,537 bytes gzip) and the
// post-processing chunk (212,365). At 390px in Chromium on 22 October,
// /terms, /contact and a 404 fetched 767,286 bytes of script with the
// prefetch and 148,456 without, and /community 987,765 and 408,515. With
// prefetch={false} the home page loads when the link is followed. Pattern
// Lab (579,250 bytes) and the guide (107,109) still prefetch it, as do the
// breadboard guide, journal, editions and compliance. They are left out
// below until they are done the same way.

const SRC = path.resolve(__dirname, '..');
const LEFT_OUT = [
  'components/guide',
  'app/build/breadboard',
  'app/pattern-lab',
  'components/journal',
  'app/editions',
  'app/compliance',
];

function sources(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sources(full);
    return entry.name.endsWith('.tsx') && !entry.name.includes('.test.') ? [full] : [];
  });
}

/** Each `<Link …>` opening tag, read to the `>` outside any braces. */
function linkTags(source: string): string[] {
  const tags: string[] = [];
  for (const m of source.matchAll(/<Link\b/g)) {
    let depth = 0;
    let end = m.index + m[0].length;
    for (; end < source.length; end++) {
      const c = source[end];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0) break;
    }
    tags.push(source.slice(m.index, end + 1));
  }
  return tags;
}

const homeLinks = sources(SRC).flatMap((file) => {
  const rel = path.relative(SRC, file).split(path.sep).join('/');
  return linkTags(fs.readFileSync(file, 'utf8'))
    .filter((tag) => /\bhref="\/"/.test(tag))
    .map((tag) => ({ rel, tag }));
});

describe('links to the home page', () => {
  it('are still found', () => {
    expect(homeLinks.map((l) => l.rel)).toContain('app/not-found.tsx');
  });

  it('skip the prefetch outside the pages left out', () => {
    const prefetching = homeLinks
      .filter(({ rel }) => !LEFT_OUT.some((dir) => rel.startsWith(`${dir}/`)))
      .filter(({ tag }) => !/\bprefetch=\{false\}/.test(tag))
      .map(({ rel }) => rel);
    expect(prefetching).toEqual([]);
  });
});
