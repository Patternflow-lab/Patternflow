# Cleanup step 2: the plan

*For [rfc-cleanup.md](../rfc-cleanup.md) §2.4, with the §2.9 lock and the
§2.10 voice lint. Scouted on 14 October 2026 at `5955052` on `dev`, after step
1's moves, the split and the parity list had merged. Nothing here is
implemented.*

Step 2 is seven drift checks (§2.4). The step 1 plan sent one more here, a
check on the changelog split (its D2). Two others are checks the RFC gives no
step: the lock on human-written text (§2.9), and the voice lint (§2.10) with
the `AGENTS.md` rule that points at it. This plan cuts all of it into fourteen
PRs. No two of them edit the same file.

## The PRs

| k | what | files it may edit | merges after | §2.13 |
| --- | --- | --- | --- | --- |
| 1 | the runner, its library, every npm name, and `check:features` | `web/package.json`, `web/scripts/drift.ts`, `web/scripts/drift/_lib.ts`, `web/scripts/drift/features.ts` | — | — |
| 2 | `check:links-absolute` | `web/scripts/doc-map.ts`, `web/scripts/drift/links-absolute.ts` | — | — |
| 3 | `check:bom` and `check:bom-schematic` | `web/scripts/drift/_bom.ts`, `web/scripts/drift/bom.ts`, `web/scripts/drift/bom-schematic.ts` | 1 | — |
| 4 | `check:editions` | `web/scripts/drift/editions.ts` | 1 | — |
| 5 | `check:presets` | `web/scripts/drift/presets.ts` | 1 | — |
| 6 | `check:roadmap` | `web/scripts/drift/roadmap.ts` | 1, 10, and 14 if it opens | — |
| 7 | `check:changelog` (step 1 plan, D2) | `web/scripts/drift/changelog.ts` | 1 | — |
| 8 | `check:human-lock` (§2.9) | `web/scripts/human-lock.ts`, `web/scripts/lib/pr-base.ts`, `docs/.human-written` | — | 2, 5 |
| 9 | `check:voice` (§2.10) | `web/scripts/voice-lint.ts` | 8 | 6 |
| 10 | the drift workflow | `.github/workflows/drift.yml` | 1 | — |
| 11 | `AGENTS.md`: the §2.10 rule and the new commands | `AGENTS.md` | 9, 10 | 6 |
| 12 | the docs that say what CI runs | `CONTRIBUTING.md`, `web/README.md`, `web/ARCHITECTURE.md`, `docs/REPOSITORY.md` | 10 | — |
| 13 | close step 2 | `docs/rfc-cleanup-progress.md`, `docs/investigations/2026-10-doc-map.csv`, `docs/investigations/2026-10-doc-parity.csv` | every other k | — |
| 14 | roadmap drift, only if k6's first CI run finds any | `web/src/app/roadmap/roadmap-data.ts` (`status` and `issues` only) | — | — |

Step 2 starts when step 1 is closed (§2.12). k9 and k11 also need step 1's
voice PR on `dev`, which no lane of the step 1 plan carries: k9 reads
`docs/voice-banned.txt` and k11 names `docs/voice.md`.

A file sits in one row. A PR that finds it needs a file from another row
writes the change into its description under "for another k", and the owner
(or k13) carries it. Three people can work at once. Start with k1, k2 and k8,
which wait on nothing; after k1 merges, the rest of the checks open in any
order, three at a time, inside §2.11's limit of five.

Two shared things have a rule of their own:

- `web/package.json` belongs to k1. It adds every name this step needs, so no
  later PR touches it, and `check:ci` picks up each check the day its file
  lands (D1). No PR in this step adds a dependency.
- The doc-map CSVs are committed only by k13. Every other PR runs
  `npm run doc-map` in `web/` after `git fetch --tags`, quotes the two summary
  lines, and runs `git checkout` on both CSVs before committing.

`AGENTS.md` and `.github/` each get a PR of their own (k11, k10). No PR in this
step edits `CHANGELOG.md`: each one's line rides in its description, and the
root's three newest sections already equal their files (finding 9).

## What the tree says

1. `check:ci` runs on fewer PRs than the checks need. `web-ci.yml` starts on
   `web/**` and `hardware/case/**` only. A PR that edits only the BOM, the
   build guide, a feature folder, a bundle or the changelog runs no web job,
   so a check wired only into `check:ci` would never see the drift it exists
   for. k10 adds a workflow that runs the checks on every PR.
2. Absolute links. With tags fetched, `npm run doc-map` reads 1051 links from
   208 files, every one resolving. 118 are absolute, from 26 files, 24 of them
   on a tag (`v1.0.0` to `v3.1.0`). There are no raw.githubusercontent.com
   links. `doc-map.ts` already finds and resolves all of them, `${REPO}`
   templates included, so k2 asks it rather than writing a second reader.
   `git grep` finds no tracked file outside the map's sources that carries a
   repository URL. `actions/checkout` fetches no tags, so a tag row cannot be
   checked in CI without `fetch-depth: 0`.
3. BOM and guide. Both have seven on-board rows and four off-board rows. The
   names are worded apart ("Rotary encoder w/ switch" against "Rotary encoder
   with push switch"), so a check on names would fail at HEAD; ref, quantity
   and MPN agree. The sockets row is `U1 (sockets)` in the CSV and `—` in the
   guide, and its notes say it is not a refdes. Off the board there is no ref,
   the CSV writes `6-12` where the guide writes `6–12`, and every word of the
   CSV's part name appears in the guide's (`USB cable (sacrificial)`,
   "Sacrificial USB cable (it gets cut)").
4. Schematic. `hardware/pcb/schematic.pdf` is KiCad output in stroke fonts,
   so no designator sits in its streams as a plain string. `pdftotext` 24.02
   reads them all the same: U1, SW1 to SW4, J1, J3, J4 and C11, which is
   exactly the BOM's nine. The other refdes-shaped tokens are pin names (S1 to
   S3, IO4 to IO48, ESP32). The text layer carries designators, so §2.4's
   warn-only clause is not needed. Nothing in `web/package.json` reads PDF.
5. Features. `features-data.ts` has ten ids; nine are the folders under
   `firmware/patternflow/features/`, and the tenth is `core`, which the type's
   own comment allows ("Directory under firmware/patternflow/features/, or
   "core"").
6. Editions. Three cards (`core`, `performance`, `audio`) and four bundles
   (`audio`, `clock`, `midi`, `performance`). `clock` and `midi` are not
   drift: `features-data.ts` names each as a try-out
   (`/flash/bin/clock-v0.1.5/`, `/flash/bin/midi-v0.1.0/`). The five folders
   in `web/public/flash/bin/` are the three cards' images and the two
   try-outs. `release.py` and `check_versions.py` each keep
   `EDITIONS = ("audio", "performance")` by hand. `check_versions.py`
   already checks versions and that the named images exist.
7. Presets. `check_presets.py` (`firmware-checks.yml`) already compares
   `web/src/lib/presets/` with `firmware/patternflow/presets/`: 34 twins, 14
   web-only on purpose, `calib` firmware-only. `index.ts` imports all 48 web
   presets. What no script looks at is how a twin reaches a panel:
   `pattern_registry.h` compiles in `origin` and `calib`, and the other 33
   are the Basics pack, whose `basics.json` keeps a `presets` map of 33
   entries. The feature presets (`show/preset_black.h`,
   `weather/preset_weather.h`) live in `features/`, not `presets/`.
8. Roadmap. 83 nodes, 13 with an `issues` list, 14 distinct numbers, all in
   `engmung/Patternflow`. Every one of the 13 is `done`; the four `planned`
   nodes have no issues. This session's GitHub access covers only the fork,
   so the state of those issues was not read. Some may be open on purpose:
   #221 holds USB-C "until a redesign passes", and its node records the
   withdrawal, which did ship.
9. Changelog. The root keeps `[3.11.0]`, `[3.10.5]` and `[3.10.4]`, and each
   equals its file in `docs/releases/` byte for byte. Below them, "Older
   releases" links one file per line.
10. The lock. Every region §2.9 names exists: the README's three headings
    (lines 39, 51, 271), Part 1 of `rfc-cleanup.md` and of
    `rfc-core-and-variants.md`, 74 `.mdx` files in `web/content/journal/`,
    `docs/manifesto.md`, 33 files in `docs/releases/` (the `-notes` and
    `-launch` files too), and the roadmap's `detail`/`detailKo` strings.
    `docs/.human-written` does not exist, and answer 5 adds nothing to it.
11. Voice. `docs/voice.md` and `docs/voice-banned.txt` are not on `dev`;
    step 1's voice PR is writing them. The §2.10 block is not in `AGENTS.md`
    and no step of the RFC owns appending it.
12. No PR here edits `firmware/` or `web/src/` except k14, so `build.sh all`
    does not apply. `web/scripts/` is outside `next build`, and
    `npm run typecheck` is what covers it.

## Defaults this plan takes

- D1. One runner. Each drift check is a file in `web/scripts/drift/`.
  `web/scripts/drift.ts` runs every file there whose name does not start with
  `_`, and `check:ci` calls it once, as `check:drift`. The RFC's names stay:
  `npm run check:bom` runs that one file.
- D2. Skipped, not failed. A side a check cannot read where it runs (a tag
  the clone lacks, no `gh` login, no `pdftotext`) prints why and passes. With
  `PF_DRIFT_STRICT=1`, which k10's workflow sets, a skip fails. A contributor
  running `check:ci` at their desk is not stopped by a missing tag; CI is.
- D3. Exceptions are named where the tree already names them. `core` comes
  from the `Feature` type; try-outs from `tryOut`; the web-only and
  firmware-only presets from `check_presets.py`, read rather than copied.
  A check with an exception of its own keeps it in a list with a reason per
  entry, the way `check_presets.py` does.
- D4. `check:bom-schematic` is strict from its first day (finding 4) and runs
  `pdftotext` from poppler. That keeps `package-lock.json` out of the step.
- D5. The lock reads the PR's base from `PF_LOCK_BASE` (the workflow passes
  the base SHA). Without it, the base is the merge-base with `origin/dev`,
  then `origin/main`; with neither, it skips. A new locked file passes. A
  locked file moved with its plain text unchanged passes and prints that the
  move needs the maintainer's approval on the PR (§2.9); any other change to
  locked text fails.
- D6. `check:voice` is not in `check:ci`. §2.10 runs it before a PR opens,
  and a person reads the text before merge. With no arguments it reads the
  lines a branch adds against the same base as the lock.
- D7. Branches, labels and descriptions as in the step 1 plan's D4.

## The PRs in detail

Every PR runs `npm run typecheck`, `npm run lint` and `npm run check:drift` in
`web/` (k2 and k8 run their script directly until k1 lands), and quotes one
failing run made on a throwaway edit, reverted before commit. A check is
proved when it fails on drift, not only when it passes.

k1. `drift.ts` runs each check in its own process, prints one line per check
(passed, failed, skipped), and exits 1 if any failed; a name argument runs
one. `_lib.ts` is the base the other checks import: `ROOT`, `tracked()`,
`read()`, `compare(name, left, right)` (each side a label and a list; prints
both sides and what is on one side only, as §2.4 asks), `skip(name, why)`
(D2) and `done()`. In `package.json`: `check:drift`; `check:links-absolute`,
`check:bom`, `check:bom-schematic`, `check:features`, `check:editions`,
`check:presets`, `check:roadmap` and `check:changelog`, each
`tsx scripts/drift.ts <name>`, which says so and fails while the file is not
written; `check:human-lock` (`tsx scripts/human-lock.ts`) and `check:voice`
(`tsx scripts/voice-lint.ts`); and `&& npm run check:drift` at the end of
`check:ci`. `features.ts` compares the ids with the folders (finding 5).
Runs the whole `check:ci`.

k2. `doc-map.ts` gets a `--check absolute` mode: the same rows, nothing
written, exit 1 on an absolute row that does not resolve. A row on a ref the
clone lacks is a skip (D2). The mode also fails on a tracked file outside the
map's sources that carries a repository URL, since the map would not read it.
`links-absolute.ts` runs that mode and imports nothing from k1. Proof that the
map did not move: both CSVs byte-identical before and after
(`git diff --exit-code`).

k3. `_bom.ts` reads `bom_v3.9.csv` and expands `SW1-SW4`. `bom.ts` matches
the on-board rows by MPN, then quantity and ref, with the sockets row as in
finding 3; the off-board rows in order, by quantity and the words of the part
name. Dashes compare equal. `bom-schematic.ts` runs
`pdftotext -layout hardware/pcb/schematic.pdf -` and compares the tokens with
a refdes prefix (U, SW, J, C, and R, D, Q, L, F for a part not yet on the
board) with the BOM's refs. This is hard rule 2 as a check; no file under
`hardware/` or `BUILD_GUIDE.md` changes.

k4. `editions.ts` compares five lists (finding 6): the cards bar `core`, the
bundle folders, the try-outs, the folders in `web/public/flash/bin/` against
the images the cards, try-outs and manifest name, and the two `EDITIONS`
tuples. Versions stay `check_versions.py`'s job.

k5. `presets.ts` reads `WEB_ONLY` and `FIRMWARE_ONLY` out of
`check_presets.py`. Drift: a `pattern-*.ts` that `index.ts` does not import,
or the reverse; a twin in neither `pattern_registry.h` nor `basics.json`'s
`presets`; a pack entry with no twin (finding 7).

k6. `roadmap.ts` asks `gh api repos/engmung/Patternflow/issues/<n>` for each
number. Drift: `done` with an open issue, `planned` with a closed one. A
worker cannot read that repository from a session scoped to the fork, so the
PR proves the logic against a stub `gh` on `PATH` giving each answer, and its
own run in k10's workflow is the first real one. If that run finds drift,
k6 stays open and k14 goes first (question 12).

k7. `changelog.ts`: each release section in the root equals its
`docs/releases/vX.Y.Z.md` once the relative links are put back (B1's rewrite,
undone); each "Older releases" line names a file that exists; and every
`vX.Y.Z.md` (not `-notes`, not `-launch`) is in the root in full or in the
list. It reads the same layout `release.py cut` writes, so a release stays
green.

k8. `human-lock.ts` takes the regions in finding 10, plus each path in
`docs/.human-written`. Plain text is the region with Markdown and MDX syntax
(link targets, image paths, tags, emphasis marks, heading marks) and all
whitespace removed; front matter values count as text. The roadmap strings
come out through the TypeScript parser, as `doc-map.ts` already does. A
README region runs from its `##` heading to the next. `lib/pr-base.ts` finds
the base (D5) and the files changed since it, for k9 too.
`docs/.human-written` starts with a comment line and no path (answer 5). No
locked text changes in this PR.

k9. `voice-lint.ts` reads its banned list from `docs/voice-banned.txt` and
flags the patterns §2.10 names: banned words and phrases (English by word,
Korean as written), a list of three adjectives or clauses, an opening that
says what the document is about, and a closing summary. It prints
`file:line` and the rule. Arguments are files; none means the added lines
since the base (D6).

k10. `.github/workflows/drift.yml`, named "Drift checks", on every pull request
and on push to `main`. Checkout with `fetch-depth: 0` (tags, and the base for
the lock); Node 20 and `npm ci` in `web/`; poppler if `pdftotext` is missing;
`npm run check:drift` with `PF_DRIFT_STRICT=1` and
`GH_TOKEN: ${{ github.token }}`; on a pull request, `npm run check:human-lock`
with `PF_LOCK_BASE` set to the base SHA, in a step that runs once
`web/scripts/human-lock.ts` exists. Permissions `contents: read` and
`issues: read`. Each check that lands after it runs strict on its own PR.

k11. Append §2.10's block to `AGENTS.md` as the RFC writes it. Under "Common
commands", one line each for `check:drift` (in `check:ci`, and strict in
`drift.yml`), `check:human-lock` (on pull requests) and `check:voice` (by
hand, before a PR with new prose). `firmware-checks.yml` runs on any
`AGENTS.md` change, so the PR runs `python firmware/toolchain/check_versions.py`
too.

k12. The four files say what CI runs: `CONTRIBUTING.md`'s table row for web
work, `web/README.md`'s command list, the tests paragraph of
`web/ARCHITECTURE.md`, and the line on `check_links.py` in
`docs/REPOSITORY.md`. One sentence each where one is enough.

k13. After every other k has merged: regenerate both CSVs, check §2.4's "done
when" (seven scripts, in CI, passing at HEAD) and the three added here, and
write step 2 into `docs/rfc-cleanup-progress.md` the way step 0 is written.

k14. Only if k6's first CI run finds drift. The PR lists each mismatch and
changes only what the maintainer decides for it: a node's `status`, or a
number in its `issues`. The `detail` and `detailKo` strings are locked. An
issue the maintainer calls open on purpose goes into k6's own list instead,
with the reason given. It is the one PR here that touches `web/src/`, so it
runs `check:ci`, `check:panels`, `typecheck` and `lint` (§2.1).

## Questions for the maintainer

Numbered on from the step 1 plan's eleven. Each has the default the PRs use
until there is an answer.

12. A roadmap node marked `done` whose issue is still open: drift, or allowed?
    Default: k14 asks per item, and nothing goes on k6's list without your
    reason.
13. Your own edit to locked text (a typo in a journal post) turns
    `check:human-lock` red. Default: no override file. You merge over the red
    row or push the edit yourself.
14. Should `check:voice` gate CI? Default: no, it is run by hand (D6).
15. Keep `check_presets.py` and `check:presets` as two scripts? Default: yes.
    k5 reads the Python file's lists, so they cannot disagree.
