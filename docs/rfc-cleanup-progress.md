# Cleanup — progress

Running log of the cleanup proposed in [rfc-cleanup.md](rfc-cleanup.md),
against the step order in §2.12. Updated as PRs land. Entries are added by
whoever merges; the table is the summary, the sections below are the
record.

**Where it stands: step 0 done, step 1 next.** Baseline SHA `8226f7e`.

| step | what | state |
| --- | --- | --- |
| 0 | Baseline: CI record, doc map, cleanup-window rule in `AGENTS.md` | done ([#11](https://github.com/Patternflow-lab/Patternflow/pull/11)) |
| 1 | Document structure: root, legacy guide, CHANGELOG split, ko/en parity list | — |
| 2 | Drift checks: links, BOM triad, features, editions, presets, roadmap | — |
| 3 | Code hygiene: lint/typecheck zero, legacy named or gone, HUB75 upstream patch, shared constants | — |
| 4 | Test spine: contract vectors ×5, virtual panel | — |
| 5 | RFC drafts: any-resolution, Linux player | — |

Gate for any-resolution (§2.12): not met.

---

## Step 0 — baseline

[#11](https://github.com/Patternflow-lab/Patternflow/pull/11), 14 October
2026. The cleanup starts from `8226f7ea5da15b0e0e55b15fa9ec7af136eef080` on
`dev`. The record is
[investigations/2026-10-cleanup-baseline.md](investigations/2026-10-cleanup-baseline.md).

At that SHA `check:ci` passes its 25 suites, `check:panels` its 478 tests,
and `typecheck` is clean. `lint` has no errors and 12 warnings, listed in the
record for Step 3. `build.sh all` ran on GitHub Actions, because the container
cannot reach the PlatformIO registry, and all five compositions built.

`npm run doc-map` in `web/` writes
[investigations/2026-10-doc-map.csv](investigations/2026-10-doc-map.csv).
1007 links out of 193 files, every one resolving, so the known-broken list is
empty. `AGENTS.md` carries the cleanup-window rule as hard rule 8.
