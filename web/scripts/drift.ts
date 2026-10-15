/**
 * The drift checks: `npm run check:drift` in web/, which check:ci runs, or
 * `npm run check:<name>` for one (docs/rfc-cleanup.md §2.4).
 *
 * A check is a file in scripts/drift/. It compares two things the tree keeps
 * by hand, the BOM and the build guide's parts table for one, and fails when
 * they disagree. This runs every file there whose name does not start with _
 * (those are shared code), each in a process of its own, so a check that
 * throws stops no other. A name given here with no file behind it fails:
 * package.json names every check step 2 plans
 * (docs/investigations/2026-10-cleanup-step2-plan.md), and each file lands in
 * a PR of its own.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { ROOT, SKIPPED } from "./drift/_lib";

const DIR = path.join(ROOT, "web/scripts/drift");
const checks = fs.readdirSync(DIR).filter((f) => f.endsWith(".ts") && !f.startsWith("_")).map((f) => f.slice(0, -3)).sort();
const asked = process.argv.slice(2);

const results: [name: string, state: string][] = [];
for (const name of asked.length ? asked : checks) {
  console.log(`── ${name}`);
  if (!checks.includes(name)) {
    console.log(`scripts/drift/${name}.ts is not written yet`);
    results.push([name, "failed"]);
    continue;
  }
  // process.execArgv carries tsx's loader, so the child reads TypeScript too.
  const run = spawnSync(process.execPath, [...process.execArgv, path.join(DIR, `${name}.ts`)], { stdio: "inherit" });
  results.push([name, run.status === 0 ? "passed" : run.status === SKIPPED ? "skipped" : "failed"]);
}

console.log("");
for (const [name, state] of results) console.log(`${state.padEnd(8)} ${name}`);
if (results.some(([, state]) => state === "failed")) process.exitCode = 1;
