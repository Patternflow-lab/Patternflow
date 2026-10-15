/**
 * check:changelog: CHANGELOG.md against docs/releases/. Every release has a
 * file there. The root keeps the three newest in full and one line for each
 * older release, and release.py cut writes both (docs/RELEASING.md). So the
 * newest three are written twice, and an edit to one copy alone is drift.
 *
 * A section in full equals its file once its relative links point two folders
 * up. That is release.py's as_filed, and it is the only rewrite: a link with a
 * scheme, an anchor or a leading slash stays as it is. A line under "Older
 * releases" is what release.py's older_line makes of its file's heading, so
 * the version, the file name and the date have to agree. Every vX.Y.Z.md is in
 * the root one way or the other. The -notes and -launch files are not
 * changelog sections and are not counted.
 */
import { compare, done, read, tracked } from "./_lib";

const CHANGELOG = "CHANGELOG.md";
const RELEASES = "docs/releases/";
const OLDER = "## Older releases";

// release.py reads \r\n as \n, so a checkout with CRLF compares the same.
const text = (file: string) => read(file).replace(/\r\n/g, "\n");

// A release section runs from its "## [X.Y.Z] - date" line to the next "## ", as SECTION in release.py.
const SECTION = /^## \[(?!Unreleased\])([^\]]+)\][^\n]*\n[\s\S]*?(?=^## |(?![\s\S]))/gm;

// [3.11.0] and [v1.1.0] alike: the file name always carries the v.
const fileOf = (label: string) => `${RELEASES}v${label.replace(/^v+/, "")}.md`;

// $& is the "](" itself, so this file holds no link for doc-map.ts to follow.
const asFiled = (section: string) =>
  section.replace(/\n+$/, "").replace(/\]\((?![a-z][a-z0-9+.-]*:|[#/])/g, "$&../../") + "\n";

function olderLine(file: string): string {
  const m = /^## \[([^\]]+)\]([^\n]*)/.exec(text(file));
  if (!m) return `${file} has no "## [X.Y.Z]" heading`;
  return `- [${m[1]}](${fileOf(m[1])})${m[2]}`;
}

const root = text(CHANGELOG);
const rootLines = root.split("\n");
const sections = [...root.matchAll(SECTION)];
const releases = new Set(tracked(RELEASES).filter((f) => /^v\d+\.\d+\.\d+\.md$/.test(f.slice(RELEASES.length))));

const same: string[] = [];
for (const s of sections) {
  const [label, file] = [s[1], fileOf(s[1])];
  if (!releases.has(file)) {
    console.log(`[${label}]: ${file} does not exist`);
    continue;
  }
  const want = asFiled(s[0]).split("\n");
  const have = text(file).split("\n");
  const at = Array.from({ length: Math.max(want.length, have.length) }, (_, i) => i).find((i) => want[i] !== have[i]);
  if (at === undefined) {
    same.push(label);
    continue;
  }
  // The section's line numbers in the root, counted from 1. as_filed keeps every line where it was.
  const start = root.slice(0, s.index).split("\n").length;
  // An entry is one long line, so the run shows where in it the two part.
  const [a, b] = [want[at], have[at]];
  let col = 0;
  while (a !== undefined && b !== undefined && col < a.length && a[col] === b[col]) col++;
  const from = Math.max(0, col - 30);
  const show = (line: string | undefined) =>
    line === undefined
      ? "(ends before this line)"
      : (from ? "…" : "") + JSON.stringify(line.slice(from, from + 80)) + (line.length > from + 80 ? "…" : "");
  console.log(`[${label}]: CHANGELOG.md line ${start + at} and ${file} line ${at + 1} differ from column ${col + 1}`);
  console.log(`  CHANGELOG.md, links as filed: ${show(a)}`);
  console.log(`  ${file}: ${show(b)}`);
}
compare(
  "sections in full against their files",
  { label: CHANGELOG, items: sections.map((s) => s[1]) },
  { label: `${RELEASES}, word for word`, items: same },
);

const heading = rootLines.indexOf(OLDER);
const listed = [];
for (const line of heading < 0 ? [] : rootLines.slice(heading + 1)) {
  if (line.startsWith("## ")) break;
  if (line.startsWith("- ")) listed.push(line);
}
const inFull = new Set(sections.map((s) => fileOf(s[1])));
compare(
  "older releases against their files",
  { label: `lines under "${OLDER.slice(3)}"`, items: listed },
  { label: `the other files in ${RELEASES}, by their headings`, items: [...releases].filter((f) => !inFull.has(f)).map(olderLine) },
);
done();
