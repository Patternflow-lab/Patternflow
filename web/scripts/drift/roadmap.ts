/**
 * check:roadmap: the status of each /roadmap node against the state of the
 * issues it names. A done node with an open issue is drift, and so is a
 * planned node with a closed one. The issues are in the repository the page's
 * own links point at, REPO in roadmap-data.ts, and gh reads each state. An
 * issue GitHub answers 404 or 410 for is drift too: the page names an issue
 * nobody can open.
 *
 * An issue can stay open after its node is done, when the work shipped and the
 * issue holds something back for later. Such an issue goes in OPEN_ON_PURPOSE
 * below, with the maintainer's reason, and an entry whose issue has closed is
 * drift as well. A gh that cannot read the repository here (not installed, no
 * login, no network, no access) skips.
 */
import { execFileSync } from "node:child_process";

import { NODES } from "../../src/app/roadmap/roadmap-data";
import { compare, done, read, skip } from "./_lib";

const DATA = "web/src/app/roadmap/roadmap-data.ts";

/** Issues on done nodes that stay open on purpose, each with the maintainer's reason. */
const OPEN_ON_PURPOSE: Record<number, string> = {};

const href = /^const REPO = '([^']+)'/m.exec(read(DATA))?.[1];
if (!href) throw new Error(`${DATA}: no const REPO = '...' line`);
const repo = new URL(href).pathname.replace(/^\/|\/$/g, "");

/** gh's own words when it fails: the first line of what it printed. */
const why = (e: unknown) =>
  String((e as { stderr?: string }).stderr ?? (e as Error).message)
    .split("\n")
    .find((line) => line.trim()) ?? "gh failed";

const numbers = [...new Set(NODES.flatMap((n) => n.issues ?? []))].sort((a, b) => a - b);
const state = new Map<number, string>();
const ask = (path: string, ...args: string[]) =>
  execFileSync("gh", ["api", path, ...args], { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" }).trim();
let readable = true;
try {
  ask(`repos/${repo}`, "--silent");
  for (const n of numbers) {
    try {
      state.set(n, ask(`repos/${repo}/issues/${n}`, "--jq", ".state"));
    } catch (e) {
      // A 404 or a 410 says the issue is not there, which is the page's to fix. Any other failure is gh's.
      if (!/\(HTTP (404|410)\)/.test(why(e))) throw e;
      state.set(n, why(e));
    }
  }
} catch (e) {
  readable = false;
  skip("issues", (e as NodeJS.ErrnoException).code === "ENOENT" ? "gh is not installed" : `gh cannot read ${repo}: ${why(e)}`);
}

if (readable) {
  console.log(`issues on ${repo}, by gh:`);
  for (const n of numbers) {
    const nodes = NODES.filter((node) => node.issues?.includes(n)).map((node) => `${node.id} (${node.status})`);
    console.log(`  #${n} ${state.get(n)}: ${nodes.join(", ")}`);
  }

  const kept = Object.entries(OPEN_ON_PURPOSE).map(([n, reason]) => `#${n} (${reason})`);
  console.log(`open on purpose, by OPEN_ON_PURPOSE: ${kept.join(", ") || "(none)"}`);

  const on = (status: string) => [...new Set(NODES.filter((n) => n.status === status).flatMap((n) => n.issues ?? []))];
  compare(
    "done nodes with an open issue",
    { label: "issues on done nodes, not closed", items: on("done").filter((n) => state.get(n) !== "closed").map((n) => `#${n}`) },
    { label: "OPEN_ON_PURPOSE in roadmap.ts", items: Object.keys(OPEN_ON_PURPOSE).map((n) => `#${n}`) },
  );
  compare(
    "planned nodes with a closed issue",
    { label: "issues on planned nodes", items: on("planned").map((n) => `#${n}`) },
    { label: "of those, open", items: on("planned").filter((n) => state.get(n) === "open").map((n) => `#${n}`) },
  );
}
done();
