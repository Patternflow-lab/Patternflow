# Cleanup — progress

Running log of the cleanup proposed in [rfc-cleanup.md](rfc-cleanup.md),
against the step order in §2.12. Updated as PRs land. Entries are added by
whoever merges; the table is the summary, the sections below are the
record.

**Where it stands: steps 0 to 5 done, and the gate holds.** Baseline SHA `8226f7e`.

| step | what | state |
| --- | --- | --- |
| 0 | Baseline: CI record, doc map, cleanup-window rule in `AGENTS.md` | done ([#11](https://github.com/Patternflow-lab/Patternflow/pull/11)) |
| 1 | Document structure: root, legacy guide, CHANGELOG split, ko/en parity list | done ([#23](https://github.com/Patternflow-lab/Patternflow/pull/23); plan: [three lanes](investigations/2026-10-cleanup-step1-plan.md)) |
| 2 | Drift checks: links, BOM triad, features, editions, presets, roadmap, changelog; the human-text lock and the voice lint | done ([#37](https://github.com/Patternflow-lab/Patternflow/pull/37); plan: [fourteen PRs](investigations/2026-10-cleanup-step2-plan.md)) |
| 3 | Code hygiene: lint/typecheck zero, legacy named or gone, HUB75 upstream patch, shared constants | done ([#68](https://github.com/Patternflow-lab/Patternflow/pull/68); plan: [twenty-seven PRs](investigations/2026-10-cleanup-step3-plan.md)); k12 has eight upstream commits to go |
| 4 | Test spine: contract vectors ×5, virtual panel | done ([#92](https://github.com/Patternflow-lab/Patternflow/pull/92); plan: [twenty-four PRs](investigations/2026-10-cleanup-step4-plan.md)) |
| 5 | RFC drafts: any-resolution, Linux player | done ([#55](https://github.com/Patternflow-lab/Patternflow/pull/55); plan: [four PRs](investigations/2026-10-cleanup-step5-plan.md)) |

Gate for any-resolution (§2.12): met at `9dff573` on 16 October 2026. Each
item is checked under [The gate](#the-gate).

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

## Step 1 — document structure

Seven PRs, 14 and 15 October 2026, in the three lanes of
[investigations/2026-10-cleanup-step1-plan.md](investigations/2026-10-cleanup-step1-plan.md):
A1 [#13](https://github.com/Patternflow-lab/Patternflow/pull/13), B1
[#14](https://github.com/Patternflow-lab/Patternflow/pull/14), C1
[#15](https://github.com/Patternflow-lab/Patternflow/pull/15), A2
[#16](https://github.com/Patternflow-lab/Patternflow/pull/16), C2
[#17](https://github.com/Patternflow-lab/Patternflow/pull/17), A3
[#22](https://github.com/Patternflow-lab/Patternflow/pull/22), and C3
[#23](https://github.com/Patternflow-lab/Patternflow/pull/23) to close it.
`docs/voice.md` and `docs/voice-banned.txt` came in beside them
([#18](https://github.com/Patternflow-lab/Patternflow/pull/18)), the step's
first prose PR, as answer 6 asks.

The root holds the twelve files of answer 1 and the dotfiles.
`BUILD_GUIDE_v2.md` is `docs/legacy/BUILD_GUIDE_v2.md`, with no redirect: the
site's one link to it goes to github.com. `AUDIO_GUIDE.md` is
`docs/AUDIO_GUIDE.md`. `CODE_OF_CONDUCT.md`, `SECURITY.md` and `SUPPORT.md`
went to `.github/` as answer 1 says, where the plan's D5 had put them in
`docs/`. The README's story sections stay where they are (answer 2), so A3
merged as an empty commit.

`CHANGELOG.md` keeps the three newest releases in full and links the rest.
Each of the 30 releases back to v1.0.0 has its own file in `docs/releases/`,
and the two long-form notes already there became `v3.0.0-notes.md` and
`v3.1.0-notes.md` (D1). `release.py cut` writes the next file. It also stops
when the section leaving the root differs from its file, a check the plan did
not ask for.

`npm run doc-map` also writes
[investigations/2026-10-doc-parity.csv](investigations/2026-10-doc-parity.csv).
None of the three pair kinds §2.3 names exists, so the list reads the pairs
the repository does keep: journal posts, the guide's routes and copy, and the
roadmap's and the atlas's fields. The map reads the YAML under `.github/` as
well (C2). Questions 7 to 11 have no answer, and each lane took the plan's
default.

At [#23](https://github.com/Patternflow-lab/Patternflow/pull/23) the root is
as answer 1 says and `docs-links.yml` is green. The map has 1066 links out of
212 files, every one resolving. The parity list has 1366 pairs: 1340 ok, 18
ko-short, 7 en-short and one missing-ko. No translation was done; the list is
the deliverable.

## Step 2 — drift checks

Thirteen PRs, 15 October 2026:
[#25](https://github.com/Patternflow-lab/Patternflow/pull/25) to
[#36](https://github.com/Patternflow-lab/Patternflow/pull/36) as cut by
[investigations/2026-10-cleanup-step2-plan.md](investigations/2026-10-cleanup-step2-plan.md),
and [#37](https://github.com/Patternflow-lab/Patternflow/pull/37) to close it.
k14 was not opened. It waited on drift in the roadmap check's first CI run,
and [that run](https://github.com/Patternflow-lab/Patternflow/actions/runs/38665590179)
found none.

`npm run check:drift` in `web/` runs each file in `web/scripts/drift/`. At the
close there were eight: the seven of §2.4 and `check:changelog`, which step 1
sent here. `check:ci` ends with it. `.github/workflows/drift.yml` runs it on
every pull request with `PF_DRIFT_STRICT=1`, so a side a check cannot read
fails there instead of skipping, and runs `check:human-lock` against the base
commit (§2.9). `check:voice` (§2.10) is run by hand, by question 14's
default. `AGENTS.md` ends with the §2.10 rule and has a line for each command
([#36](https://github.com/Patternflow-lab/Patternflow/pull/36)).

`check:bom-schematic` finds the BOM's nine designators in the schematic's text
layer, so it was strict from its first day and the warn-only clause of §2.4
went unused. `check:roadmap` reads the repository from `roadmap-data.ts`,
`engmung/Patternflow`, and its list of issues open on purpose is empty
(question 12). The lock reads Part 1 of every `docs/rfc-*.md` rather than a
fixed list, so step 5's drafts were locked the day they landed. Two handoffs
from the step never landed and are still open at `9dff573`. A
`links-absolute` skip exits 0, so at a desk the runner prints it as passed
(`web/scripts/doc-map.ts` line 260); in CI strict mode fails it, as it should.
And `web/README.md` has no line for `check:voice`.

At [#37](https://github.com/Patternflow-lab/Patternflow/pull/37) all eight
pass strict in CI ([run 38671531965](https://github.com/Patternflow-lab/Patternflow/actions/runs/38671531965)).
`check:roadmap` read 14 issues, every one closed and every one on a `done`
node. The lock holds 74 journal files, 33 release files, the manifesto, the
README's three story sections, Part 1 of two RFCs and 166 roadmap strings.
`docs/.human-written` lists no path (answer 5). The doc map has 1072 links out
of 214 files, every one resolving, and the parity list is unchanged.

## Step 3 — code hygiene

Twenty-seven PRs, 15 October 2026, as cut by
[investigations/2026-10-cleanup-step3-plan.md](investigations/2026-10-cleanup-step3-plan.md):
k1 to k26 between [#38](https://github.com/Patternflow-lab/Patternflow/pull/38)
and [#67](https://github.com/Patternflow-lab/Patternflow/pull/67), and
[#68](https://github.com/Patternflow-lab/Patternflow/pull/68) to close it.
#40, #50, #51 and #55 in that range are step 5's.

`npm run lint` went from the baseline's 12 warnings to none. Five were fixed
in the code. The seven `<img>` tags each carry a one-line exception with its
reason, and `web-ci.yml` runs lint with `--max-warnings=0`. `typecheck` was
clean and stayed clean. Every legacy path the plan found now says what wrote
it or what links to it, with the date and the commit. Code with no reader
went, `saveDraft` among it. The rest stays until questions 18 and 19 have an
answer.

`shared/constants.json` holds the values §2.5 named, the 24 detents a turn
among them. `npm run gen:shared` writes `core_shared.h` and `constants.ts`
from it, and the firmware and the site read those. `check:shared` runs in
`check:ci` and in `drift.yml`. The MIDI page counted 20 detents a turn and
counts 24 now ([#46](https://github.com/Patternflow-lab/Patternflow/pull/46)),
a fix reviewed as one. The `markers` check holds first-party code at no
`TODO` or `FIXME`. The five markers §2.5 counts were never in this repository
(question 16). Each web dependency family is on its newest release inside its
major. Next went from 16.3.0 to 16.4.1, which closed nine security advisories,
and React from 19.2.4 to 19.3.1. Majors wait (answer 4).

`src/hub75/UPSTREAM.md` names upstream's tag 3.0.13 and its commit `a622186`,
and `patternflow.patch` holds every line Patternflow changed, in 15 hunks
([#47](https://github.com/Patternflow-lab/Patternflow/pull/47)). k12 is where
the step parts from its plan. The plan gives each upstream commit after the
tag that touches no hunk a PR of its own, with a flash-and-look on the
reference panel that the maintainer notes in the PR (§2.5). #47 found nine
such commits. One merged:
[#48](https://github.com/Patternflow-lab/Patternflow/pull/48) takes `7bf3b6c`,
which sets `line_decoder` in the config constructor. At 3.0.13 nothing sets
that field, and `c09362a` reads it to address every row, so `7bf3b6c` went
first, ahead of older commits. Its flash-and-look is not noted on #48 yet.
The other eight have no PR: `c09362a`, `538cb41`, `3ab92ad`, `b40a838`,
`203502b`, `a15a887`, `6a49f09` and `c005c7b`, in that order. Each needs the
maintainer at the panel. §2.5's "done when" asks for `UPSTREAM.md` and the
patch, not for the merges, so #68 closed the step with k12 open, and the gate
does not wait on it.

At [#68](https://github.com/Patternflow-lab/Patternflow/pull/68) `check:ci`
passes its 26 suites and `check:panels` its 478 tests. Lint and typecheck are
clean. `drift.yml` passes ten checks strict
([run 38734640534](https://github.com/Patternflow-lab/Patternflow/actions/runs/38734640534)).
The doc map has 1095 links out of 217 files, every one resolving.

## Step 4 — the test spine

Twenty-four PRs, 15 and 16 October 2026:
[#69](https://github.com/Patternflow-lab/Patternflow/pull/69) to
[#91](https://github.com/Patternflow-lab/Patternflow/pull/91) as cut by
[investigations/2026-10-cleanup-step4-plan.md](investigations/2026-10-cleanup-step4-plan.md),
and [#92](https://github.com/Patternflow-lab/Patternflow/pull/92) to close it.
Every row of the plan has its PR, and each stayed inside its files. k12
([#82](https://github.com/Patternflow-lab/Patternflow/pull/82)) went past its
row: besides the channels, the snapshot and `/api/mqtt`, its 13 vectors cover
the prefix that names a channel and the Publisher's eight-second heartbeat.

`tools/virtual-panel/` is a Patternflow with no board. It is the guide's
`DeviceSim` behind the ports the firmware listens on, and patterns run on
`PatternRuntime`, the one the site runs them on. `web/src/lib/harness/`, the
folder §2.6 names, does not exist, and `PatternRuntime` stands in for it.
Eight files in `transports/` speak the five wire contracts, each the subset
its spec names, on Node's own sockets. The lockfile did not move.
`GET /frame.png` is the frame as the LEDs would show it, and `/vp/` is a hand
and the clock. The firmware has neither.

The five vector folders hold 111 vectors: 53 for REST, 15 for MQTT, 11 for
OSC, 20 for MIDI and 12 for the audio socket. Each is a JSON file that quotes
one sentence of its spec, in the format [contract-vectors.md](contract-vectors.md)
gives. A suite starts a fresh panel for each vector on a clock that stands
still between steps, so a 500 ms release costs no real time.
`check:virtual-panel` runs the 34 presets that have a JS twin for two seconds
of panel time each. `calib` is firmware-only and is left out. The six suites
are files in `web/scripts/drift/`, so `check:ci` and `drift.yml` run them.

The vectors follow the spec. Where the spec said two things,
[#91](https://github.com/Patternflow-lab/Patternflow/pull/91) made it say one,
in ten lines of `rest-api.md` and `midi-spec.md`, by question 27's default:
the route's own section wins. Nobody has ruled on those lines yet. Where the
firmware disagrees with its spec, the vector keeps the spec and a real panel
would fail it. #92 counts 18 such places, 11 of them in vectors. Each PR lists
its own under "for an issue" with the spec line and the firmware line, and
question 26 leaves opening the issues to the maintainer. Nothing under
`firmware/` changed in this step. Questions 26 to 29 have no answer, and every
PR took the default. Web CI starts only on `web/`, so a PR that edits only
`tools/virtual-panel/` is typechecked at a desk and nowhere else.

At [#92](https://github.com/Patternflow-lab/Patternflow/pull/92) `check:ci`
passes its 26 suites and `check:panels` its 487 tests. Lint and typecheck are
clean. `drift.yml` passes 16 checks strict
([run 38814004535](https://github.com/Patternflow-lab/Patternflow/actions/runs/38814004535)).
The doc map has 1138 links out of 224 files, every one resolving.

## Step 5 — RFC drafts

Four PRs, 15 October 2026, as cut by
[investigations/2026-10-cleanup-step5-plan.md](investigations/2026-10-cleanup-step5-plan.md):
[#40](https://github.com/Patternflow-lab/Patternflow/pull/40),
[#50](https://github.com/Patternflow-lab/Patternflow/pull/50),
[#51](https://github.com/Patternflow-lab/Patternflow/pull/51), and
[#55](https://github.com/Patternflow-lab/Patternflow/pull/55) to close it. The
step ran beside steps 3 and 4, as §2.12 allows once step 2 is merged.

[rfc-any-resolution.md](rfc-any-resolution.md) and
[rfc-linux-player.md](rfc-linux-player.md) are Part 2 only, 298 lines each,
with facts from `dev` at `adbe923`. Part 1 is an empty heading in both, left
for the maintainer. Each sets out the order of the work as a table of PRs,
then ends with its open questions: six in the any-resolution draft, nine in
the player's. Both have a line in `docs/README.md`, and each links the other.
[investigations/2026-10-panel-geometry.md](investigations/2026-10-panel-geometry.md)
is the record of every place the panel size is set or assumed, by file and
line, and the any-resolution draft carries a table per file from it
(question 31).

`check:human-lock` reads Part 1 of every `docs/rfc-*.md`, so both drafts were
locked from the start, and the plan's finding 11 needed no fix. Questions 30
to 34 have no answer. At [#55](https://github.com/Patternflow-lab/Patternflow/pull/55)
the doc map has 1092 links out of 217 files, every one resolving.

## The gate

Checked on 16 October 2026 at `9dff573`, the merge of
[#92](https://github.com/Patternflow-lab/Patternflow/pull/92). The web
commands ran in a cloud container on that tree, Node 22.22.0 and npm 10.9.4
after `npm ci`, as at the baseline. CI ran on `2892326`, the first commit of
the PR that adds this entry. It is `9dff573` plus an empty commit, with the
same tree.

1. Every command in §2.1(1) passes. `npm run check:ci` passes its 26 suites in
   82 s. Its drift step passes 15 checks and skips `roadmap`, which needs a
   `gh` login this container does not have; CI runs it in item 2.
   `check:panels` passes 35 test files and 487 tests. `typecheck` prints
   nothing, and so does `lint`, with `--max-warnings=0` as Web CI runs it.
   `firmware/bundles/build.sh all` ran on GitHub Actions, as at the baseline:
   [Firmware builds run 38815552568](https://github.com/Patternflow-lab/Patternflow/actions/runs/38815552568),
   dispatched on `2892326`, built default, audio, performance, clock and midi,
   scanned each image for its features, and found every edition within
   tolerance. The last commit to touch `firmware/` is
   [#59](https://github.com/Patternflow-lab/Patternflow/pull/59).
2. Every script in §2.4, §2.5 (`check:shared`), §2.6 and §2.9 runs in CI and
   passes.
   [Drift checks run 38815274649](https://github.com/Patternflow-lab/Patternflow/actions/runs/38815274649)
   on `2892326` passes 16 checks with `PF_DRIFT_STRICT=1`: the seven of §2.4
   (`roadmap` reading `engmung/Patternflow`), `shared`, the five vector suites
   and `virtual-panel`, and `changelog` and `markers` besides. Its next step,
   `check:human-lock` against `9dff573`, says no locked words changed.
3. The virtual panel speaks REST (`rest-state.ts`, `rest-patterns.ts`) and
   MQTT (`mqtt.ts`, `mqtt-http.ts`), and OSC, MIDI and the audio socket
   besides. In the same run `check:virtual-panel` finds the 34 presets with a
   JS twin on the panel's list and runs each for 2000 ms at 128×64 with no
   error. `calib`, the 35th header in `firmware/patternflow/presets/`, is
   firmware-only by `check_presets.py`.
4. The doc map has no unresolved row. `npm run doc-map` reads 1138 links out
   of 224 files at `9dff573`, and 0 do not resolve. The map committed with
   this entry and the new status line in `rfc-cleanup.md` reads 1144 out of
   225, and 0 do not resolve.
5. The root holds `AGENTS.md`, `BUILD_GUIDE.md`, `CHANGELOG.md`,
   `CITATION.cff`, `CLAUDE.md`, `CONTRIBUTING.md`, `FEATURE_GUIDE.md`,
   `LICENSE`, `LICENSE-CC-BY-SA`, `LICENSE-MIT`, `PATTERN_GUIDE.md`,
   `README.md` and the dotfiles, the list in answer 1.
6. `docs/rfc-any-resolution.md` and `docs/rfc-linux-player.md` exist (step 5).

All six hold. §2.12 lets `rfc-any-resolution.md` move from draft to proposed
now. The move is the maintainer's, and its status line still says "Draft".
