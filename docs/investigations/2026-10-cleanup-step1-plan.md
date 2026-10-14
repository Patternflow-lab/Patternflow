# Cleanup step 1: the plan

*For [rfc-cleanup.md](../rfc-cleanup.md) §2.3. Scouted on 14 October 2026 at
`5b9b744` on `dev`, the merge of step 0. Nothing here is implemented.*

Step 1 has five jobs: settle the root, move the v2 build guide, settle where
the README's narrative lives, split the changelog, and list the
Korean/English pairs. Two of them wait on the maintainer (§2.13 questions 1
and 2). This plan cuts the step into three
lanes that never edit the same file, so three people can work at once, plus
one closing PR after they land.

## The lanes

| lane | PR | what | files it may edit | when |
| --- | --- | --- | --- | --- |
| A | A1 | `BUILD_GUIDE_v2.md` → `docs/legacy/` | `BUILD_GUIDE_v2.md`, `docs/legacy/`, `README.md`, `BUILD_GUIDE.md`, `AGENTS.md`, `docs/README.md`, `docs/REPOSITORY.md`, `docs/assembly/README.md`, `hardware/README.md`, `hardware/case/README.md`, `web/src/components/sections/BuildPanel.tsx`, `web/src/components/sections/BuildPanel.test.tsx`, `web/src/components/guide/stage/build/layout.ts` | now |
| A | A2 | the other root moves | the moved files and their new homes, `CONTRIBUTING.md`, `README.md`, `AGENTS.md`, `docs/README.md`, `docs/REPOSITORY.md`, `.github/ISSUE_TEMPLATE/config.yml`; if `AUDIO_GUIDE.md` moves, also `firmware/README.md`, `tools/patternflow-audio-extension/README.md`, `web/src/app/features/features-data.ts`, `web/src/components/guide/copy/audio.ts` | after question 1, after A1 merges |
| A | A3 | README narrative → `docs/story.md` | `README.md`, `docs/story.md`, `docs/README.md` | after question 2, only if the answer is "move"; after A2 |
| B | B1 | split `CHANGELOG.md` into `docs/releases/` | `CHANGELOG.md`, `docs/releases/`, `docs/RELEASING.md`, `firmware/toolchain/release.py`, `web/src/app/roadmap/roadmap-data.ts` (the `links` arrays only) | now, beside A1 and C1 |
| C | C1 | the parity CSV | `web/scripts/doc-map.ts`, `docs/investigations/2026-10-doc-parity.csv`, `docs/investigations/2026-10-doc-map.csv` | now, beside A1 and B1 |
| C | C2 | the doc map reads `.yml` too (optional) | `web/scripts/doc-map.ts`, `docs/investigations/2026-10-doc-map.csv` | after C1, before A2 if it can |
| C | C3 | close step 1 | `docs/investigations/2026-10-doc-map.csv`, `docs/investigations/2026-10-doc-parity.csv`, `docs/README.md`, `docs/REPOSITORY.md`, `docs/rfc-cleanup-progress.md` | after every A and B PR has merged |

A file sits in one lane. A lane that finds it needs a file from another lane
does not edit it: it writes the change it needs into its PR description under
"for another lane", and the owner (or C3) carries it.

Three lanes means three people at most, one per lane. Inside a lane the PRs go
in order. At most five cleanup PRs are open at once (§2.11); this plan opens
three at the start.

Two shared things need a rule of their own:

- **`docs/investigations/2026-10-doc-map.csv`** is committed only by lane C.
  A and B run `npm run doc-map` in `web/` to prove their move left no row at
  `resolves = no`, quote the two summary lines in the PR description, then
  `git checkout docs/investigations/2026-10-doc-map.csv` before committing.
  Run `git fetch --tags` first, or the 24 tag-ref rows read `no`.
- **The map documents** (`AGENTS.md`, `docs/README.md`, `docs/REPOSITORY.md`)
  belong to lane A while it is moving files, and to C3 at the end. Lane B
  needs a sentence changed in `docs/README.md` (finding 4); it hands that
  sentence to C3.

## What the tree says

What the scouting found, and why the lanes are drawn where they are. The
first three the RFC did not know about.

**1. `docs/releases/` already exists.** It holds `v3.0.0.md` and `v3.1.0.md`,
long-form notes for those releases, and `v3.0.0-launch.md`, the launch
checklist. The split wants `docs/releases/v3.0.0.md` and `v3.1.0.md` for the
changelog sections. Nothing in the tree links either file; `docs/README.md`
links the folder, and `v3.0.0-launch.md` names `v3.0.0.md` inside a code
block, as the command that was run.

**2. None of the three pair kinds §2.3 names exists.** There is no `*.ko.md`
file. The console pages are English only. `features-data.ts` has no
`detailKo`. The pairs the repository does keep:

- `web/content/journal/<slug>.mdx` (Korean) and `<slug>.en.mdx` (English):
  37 slugs, every one paired.
- `web/src/app/roadmap/roadmap-data.ts`: `title`/`titleKo` and
  `detail`/`detailKo`, 84 items.
- `web/src/lib/atlas/data.ts`: `nm`/`nmEn`, `tex`/`texEn`, `knob`/`knobEn`,
  `risk`/`riskEn`, `label`/`labelEn`, `vert`/`vertEn`, `legend`/`legendEn`,
  `impl`/`implEn`. Here the bare field is Korean.
- The guide's copy, an `en` and a `ko` object per file:
  `web/src/components/guide/copy.ts`, `copy/{audio,build,community,hub,lab,make}.ts`,
  `desk/words.ts`, `desk/community/words.ts`, `desk/ai/answers.ts`. The type
  makes both sides carry the same keys, so only "shorter by a third" can show.
- The guide's routes: `web/src/app/guide/**/page.tsx` and their `ko/` twins,
  five pairs.

`docs/SERVICES.md` is Korean only, and `docs/manifesto.md` and
`CODE_OF_CONDUCT.md` mix both languages in one file. None of the three has a
twin to compare against.

**3. The doc map does not read `.yml`.** `.github/ISSUE_TEMPLATE/config.yml`
links `SUPPORT.md` by absolute URL and is not in the map. Mentions in
backticks are not links either, and the map skips them:
`AGENTS.md`, `docs/README.md` and `docs/REPOSITORY.md` all name the root files
that way. A move PR runs `git grep <filename>` as well as reading the map.

**4. The changelog.** 947 lines: a header, `[Unreleased]`, then 30 release
sections from `[3.11.0] - 2026-10-04` down to `[v1.0.0] - 2026-04 (initial
public release)`. Headings are not uniform: two carry a `v` and a title
(`[v1.1.0] - 2026-04 (Multi-pattern Update)`), and the July ones have no day
(`[3.2.0] - 2026-07`). The sections hold six relative links, one each (to
`BUILD_GUIDE.md`, three investigations, `panel-compatibility.md`,
`pfst-v2-spec.md`) that need `../../` once a section sits in
`docs/releases/`, and eight root-relative ones that do not change.

Four places say the root file is the whole record and stop being true after
the split: the changelog's own header, `docs/RELEASING.md` ("one section per
release, newest first"), `docs/README.md` line 52, and the banners of the two
long-form notes in `docs/releases/`.

`firmware/toolchain/release.py` is the only code that reads it.
`bump_changelog` (`cut`) turns `[Unreleased]` into a dated section;
`changelog_section` (`publish`) reads that section back for the dev → main PR.
Nothing in CI and nothing in `firmware-release.yml` reads it; `shelf.sh`
names it in one error message. `roadmap-data.ts` links it twice, once with
the label "CHANGELOG (2.0.0)", and 2.0.0 will not be in the root file after
the split.

**5. The v2 guide.** Step 0's baseline already counted the links in: five
Markdown files and `BuildPanel.tsx` with its test, none anchored. Beyond the
links, it is named in backticks in `AGENTS.md` (the repository map and hard
rule 5, "`BUILD_GUIDE_v2.md` section 10"), in `docs/README.md` (the rule
"a guide somebody follows start to finish lives at the repository root"), in
`docs/REPOSITORY.md`, and in a comment in `layout.ts`. It carries 31 relative
links out, 22 of them to `docs/build-guide/images/`.

`roadmap-data.ts` names it in a `detail` and a `detailKo` string ("…
BUILD_GUIDE_v2.md for existing builds."). That is locked text (§2.9) and it
records the past; it stays. The changelog names it the same way, as history.

`web/next.config.ts` redirects paths on patternflow.work. The site has no
route that serves the v2 guide; the one link goes to github.com, which
`next.config.ts` cannot redirect. So A1 adds no redirect.

**6. The root.** 17 tracked files that do not start with a dot. The default
list in §2.3 keeps ten (`README.md`, the three guides, `CONTRIBUTING.md`,
`CHANGELOG.md`, `AGENTS.md`, the three `LICENSE` files). The other seven:

| file | what decides where it can live |
| --- | --- |
| `BUILD_GUIDE_v2.md` | §2.3 moves it to `docs/legacy/` whatever the answer to question 1. Lane A1. |
| `CLAUDE.md` | Claude Code loads it only from the root. It is the one-line shim that loads `AGENTS.md`; moved, Claude Code sessions start without the hard rules. |
| `CITATION.cff` | GitHub's "Cite this repository" reads it only from the root. Nothing links it. |
| `CODE_OF_CONDUCT.md`, `SECURITY.md`, `SUPPORT.md` | GitHub finds each of them in the root, `docs/` or `.github/`, so a move keeps the community profile and the security tab. 6 links in, plus the absolute one in `config.yml`. |
| `AUDIO_GUIDE.md` | `docs/README.md`'s rule puts it at the root; the default list does not. 6 links in, two of them absolute from the site (`features-data.ts`, `guide/copy/audio.ts`). |

**7. The README's narrative.** "Where it began" (line 39, 12 lines), "The
community responded" (line 51, 23 lines), "Story so far" (line 271, 23
lines). Under "Story so far" sits `### Sponsor`, PCBWay's credit, which is
not narrative. Nothing links the three anchors. The sections carry five
relative paths: two images (`./docs/media/community-builds.jpg`,
`./docs/media/web-build-map.png`), `integrations/README.md`,
`docs/EDITIONS.md`, and `#contributing`, an anchor in the README itself. A
verbatim move rewrites those five and nothing else.

**8. Where the RFC and the worker rules disagree.** §2.11 names branches
`cleanup/<step>-<name>` and asks for a three-line PR description; the hub
hands each worker its branch name and reads it back, and asks for a longer
description. §2.1 caps a PR at 300 changed lines; the changelog split copies
about 920 lines. The worker rules say a worker does not edit `CHANGELOG.md`
unless its task says so; B1's task is to edit it.

## Defaults this plan takes

Each is the reasonable reading where the RFC is silent or the tree surprised
it. A lane follows them unless the maintainer answers otherwise (last
section).

- **D1. The two long-form notes give up their names.** `docs/releases/v3.0.0.md`
  becomes `v3.0.0-notes.md` and `v3.1.0.md` becomes `v3.1.0-notes.md`, by
  `git mv` with no text change, next to `v3.0.0-launch.md`. `vX.Y.Z.md` is
  then always the changelog section. Their banners and the launch checklist's
  code block stay as written.
- **D2. Every release gets a file, the newest three too.** The root keeps the
  header, `[Unreleased]`, the three newest sections in full, and a list
  linking every older file. `release.py cut` writes `docs/releases/vX.Y.Z.md`
  for the new release and replaces the fourth-newest section in the root
  with its line in that list. The three newest then exist twice; finding that
  drift is a step 2 check, not part of step 1 (question 9).
- **D3. Verbatim text does not count toward the 300 lines** when the PR proves
  it is verbatim. For a `git mv` git shows the rename. For the changelog the
  PR runs a reassembly check (B1 below) and quotes its output. Every other
  line in the PR stays under 300.
- **D4. Branches, labels, descriptions.** Lanes use the branch the hub gives
  them. The RFC's three lines (what moved, which §2.1 commands ran, which
  doc-map rows it touched) go into the description as their own section.
  Labels `cleanup` and `step-1` go on if the tools allow it.
- **D5. Community files move to `docs/`, not `.github/`**, because §2.3 says
  "move under `docs/`" and GitHub reads both. Only if question 1 moves them.
- **D6. No redirect and no stub for the v2 guide** (finding 5). An outside
  link to `blob/main/BUILD_GUIDE_v2.md` breaks. A1 lists any it can find (the
  fork's release bodies, if the tools reach them) for the maintainer, who can
  edit a release body; a worker does not.

## Lane A: moves at the root

**A1, now.** `git mv BUILD_GUIDE_v2.md docs/legacy/BUILD_GUIDE_v2.md`, then:

1. Rewrite the 31 relative links inside it for its new depth
   (`docs/build-guide/…` → `../build-guide/…`, `hardware/…` →
   `../../hardware/…`). `<img src>` tags too. No word changes.
2. Point the five Markdown links at the new path, and the site link in
   `BuildPanel.tsx` (`…/blob/main/docs/legacy/BUILD_GUIDE_v2.md`). Change the
   expected `href` in `BuildPanel.test.tsx` to match. The test keeps checking
   the link; only the path it expects moves.
3. The backtick mentions: `AGENTS.md` (repository map; hard rule 5 becomes
   "`docs/legacy/BUILD_GUIDE_v2.md` section 10"), `docs/README.md` (drop it
   from the root-guides list in the rule, add one line for `legacy/`),
   `docs/REPOSITORY.md` (root row, and the `docs/` row), and the
   `layout.ts` comment.
4. Leave alone: the `detail`/`detailKo` strings in `roadmap-data.ts`, every
   mention in `CHANGELOG.md`, and `docs/releases/v3.0.0.md`'s link to
   `v3.0.0:BUILD_GUIDE_v2.md` (a tag ref, still valid).

Checks: `python .github/scripts/check_links.py`; `npm run doc-map` (0 do not
resolve, CSV discarded); `git diff -M --stat dev` shows the rename; and
because the PR touches `web/src/` and `AGENTS.md`, `npm run check:ci`,
`check:panels`, `typecheck`, `lint` in `web/`, and
`python firmware/toolchain/check_versions.py` (it parses `AGENTS.md`, and
`firmware-checks.yml` runs on any `AGENTS.md` change). `build.sh all` does not
apply: no file under `firmware/` changes.

**A2, after question 1.** Whatever the answer moves, with the same steps:
`git mv`, rewrite the moved file's own relative links, every inbound link
from the map, every backtick mention from `git grep`, and the absolute URL in
`.github/ISSUE_TEMPLATE/config.yml` if `SUPPORT.md` moves. `CHANGELOG.md`'s
mentions stay (history). If `AUDIO_GUIDE.md` moves, the PR touches `web/src/`
and runs the four web commands.

**A3, after question 2, only if the answer is "move".** Copy the three
sections verbatim to `docs/story.md` and rewrite the five paths in finding 7
for the new folder (`./docs/media/…` → `media/…`, `integrations/README.md` →
`../integrations/README.md`, `docs/EDITIONS.md` → `EDITIONS.md`,
`#contributing` → `../README.md#contributing`). Leave one line in the README
pointing at it, and keep `### Sponsor` with its images in the README. The
maintainer approves on the PR (§2.9: moving locked text). Lane A's last PR.

Done when: the root holds only the files question 1 agreed, and every move
carried its inbound links in the same PR.

## Lane B: the changelog

**B1, now.** One PR. Its task text must say that editing `CHANGELOG.md` is the
job.

1. D1: `git mv` the two long-form notes to `-notes.md`.
2. Write `docs/releases/vX.Y.Z.md` for each of the 30 sections: the heading
   line and the body exactly as they are in the root, with only the six
   relative link paths rewritten. File names always carry the `v`
   (`[3.11.0]` → `v3.11.0.md`, `[v1.1.0]` → `v1.1.0.md`).
3. Root `CHANGELOG.md` (D2): header, `[Unreleased]` untouched (the hub writes
   PR lines into it), `[3.11.0]`, `[3.10.5]`, `[3.10.4]` in full, then one line
   per older release linking its file. Rewrite the header sentence that says
   this file is the complete record; it is the only new prose.
4. `release.py`: `cut` also writes `docs/releases/vX.Y.Z.md` and drops the
   fourth-newest section from the root to a list line; add the new file to the
   paths `cut` commits. `publish` keeps reading the newest section from the
   root, where it still is. Update the docstring.
5. `docs/RELEASING.md`: step 3 of the checklist and "Current release line"
   say what a release now writes.
6. `roadmap-data.ts`: point the "CHANGELOG (2.0.0)" link at
   `docs/releases/v2.0.0.md`. Only `href` values in `links`; no `detail` or
   `detailKo` string.
7. For C3: the replacement for `docs/README.md` line 52 ("`CHANGELOG.md` at
   the root is the complete record"), and whether `docs/REPOSITORY.md`'s
   `docs/` row should name `releases/`.

Checks:

- **Reassembly.** A scratch script (not committed) rebuilds the original
  `CHANGELOG.md` from the root's header and `[Unreleased]` plus every
  `docs/releases/vX.Y.Z.md` in order, with the link rewrite undone, and
  `diff`s it against `git show dev:CHANGELOG.md`. Empty diff, quoted in the
  PR. A second diff shows the three sections left in the root are equal to
  their files.
- **`release.py` dry run** in a throwaway worktree
  (`git worktree add`, then `cut v3.11.1 --no-build --no-commit
  --no-web-checks --any-branch`; `[Unreleased]` has entries, so the dry run
  dates them), showing the new file written and
  `[3.10.4]` leaving the root. Remove the worktree after.
  `python -m py_compile firmware/toolchain/release.py`.
- `check_links.py`, `npm run doc-map` (CSV discarded), and for
  `roadmap-data.ts` the four web commands. The PR touches
  `firmware/toolchain/`, so `firmware-build.yml` and `firmware-checks.yml`
  run on it in CI; that is the `build.sh all` record, since this container
  cannot reach the PlatformIO registry (baseline). No `.pfm` cache key can
  move: no header or toolchain file changes.

Done when: 30 files exist, the reassembly diff is empty, `release.py` and
`RELEASING.md` describe the same release, and `docs-links.yml` is green.

## Lane C: the parity list, then the close

**C1, now.** `doc-map.ts` gains a second output,
`docs/investigations/2026-10-doc-parity.csv`, one row per pair. A suggested
shape: `kind, en, ko, en_chars, ko_chars, state`, where `state` is `ok`,
`missing-en`, `missing-ko`, `en-short` or `ko-short` (one side under two
thirds of the other, counting characters with markup stripped). Sources are
the five kinds in finding 2. The CSV header or the script's doc comment says
that the three kinds §2.3 lists do not exist yet, so a later `*.ko.md` lands
in the same output. Characters are a rough measure across two scripts; the
column records the numbers so the maintainer can judge rather than trust the
flag. No translation, no edit to any source file. Regenerate the doc map too,
since the same command writes both.

Checks: `npm run doc-map` twice gives byte-identical CSVs; `typecheck` and
`lint` in `web/` (a script under `web/scripts/`, not `web/src/`).

**C2, optional.** Add `.yml` and `.yaml` under `.github/` to the doc map's
sources, so `config.yml`'s link shows up (finding 3). Small; lands before A2
if it can.

**C3, last.** After every A and B PR has merged: regenerate both CSVs, carry
B1's sentence into `docs/README.md` and `docs/REPOSITORY.md`, check §2.3's
"done when" list (root, inbound links, `docs-links.yml`, the parity CSV), and
write step 1 into `docs/rfc-cleanup-progress.md` the way step 0 is written
there.

## Questions for the maintainer

The first two are §2.13's own, numbered as there, and A2 and A3 wait on
them.

1. **Which files stay at the root?** Suggested: the default list plus
   `CLAUDE.md` and `CITATION.cff` (both work only at the root), and
   `AUDIO_GUIDE.md` (`docs/README.md`'s rule calls it a root guide).
   `CODE_OF_CONDUCT.md`, `SECURITY.md`, `SUPPORT.md` move to `docs/` (D5).
2. **Do the README's narrative sections stay, or move to `docs/story.md`?**
   No default. Agents do not decide this (§2.3).

The rest come from the scouting, numbered on from §2.13's six. Each has the
default the lanes use until there is an answer.

7. **The two long-form release notes give their names to the split** (D1)?
8. **Verbatim text outside the 300-line count** when the PR proves it (D3)?
9. **A check that the root's three newest sections match their files** (D2):
   add it to step 2's table?
10. **Parity sources** are the five kinds that exist, not the three §2.3
    names (finding 2)?
11. **No stub or redirect for the v2 guide** (D6). Release bodies that link
    the old path are yours to edit.
