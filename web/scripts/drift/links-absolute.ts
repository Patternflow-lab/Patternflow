/**
 * check:links-absolute (docs/rfc-cleanup.md §2.4): every GitHub URL into a
 * file of this repository, against the tree at HEAD, or against the tag it
 * names. The doc map already finds and resolves each of them, so this runs
 * its check mode, which writes nothing; doc-map.ts says what fails and what
 * is skipped.
 */
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const docMap = fileURLToPath(new URL("../doc-map.ts", import.meta.url));
// execArgv carries tsx's loader, so doc-map.ts runs the way this file does.
const run = spawnSync(process.execPath, [...process.execArgv, docMap, "--check", "absolute"], { stdio: "inherit" });
if (run.error) console.error(`links-absolute: ${run.error.message}`);
process.exit(run.status ?? 1);
