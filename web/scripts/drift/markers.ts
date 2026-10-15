/**
 * check:markers (docs/rfc-cleanup.md §2.5): no TODO or FIXME is added during
 * the cleanup. First-party code had none when step 3 was planned, and none at
 * seven commits sampled on dev from May to October (finding 11 of
 * docs/investigations/2026-10-cleanup-step3-plan.md). So no marker is allowed,
 * and one found is drift.
 *
 * It reads every tracked text file under firmware/, web/src/, web/scripts/,
 * tools/ and integrations/. The two words count in capitals, at the start of a
 * word: the guide's data-s="todo" names a step not reached yet, and MASTODON
 * holds no marker. Vendored code is upstream's, and doc-map.ts skips the same
 * three folders. hub75/ keeps upstream's one TODO, which its UPSTREAM.md
 * records, because editing it would add a hunk to patternflow.patch. This file
 * names both words, so it skips itself as well.
 */
import { compare, done, read, tracked } from "./_lib";

const UNDER = ["firmware/", "web/src/", "web/scripts/", "tools/", "integrations/"];
const VENDORED = /(^|\/)(hub75|webserver|pubsubclient)\//;
const SELF = "web/scripts/drift/markers.ts";
const MARKER = /(^|[^A-Za-z])(TODO|FIXME)/;

const files = UNDER.flatMap((under) => tracked(under)).filter((f) => f !== SELF);
const vendored = files.filter((f) => VENDORED.test(f));
let binary = 0;
const found: string[] = [];
for (const f of files) {
  if (VENDORED.test(f)) continue;
  const text = read(f);
  // A NUL is how git tells a binary file from text, and a PNG has one.
  if (text.includes("\0")) {
    binary++;
    continue;
  }
  text.split("\n").forEach((line, i) => {
    if (MARKER.test(line)) found.push(`${f}:${i + 1}`);
  });
}

console.log(`read ${files.length - vendored.length - binary} files under ${UNDER.join(", ")}`);
console.log(`not read: ${vendored.length} vendored, ${binary} binary, and this file`);
compare("TODO and FIXME", { label: "markers found", items: found }, { label: "markers allowed", items: [] });
done();
