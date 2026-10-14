# Cleanup step 3: the plan

*For [rfc-cleanup.md](../rfc-cleanup.md) §2.5. Scouted on 14 October 2026 at
`2240b04` on `dev`, after the step 2 plan merged and before step 1 closed.
Nothing here is implemented.*

§2.5 gives step 3 six jobs: lint and typecheck at zero, every legacy path named
or gone, minor and patch dependency updates, the HUB75 fork written down as a
patch and then brought up to upstream, the `TODO` and `FIXME` markers, and one
source for the constants the firmware and the site both carry. Answer 4 of
§2.13 keeps major updates out of this window. Scouting found one fix the step
exists for: the MIDI page still counts 20 detents a turn (finding 9). This plan
cuts all of it into 27 PRs.

## The PRs

| k | what | files it may edit | merges after | §2.13 |
| --- | --- | --- | --- | --- |
| 1 | lint: four unused names and one hook dependency | `web/scripts/performance-smoke.ts`, `web/src/app/editions/EditionCard.tsx`, `web/src/app/roadmap/RoadmapMap.tsx`, `web/src/components/community/PatternCard.tsx` | — | — |
| 2 | lint: seven `<img>` warnings get a named exception | `web/src/app/build/breadboard/page.tsx`, `web/src/components/journal/JournalLightbox.tsx`, `web/src/components/sections/Hero.tsx` | — | — |
| 3 | CI fails on a lint warning | `.github/workflows/web-ci.yml` | 1, 2 | — |
| 4 | Pattern Lab's v1 keys | `web/src/lib/lab/persist.ts`, `web/src/lib/lab/legacyDraft.ts`, `web/src/lib/lab/serialize.ts`, `web/src/lib/lab/store/project.ts`, `web/src/lib/lab/director/bake.ts` | — | — |
| 5 | the site's redirects and old routes | `web/next.config.ts`, `web/src/lib/campaignRoutes.ts`, `web/src/proxy.ts`, `web/src/app/business/page.tsx`, `web/src/app/community/layout.tsx` | — | — |
| 6 | old formats the community and the build service still accept | `web/src/components/community/FeedControls.tsx`, `web/src/lib/community/deck.ts`, `web/src/lib/community/zipDownload.ts`, `web/src/lib/community/server/deckZip.ts`, `web/src/lib/community/server/builds.ts`, `web/src/lib/community/server/schema.ts`, `web/src/app/api/community/builds/route.ts`, `web/src/lib/firmware/moduleRunner.ts` | — | — |
| 7 | `shared/constants.json`, its generator, both generated files, `check:shared` | `shared/constants.json`, `web/scripts/gen-shared.ts`, `web/scripts/drift/shared.ts`, `firmware/patternflow/src/core_shared.h`, `web/src/lib/shared/constants.ts`, `web/package.json` | — | — |
| 8 | the firmware reads `core_shared.h` | `firmware/patternflow/config.h`, `firmware/patternflow/net_config.h`, `firmware/patternflow/src/core_encoders.h`, `firmware/patternflow/src/core_bus.h`, `firmware/patternflow/patternflow.ino` | 7 | — |
| 9 | the site reads `constants.ts` | `web/src/lib/pattern/harness.ts`, `web/src/lib/pattern/controls.ts`, `web/src/lib/pattern/matrix.ts`, `web/src/lib/guide/panelScreens.ts`, `web/src/lib/guide/deviceSim.ts`, `web/public/pattern-sandbox.html` | 7 | — |
| 10 | a fix, not a cleanup: MIDI counts 24 detents a turn | `firmware/patternflow/console/midi.html`, `firmware/patternflow/features/midi/midi_index.h`, `firmware/patternflow/features/midi/core_midi.h`, `docs/midi-spec.md` | — | — |
| 11 | the HUB75 fork as `UPSTREAM.md` and `patternflow.patch` | `firmware/patternflow/src/hub75/UPSTREAM.md`, `firmware/patternflow/src/hub75/patternflow.patch`, `firmware/patternflow/src/hub75/VENDORED.md`, `firmware/patternflow/src/core_display.h`, `firmware/patternflow/src/core_canvas.h` | — | — |
| 12 | upstream fixes, one PR per commit on k11's list | the upstream files that commit changes under `firmware/patternflow/src/hub75/`, and that folder's `UPSTREAM.md` and `patternflow.patch` | 11, then the PR before it | — |
| 13 | no new `TODO` or `FIXME` | `web/scripts/drift/markers.ts` | — | — |
| 14 | dependencies: lint and test tooling | `web/package-lock.json` | 3, 7 | 4 |
| 15 | dependencies: Drizzle | `web/package-lock.json` | 14 | 4 |
| 16 | dependencies: Tailwind | `web/package-lock.json` | 15 | 4 |
| 17 | dependencies: React Three | `web/package-lock.json` | 16 | 4 |
| 18 | dependencies: zustand | `web/package-lock.json` | 17 | 4 |
| 19 | dependencies: mediabunny | `web/package-lock.json` | 18 | 4 |
| 20 | dependencies: `@google/genai` | `web/package-lock.json` | 19 | 4 |
| 21 | dependencies: posthog-js | `web/package-lock.json` | 20 | 4 |
| 22 | dependencies: better-auth | `web/package-lock.json` | 21 | 4 |
| 23 | dependencies: React | `web/package.json`, `web/package-lock.json` | 22 | 4 |
| 24 | dependencies: Next | `web/package.json`, `web/package-lock.json` | 23 | 4 |
| 25 | `AGENTS.md`: `shared/`, the fork's two files, the new commands | `AGENTS.md` | 3, 7, 11 | — |
| 26 | the docs that map the tree | `docs/REPOSITORY.md`, `web/ARCHITECTURE.md`, `firmware/README.md` | 4, 7, 9, 11 | — |
| 27 | close step 3 | `docs/rfc-cleanup-progress.md`, `docs/investigations/2026-10-doc-map.csv`, `docs/investigations/2026-10-doc-parity.csv` | every other k | — |

Step 3 opens when step 2 is closed (§2.12). Step 2's runner (its k1) runs every
file in `web/scripts/drift/` from `check:ci` and its workflow (k10) on every
pull request, so k7 and k13 reach CI by adding a file. Every PR here runs its
voice lint (k9) on added prose, and none edits text its §2.9 lock (k8) covers.
Neither check is in the tree today; this plan does not write them again.

A file sits in one row, with two exceptions that run in order. The lockfile
belongs to k14 to k24, which open one at a time, and `web/package.json` to k7,
then k23, then k24. `UPSTREAM.md` and `patternflow.patch` belong to k11, then to
each k12 PR in turn. Rows that can be open at the same time share no file.
Start with any three of k1, k2, k4, k5, k6, k7, k10, k11 and k13, which wait on
nothing. §2.11's limit of five holds, and the dependency lane is one of them.

Only k27 commits the doc-map CSVs. Every other PR runs `npm run doc-map` in
`web/` after `git fetch --tags`, quotes its two summary lines, and checks both
CSVs out again. `AGENTS.md` and `.github/` get a PR each (k25, k3). No PR edits
`CHANGELOG.md`: each one's line rides in its description.

## What the tree says

1. Lint and typecheck. `npm run lint` gives the baseline's twelve warnings:
   four `no-unused-vars` and one `exhaustive-deps` in four files, seven
   `no-img-element` in three. `npm run typecheck` prints nothing. `web-ci.yml`
   gates on errors only ("warnings still pass"), so a fixed warning can return.
2. The `<img>` warnings. `next/image` changes the markup a page serves (a
   `srcset`, lazy loading, the `/_next/image` route), which §2.1(1) rules out.
   The tree already makes nine line exceptions to this rule, three with a
   reason after `--` (`LabWindow.tsx`, `DeskStage.tsx`, `AttachmentList.tsx`).
3. The hook warning. `clampPan` in `RoadmapMap.tsx` reads `width`, `zoom` and a
   ref, and the wheel effect lists `[width, zoom]`. As a `useCallback` on those
   two it can join the list, and the effect runs on the same renders as now.
   `zoomTo` and `REASON_LABEL` have no reader.
4. Pattern Lab. `patternflow_lab_draft_v1` was written by the lab's autosave
   from 25 July (`e19fe19`) until Pattern Lab v2 replaced it on 27 July
   (`9be6e98`); `patternflow_ramp_v1` is older. Only `migrateLegacyDraft` reads
   them. The comments say "v1 lab" and "read once", with no date, and "read
   once" is wrong: stashing a session removes the project key
   (`store/project.ts:67`), and the next open, finding none, migrates again.
   `persist.ts` lines 8 to 11 say the migration lifts the draft and the
   gallery; it lifts the draft and the ramp. `patternflow_lab_gallery_v1` is
   called legacy and is the live gallery key. `saveDraft` has no caller.
   `bakeShow` v1 "stays for … old players" and names none.
5. Redirects. `/variants` and `/flash` in `next.config.ts` name what links to
   them, and both are still linked (`web_update_index.h:214`,
   `.github/scripts/flashing-md.sh:61`). The `/variants` comment dates the
   console links to 3.8.0; `docs/releases/v3.7.0.md` has them already. With no
   comment: the two `?lang=en` journal redirects, which `proxy.ts` also handles
   while setting the language cookie; the `/en/en` collapse in `proxy.ts`; the
   eight campaign rewrites in `campaignRoutes.ts`; and `app/business/page.tsx`,
   a redirect to `/contact` from May that nothing in the repository links.
   `community/layout.tsx` gives "an old or mistyped URL" as its reason.
6. Community and the build service. `deck.ts` migrates `pf-module-cart` to
   `pf-deck` (`f3f163b`, 29 July) and names the old writer but not the date.
   `zipDownload.ts` keeps `duplicate-name` "for older servers", those before
   `e261978` (24 September). `builds/route.ts` answers a `"bin"` build with
   410, while `server/builds.ts`, `server/schema.ts` and `moduleRunner.ts`
   describe `"bin"` as live, and `moduleRunner.ts` cites a `buildRunner.ts`
   that is gone. `FeedControls.tsx` strips the parameters of "an old bookmark".
7. Dependencies. `npm outdated` shows a minor or patch release inside its major
   for every family in k14 to k24, Next 16.4.1 and React 19.3.1 among them.
   Waiting on answer 4: TypeScript 7, vitest 5, ESLint 10, jsdom 29, jest-dom
   7, better-sqlite3 13 and its types 9, dockview 8, feed 6, `@types/node` 26
   (CI runs Node 20), and three.js 0.186, which `^0.184.0` does not allow.
8. The HUB75 fork. `src/hub75/` is ESP32-HUB75-MatrixPanel-DMA v3.0.13,
   vendored on 31 July (`42bfc10`). `VENDORED.md` explains each change and
   `UPSTREAM_library.properties` keeps the version; neither names a commit. The
   changes go past `blitRGB888` and `resumeDMAoutput`: the buffer chain, the
   300 Hz frame padding, the OE windows inside upstream's `setBrightnessOE`,
   the rounding in `pfBuildSpread`, and the on-time accessors `core_power.h`
   reads, which carry no marker. `VENDORED.md`'s "Nothing else is modified" and
   the "one addition" comments in `core_display.h` and `core_canvas.h` are out
   of date. Upstream is outside this session's reach, so the platform files
   have not been compared. `build.sh:189` and `sync_ino_to_src.py:31` clone
   upstream's HEAD into `lib/HUB75`, which `platformio.ini` ignores.
9. Constants. `3b63d10` (31 July) moved the lab from 20 detents a turn to the
   encoder's 24 (PEC11R-4220F-S0024), and `5b9d1b0` (v3.9.4) moved the sandbox.
   The MIDI feature came later and still says 20: `console/midi.html:206`
   computes its "per turn" figure as `20*g[0]/g[1]`, and `core_midi.h:69` and
   `docs/midi-spec.md:119` say it in words. The firmware has no detents-a-turn
   constant; its 48 (`PF_LANE_MOTION_SCALE`, `_TEMPLATE.h`) is 24 times
   `TURNS_PER_FULL_RANGE`. Copies that agree: the 128×64 panel, four knobs, the
   bus maximum of 1000 (also a literal in the frozen `abi/pf_params.h`), ten
   bus units a click, four edges a detent, the 1000 ms long press, the 50 ms
   debounce. `panelScreens.ts` mirrors twenty timings from `patternflow.ino`
   by line number, most now wrong. `build_module.py` hard-codes 128 and 64.
   Written for other readers: `docs/rest-api.md:382`, the Ableton bridge's
   `DEFAULT_SWEEP = 48`, and the lab's AI prompt in `PatternPanel.tsx`, which
   says "0.05 per detent" where the lab's step for a 0 to 1 knob is 0.5/24.
10. Generating. The cache key (`builderRev.ts`) hashes `abi/*.h`, three
    toolchain files and four `src/` headers (`core_color.h`, `core_math.h`,
    `core_noise.h`, `core_module_loader.h`). A new `core_shared.h`, included
    from any other header, moves no key. `check_boundaries.py` reads
    `src/**/*.h` as core, so its macros take a `PF_SHARED_` prefix; a
    `PF_MIDI_` name fails rule R3. No workflow but step 2's watches `shared/`.
    Images carry `__DATE__` and `__TIME__` (`core_build.h:53`).
11. Markers. `git grep -E "TODO|FIXME"` finds upstream's own `TODO` at
    `hub75/ESP32-HUB75-MatrixPanel-I2S-DMA.cpp:126`, a `.gitignore` pattern
    and the RFC's sentence. First-party code has none, and had none at seven
    commits sampled on `dev` from May to October. The five §2.5 counts are not
    in this repository.

## Defaults this plan takes

- D1. No behaviour change, except where §2.5 asks for one: the dependency
  updates and the upstream fixes. k10 is a fix, reviewed as one (§2.2). Every
  other PR proves its output did not move, with `check:sandbox-sync` and
  `check:modcache` in `check:ci`, and D5 for the firmware.
- D2. Legacy is kept and named unless the maintainer says it goes (questions
  18, 19). A name says what wrote the data or posted the link, and when:
  "written by the lab's autosave from 25 to 27 July 2026", not "v1". Code with
  no reader goes.
- D3. A lint exception gives its reason on its own line, as `LabWindow.tsx`
  does. `eslint.config.mjs` is not touched.
- D4. A dependency family is packages that release together or wrap one
  another; a package with none is its own. Each PR takes what `npm outdated`
  shows inside the current major on the day it opens, a 0.x minor counting as
  a major. Caret ranges move in the lockfile (`npm update <names>`); the pinned
  `next`, `eslint-config-next`, `react` and `react-dom` move in `package.json`.
- D5. Two builds differ in their stamp, so k8 proves equality in two commits.
  The first puts a `static_assert` beside each literal it will replace,
  comparing it with the generated macro, and CI builds all five compositions.
  The second swaps and drops the asserts, and the sizes `firmware-build.yml`
  prints match the first commit's. No hashed header includes `core_shared.h`.
- D6. One generator, `web/scripts/gen-shared.ts` (`npm run gen:shared`),
  writes both outputs under a GENERATED line. The check regenerates in memory
  and compares, and also reads the copies that cannot be generated: the 1000 in
  the frozen `abi/pf_params.h` and the 128 and 64 in `build_module.py`, which
  is hashed. The copies written for other readers (finding 9) stay by hand.
- D7. `shared/constants.json` holds §2.5's four groups: the three panel
  geometries with their sizes and the default; the knob count, detents a turn
  and turns per full range; edges a detent, the bus maximum, bus units a
  click, the long press and the debounce. The other timings wait (question 23).
- D8. Generated text is outside the 300-line count when the PR proves it
  regenerates: `patternflow.patch`, the lockfile, `pattern-sandbox.html`,
  `midi_index.h`. The step 1 plan's question 8 asks the same for moved text.
- D9. Branches, labels and descriptions as in the step 1 plan's D4.

## The PRs in detail

A PR in `web/` runs `typecheck`, `lint`, `check:ci`, and `check:panels` when
it touches `web/src/` (§2.1). A PR in `firmware/` takes `build.sh all` from
`firmware-build.yml`, since the container cannot reach PlatformIO (baseline).

k1 to k3. k1 drops the unused `normalizePerformance` and `useMediaQuery`
imports, `REASON_LABEL` and `zoomTo`, and wraps `clampPan` as finding 3 says.
k2 puts `eslint-disable-next-line @next/next/no-img-element -- <reason>` above
each `<img>`: the build photos and the hero poster are fixed files shown as
they are, and the lightbox shows whichever journal image was clicked. k3 runs
the Lint step as `npm run lint -- --max-warnings=0`, with its comment to match,
and proves it exits 1 on a throwaway unused variable.

k4 to k6. A comment on each thing findings 4 to 6 list, giving its writer or
its link and the date (`git log -S` finds both). k4 also corrects `persist.ts`'s
header, renames `legacyGallery` to `gallery` with the key string unchanged,
removes `saveDraft`, and puts the repeated migration in its description, not
its code (question 18). k5 changes "3.8.0" to "3.7.0" and removes nothing;
`doc-map.ts` reads redirect sources as routes, so the map must not change. k6
says the `"bin"` route answers 410 and drops `buildRunner.ts`; the schema's
default stays, since changing it is a migration.

k7. The JSON (D7), the generator and the check (D6), the two outputs, and
`gen:shared` and `check:shared` (`tsx scripts/drift.ts shared`) in
`package.json`. Nothing includes or imports the outputs yet. Proof:
`gen:shared` twice gives identical files, and `check:shared` fails on a hand
edit to either output and on a changed literal in `abi/pf_params.h`.

k8. `config.h` takes `PANEL_GEOM_*` and their sizes (its `#ifndef` overrides
stay), `net_config.h` writes `PF_LANE_MOTION_SCALE` as detents times turns
(still overridable), `core_encoders.h` takes its edges, debounce and long
press, `core_bus.h` `PF_BUS_MAX` and the `/ 10`, `patternflow.ino`
`MODE_HOLD_MS`. Proof as D5. Every use of `PANEL_RES_W` and `PANEL_RES_H`
stays; step 5 counts them.

k9. The five files take their values from `@/lib/shared/constants` and keep
every name they export (`docs/rest-api.md:382` names `ENCODER_CLICKS_PER_TURN`).
`panelScreens.ts` cites firmware constants by name, not line. If
`check:sandbox-sync` reports a change, rebuild and show the diff is only the
constant's new home.

k10. `midi.html` counts 24, `console_pages.py build` regenerates
`midi_index.h`, and `core_midi.h` and `midi-spec.md` say 24 (so 1 is 24 steps
a turn and 4 is 6). `outDiv` and `outMul` keep their ranges and defaults, and
the `midi-v0.1.0` try-out stays frozen. Runs `console_pages.py check` and
`check_boundaries.py`.

k11. With upstream checked out read-only at tag 3.0.13 (question 20),
`UPSTREAM.md` names the repository, the tag and its commit, the date of the
copy, the upstream files left out or renamed, upstream's own `TODO`, and the
command that rebuilds the patch. `patternflow.patch` is `diff -ruN` of
upstream's `src/` against this folder, over the files both carry.
`VENDORED.md`'s "What this costs" and the two core comments point at the patch
instead of counting additions. The PR lists, oldest first, the upstream commits
after 3.0.13 that touch no hunk of the patch. Proof: the patch applied to a
clean upstream checkout reproduces the folder, `diff -r` empty.

k12. One PR per commit on that list, in its order: the change, the commit
added to `UPSTREAM.md`, the patch rebuilt. `check_blit.py` and `check_oe.py`
(they lift code out of the driver) and `firmware-build.yml` green, and a
flash-and-look on the reference panel the maintainer notes in the PR (§2.5).

k13. `markers.ts` fails on a `TODO` or `FIXME` in tracked files under
`firmware/`, `web/src/`, `web/scripts/`, `tools/` and `integrations/`. It skips
itself and the vendored `hub75/`, `webserver/` and `pubsubclient/`, the three
`doc-map.ts` already skips. It passes at HEAD. Upstream's marker stays: editing
it would add a hunk to the patch.

k14 to k24. One family each (D4), in the table's order: the smallest first,
Next last, because `eslint-config-next` moves with it and can bring warnings.
Each quotes `npm outdated` for its family before and after, runs
`npm run build` beside the four commands, and shows `pattern-sandbox.html`
unchanged. A family with nothing outdated on its day closes with nothing done.

k25 and k26. `AGENTS.md` gets `shared/` in its repository map, the fork's two
files beside the vendored driver, `npm run gen:shared` under "Common commands",
and the lint gate; the PR runs `check_versions.py`, which parses `AGENTS.md`.
k26 gives `docs/REPOSITORY.md` a top-level row for `shared/`, points
`web/ARCHITECTURE.md` at the constants' source (line 59) and k4's key name
(line 80), and points `firmware/README.md`'s vendored-driver note (lines 158 to
162) at `UPSTREAM.md`.

k27. After every other k: regenerate both CSVs, check §2.5's "done when" (lint
and typecheck clean, every legacy path named or gone, `UPSTREAM.md` and the
patch, `check:shared` in CI), and write step 3 into
`docs/rfc-cleanup-progress.md` the way step 0 is written.

## Questions for the maintainer

Numbered on from the step 2 plan's fifteen. Each has the default the PRs use
until there is an answer.

16. The five markers §2.5 counts are not here (finding 11). Where were they?
    Default: k13 holds first-party code at none.
17. Is a lint exception with its reason "relaxing the rule"? Default: no (D3).
18. May the v1 draft and ramp migration go? It serves browsers that opened the
    lab between 25 and 27 July. Default: kept and named, and the repeated
    migration (finding 4) gets a fix PR of its own.
19. `/business` and the two `?lang=en` redirects: keep or remove? Default:
    keep and name.
20. k11 and k12 read `mrcodetastic/ESP32-HUB75-MatrixPanel-DMA`, which a
    session scoped to the fork cannot. Default: the hub attaches it read-only.
21. Remove the two clones of upstream's HEAD the build ignores (finding 8)?
    Default: not in this step; `firmware/README.md` says they satisfy headers.
22. k10 changes what the MIDI page shows. In this window, reviewed as a fix?
    Default: yes.
23. Should `shared/constants.json` also carry the twenty timings
    `panelScreens.ts` mirrors? Default: no, only §2.5's four groups (D7).
24. The lab's AI prompt says "0.05 per detent" (finding 9). Default: a fix
    after the cleanup, outside this table.
25. Generated text outside the 300-line count (D8)? Default: yes.
