/**
 * check:editions: the cards on /editions against the folders under
 * firmware/bundles/. It checks names. Versions, and that each named image has
 * its files, are check_versions.py's.
 *
 * Every card has a bundle, and every bundle is a card or a try-out on
 * /features. Two kinds of card have no bundle. The default is the card whose
 * id is the variant the core reports with no bundle, PF_VARIANT in
 * net_config.h. A card with a github field is released from that repository
 * (EditionCard.tsx reads its latest tag there), so it is built there too.
 * Both are read from the tree and printed.
 *
 * The folders in web/public/flash/bin/ are the images the cards, the try-outs
 * and the flasher's manifest.json name: shelf.sh stages one per name and
 * version, and nothing else writes there. The EDITIONS tuples in release.py
 * and check_versions.py are the cards built here bar the default, the list
 * both scripts keep by hand.
 */
import path from "node:path";

import { EDITIONS } from "../../src/app/editions/editions-data";
import { FEATURES } from "../../src/app/features/features-data";
import { compare, done, read, tracked } from "./_lib";

const NET_CONFIG = "firmware/patternflow/net_config.h";
const BUNDLES = "firmware/bundles/";
const BIN = "web/public/flash/bin/";
const MANIFEST = "web/public/flash/manifest.json";
const SITE = new URL("https://patternflow.work/");
const SCRIPTS = ["firmware/toolchain/release.py", "firmware/toolchain/check_versions.py"];

/** The folder under /flash/bin/ a URL on the site points into. Undefined for a URL hosted elsewhere. */
function binFolder(url: string): string | undefined {
  const u = new URL(url, SITE);
  return u.origin === SITE.origin ? /^\/flash\/bin\/([^/]+)\//.exec(u.pathname)?.[1] : undefined;
}

/** The first folder of each tracked path under dir. */
const folders = (dir: string) =>
  new Set(tracked(dir).map((f) => f.slice(dir.length).split("/")).filter((parts) => parts.length > 1).map((parts) => parts[0]));

const core = /^#define PF_VARIANT "([^"]+)"/m.exec(read(NET_CONFIG))?.[1];
if (!core) throw new Error(`${NET_CONFIG}: no #define PF_VARIANT "..." line`);
const elsewhere = EDITIONS.filter((e) => e.github);
const built = EDITIONS.filter((e) => e.id !== core && !e.github).map((e) => e.id);
const tryOuts = FEATURES.flatMap((f) => (f.tryOut ? [f.tryOut.url] : []));
// shelf.sh names a folder <bundle>-<version>. A try-out URL of another shape stays whole, so the run shows it.
const tryOutNames = tryOuts.map((url) => binFolder(url)?.replace(/-v\d+\.\d+\.\d+$/, "") ?? url);
console.log(`the default, by PF_VARIANT in net_config.h: ${core}`);
console.log(`cards released from another repository, by their github field: ${elsewhere.map((e) => e.id).join(", ") || "(none)"}`);
console.log(`try-outs, by tryOut in features-data.ts: ${tryOutNames.join(", ") || "(none)"}`);

compare(
  "cards and try-outs against bundles",
  { label: "cards built here, and try-outs", items: new Set([...built, ...tryOutNames]) },
  { label: BUNDLES, items: folders(BUNDLES) },
);

const manifest = JSON.parse(read(MANIFEST)) as { builds: { parts: { path: string }[] }[] };
// A part's path is relative to the manifest, which the site serves at /flash/manifest.json.
const manifestUrl = new URL("flash/manifest.json", SITE);
const named = [
  ...EDITIONS.flatMap((e) => (e.hosted ? [e.hosted.url] : [])),
  ...tryOuts,
  ...manifest.builds.flatMap((b) => b.parts.map((p) => new URL(p.path, manifestUrl).href)),
].flatMap((url) => binFolder(url) ?? []);
compare(
  "images against what names them",
  { label: BIN, items: folders(BIN) },
  { label: "cards, try-outs and manifest.json", items: new Set(named) },
);

for (const file of SCRIPTS) {
  const tuple = /^EDITIONS = \(([^)]*)\)/m.exec(read(file))?.[1];
  if (tuple === undefined) throw new Error(`${file}: no EDITIONS = (...) line`);
  compare(
    `EDITIONS in ${path.basename(file)} against the cards`,
    { label: file, items: [...tuple.matchAll(/["']([^"']+)["']/g)].map((m) => m[1]) },
    { label: "cards built here", items: built },
  );
}
done();
