# RFC: cleanup before expansion

*Tidying the tree before any-resolution work starts. Written 2026-10-14.*

> **Status, 14 October 2026.** Proposed. Nothing in this RFC changes what
> the firmware or the site does. It changes where things live, what CI
> checks, and what an agent is allowed to write. The gate at the end (§2.12)
> is what has to be true before the any-resolution RFCs open.

This document is two things on purpose. **Part 1 is the maintainer, in his
own words.** **Part 2 is the specification** — precise and mechanical,
written so a contributor (or an AI agent handed this file) can implement
against it without asking what was meant.

---

# Part 1 — Why

패턴플로우를 확장하기 위한 밑작업과 다이어트

---

# Part 2 — The specification

## 2.1 Rules that hold for the whole cleanup

1. **No behaviour change.** A cleanup PR may move, rename, split, delete
   dead code, add a check, or add a test. It may not change what a build
   outputs. Every PR that touches `firmware/` or `web/src/` states in its
   description which of the following it ran, and all must pass:
   `firmware/bundles/build.sh all`, `npm run check:ci`, `npm run
   check:panels`, `npm run typecheck`, `npm run lint`.
2. **Output equality is proven, not asserted.** For firmware, the
   `.pfm` module cache keys (header SHA-256 + toolchain revision) must not
   change unless the PR is explicitly about the cache. For the site, the
   sandbox bundle (`npm run check:sandbox-sync`) and the console pages
   (`console-sync.yml`) must stay byte-identical unless the PR is about
   them.
3. **Human-written text is locked.** §2.9 lists the files. Agents may fix
   markup, layout, CSS and link paths in them. Agents may not change a
   word.
4. **Everything an agent writes reads like the maintainer wrote it.** §2.10.
5. **PR size.** Under 300 changed lines. One concern per PR. A PR that
   needs more than that is two PRs.
6. **Hard rules in `AGENTS.md` still apply**: founders boards stay private,
   the BOM triad stays in sync, the licence split is not touched, naming
   is not touched, the power-input description is not touched, nothing
   feature-shaped goes into `src/`.

## 2.2 Step 0 — baseline

Deliverables:

- `docs/investigations/2026-10-cleanup-baseline.md`: the commit SHA the
  cleanup starts from, and the output of every command in §2.1(1) at that
  SHA. If any of them is red before the cleanup starts, that is the first
  PR, and it is not a cleanup PR — it is a fix, reviewed as one.
- `scripts/doc-map.ts` (web workspace, reads the whole repo): for every
  `.md` and every `.tsx`/`.ts`/`.h` that contains a Markdown or HTTP link
  into the repo, emits `docs/investigations/2026-10-doc-map.csv` with
  columns `from, to, kind (relative|absolute-blob|absolute-raw|site|console),
  anchor, resolves (yes|no)`. The console pages in
  `firmware/patternflow/console/` and the site's redirect table are
  included as link sources, because those are the links a file move
  breaks silently.
- A one-line addition to `AGENTS.md` under its hard rules: *"During a
  cleanup window (see docs/rfc-cleanup.md) no PR changes behaviour; moves
  and renames carry a redirect or an updated link map."*

Done when: the baseline file exists, the map CSV has zero rows with
`resolves = no` that are not already listed as known-broken in the
baseline file, and CI is green.

## 2.3 Step 1 — document structure

**Root.** The guides that stay at the repository root are decided by the
maintainer before this step starts (§2.13, question 1). The default
proposal: `README.md`, `BUILD_GUIDE.md`, `PATTERN_GUIDE.md`,
`FEATURE_GUIDE.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `AGENTS.md`,
`LICENSE*`. Everything else at root is a candidate to move under `docs/`.

**README.** Keep the sections a first-time visitor needs to make, flash,
play, contribute and understand the licence. The narrative sections
("Where it began", "The community responded", "Story so far") are the
maintainer's writing. They are not rewritten. If the maintainer decides
they leave the README, they are moved **verbatim** to `docs/story.md`
with a one-line pointer left in the README. If he decides they stay, they
stay as they are. Agents do not decide this.

**Legacy build guide.** `BUILD_GUIDE_v2.md` moves to
`docs/legacy/BUILD_GUIDE_v2.md`. Before the move, the doc map (§2.2)
lists every link into it, including the site's anchored links to §1, §2,
§4, §8 and §10. The PR that moves the file updates every one of those
links in the same PR, and adds the old path to `web/next.config` redirects
if any external link is known to point at it.

**CHANGELOG.** Split by version into `docs/releases/vX.Y.Z.md`, one file
per release, text copied as written. The root `CHANGELOG.md` keeps the
three most recent releases in full and links the rest. `docs/RELEASING.md` is
updated so a release adds a file rather than prepending to the root.

**Korean/English parity.** `scripts/doc-map.ts` gains a second output,
`docs/investigations/2026-10-doc-parity.csv`: every bilingual pair the
repo maintains (`*.md` / `*.ko.md`, console page pairs, `features-data`
`detail`/`detailKo`), and which side is missing or shorter by more than a
third. No translation is done in this step; the list is the deliverable.

Done when: root contains only the agreed files, every moved file has
every inbound link updated in the same PR, `docs-links.yml` is green, and
the parity CSV exists.

## 2.4 Step 2 — drift checks

Each check is a script under `web/scripts/`, wired into `npm run check:ci`,
and fails CI on drift. Each prints the two sides it compared and the diff,
so a failure is readable without running anything locally.

| script | left side | right side | what counts as drift |
| --- | --- | --- | --- |
| `check:links-absolute` | every `github.com/engmung/Patternflow/blob/main/...` and `raw.githubusercontent.com/...` URL in the repo | the tree at HEAD | path or anchor that does not exist |
| `check:bom` | `hardware/bom/bom_v3.9.csv` | the parts table in `BUILD_GUIDE.md` | a designator, part or quantity present on one side only |
| `check:bom-schematic` | `hardware/bom/bom_v3.9.csv` | the schematic PDF's text layer (`hardware/pcb/*.pdf`) | a designator in the BOM that the PDF does not mention, or the reverse |
| `check:features` | `web/src/app/features/features-data.ts` ids | directories under `firmware/patternflow/features/` | an id without a directory, or a directory without an id |
| `check:editions` | `web/src/app/editions/editions-data.ts` | `firmware/bundles/*/` and `shelf.sh` output | an edition without a bundle, a bundle without a shelf entry |
| `check:presets` | the preset registry the site renders | `firmware/patternflow/presets/` after the feature cut list | a preset the site lists that no edition can compile, or the reverse |
| `check:roadmap` | `web/src/app/roadmap/roadmap-data.ts` items with an issue link | GitHub issue state via `gh api` (skipped offline) | `done` with an open issue, `planned` with a closed one |

`check:bom-schematic` may land as warn-only for one release if the PDF
text layer turns out not to carry designators; the PR says so and opens
an issue.

Done when: all seven scripts exist, run in CI, and pass at HEAD. A check
that fails at HEAD is not disabled; the drift it found is fixed first, in
its own PR.

## 2.5 Step 3 — code hygiene

**Web.**
- `npm run lint` and `npm run typecheck` at zero warnings. Rules are not
  relaxed to get there.
- Legacy paths and keys (`legacyDraft` keys in Pattern Lab, the `/variants`
  redirect, any route kept "for old links") either go, or get a comment
  that names the inbound link they exist for. A comment that says "legacy"
  without saying what points at it is not enough.
- Dependency updates: minor and patch versions in one PR per package
  family, `check:ci` green. Major versions (Next, React, Drizzle) are a
  separate PR each, and the maintainer approves before it is opened.

**Firmware.**
- `firmware/patternflow/src/hub75/` is a vendored fork of
  ESP32-HUB75-MatrixPanel-DMA. Produce `src/hub75/UPSTREAM.md` with the
  upstream commit it was taken from and `src/hub75/patternflow.patch`
  with the exact local changes (`blitRGB888` and whatever else). Then
  merge upstream fixes that do not touch the patched regions, one upstream
  commit per PR, `build.sh all` green and a flash-and-look on the
  reference panel noted in the PR by the maintainer.
- The five remaining `TODO`/`FIXME` markers become issues or get resolved.
  No new ones are added during the cleanup.

**Shared constants.** Values that both the firmware and the web harness
carry by hand — knob scale, detent count, encoder semantics, panel
geometry names — move to one source file, `shared/constants.json`, and
both sides generate from it (`firmware/patternflow/src/core_shared.h` and
`web/src/lib/shared/constants.ts`, both marked generated, both checked by
`check:shared` for staleness). The 24-vs-20 detent incident in the
firmware/web harness is the reason this step exists.

Done when: lint and typecheck are clean, every legacy path has a named
reason or is gone, `UPSTREAM.md` and the patch file exist, and
`check:shared` is in CI.

## 2.6 Step 4 — the test spine

**Contract vectors.** `docs/pfst-v2-vectors/` is the model. Each of the
other contracts gets the same: a directory of inputs and expected outputs,
and a smoke script that replays them.

| contract | vectors | script |
| --- | --- | --- |
| `docs/rest-api.md` | `docs/rest-api-vectors/` — request, expected status, expected body shape | `check:rest-vectors` |
| `docs/osc-spec.md` | `docs/osc-vectors/` — OSC packet bytes, expected parameter effect | `check:osc-vectors` |
| `docs/midi-spec.md` | `docs/midi-vectors/` — MIDI bytes, expected knob/pattern effect | `check:midi-vectors` |
| `docs/mqtt-spec.md` | `docs/mqtt-vectors/` — topic + payload, expected state | `check:mqtt-vectors` |
| `docs/audio-ws-spec.md` | `docs/audio-ws-vectors/` — frames, expected feature values | `check:audio-vectors` |

Vectors are derived from the spec text, not from current behaviour. Where
the firmware disagrees with its own spec, the vector encodes the spec and
the PR opens an issue; the firmware is not changed in this step.

**Virtual panel.** `tools/virtual-panel/`: a Node process that implements
the device side of the five contracts above over the same ports and
paths the firmware uses, renders to an in-memory 128×64 canvas (and, when
the harness is parameterised in §2.7, to any size), and exposes
`GET /frame.png` for assertions. It uses the web harness
(`web/src/lib/harness/`) for pattern execution so the two never drift. It
is a test fixture, not a product: no flashing, no OTA, no hotspot.

The maintainer decides which contract the virtual panel speaks first
(§2.13, question 3). The default order: REST, then MQTT, then OSC, MIDI,
audio.

Done when: five vector suites run in CI against the virtual panel and pass
for the contracts it implements, and the virtual panel runs the full
preset list from `firmware/patternflow/presets/` without a thrown error.

## 2.7 Step 5 — make room for expansion

No implementation. Two RFC drafts, Part 2 only (Part 1 is the
maintainer's), each in the format of this file:

- `docs/rfc-any-resolution.md`: the firmware path. Inventory of the 25
  `PANEL_RES_W/H` references in `src/`, the four in `features/`, the seven
  in `abi/`; a proposed runtime geometry struct with compile-time
  defaults; the module cache key extended with `W×H`; the console page
  for choosing geometry without reflashing; the harness matrix
  parameterised; what the virtual panel needs to render other sizes.
  Includes the limits as limits: classic HUB75 drivers only, S-PWM panels
  stay unsupported, the ESP32-S3 DMA framebuffer bound.
- `docs/rfc-linux-player.md`: the player path. The JS harness as the
  engine; output adapters for `rpi-rgb-led-matrix`, a Colorlight-class
  receiving card over Ethernet, and HDMI; input from USB encoders, MIDI,
  OSC and the web knobs; what of the five contracts the player speaks;
  what it cannot do (no `.pfm` modules, no browser flash).

Done when: both files exist, each has every section a reader needs to
estimate the work, and each ends with an open-questions list for the
maintainer.

## 2.8 Do not touch

- `web/src/app/compliance/` and the compliance page text — it is printed
  on the box.
- Preset file names under `firmware/patternflow/presets/`.
- `hardware/case/encloser.stl` and its name.
- Links baked into console pages, except through the doc map and a
  same-PR update.
- `hardware/founders/` (private) and anything that would commit it.
- `LICENSE`, `LICENSE-SUMMARY.md`, and the hardware/firmware/pattern
  licence split.
- The power-input description anywhere it appears.
- `.github/workflows/firmware-release.yml` and the release asset names.

## 2.9 Human-written text lock

These files and regions hold the maintainer's own writing. Agents may
change markup, layout, CSS, link paths and image paths in them. Agents
may not change, add, remove or reorder a sentence, and do not fix typos —
a typo is reported in the PR description or an issue.

- `web/content/journal/` — every file, every language.
- `docs/manifesto.md`.
- `web/src/app/roadmap/roadmap-data.ts` — the `detail` and `detailKo`
  strings.
- `README.md` — "Where it began", "The community responded", "Story so
  far".
- Part 1 of every RFC under `docs/`.
- `docs/releases/*.md` once split — moved verbatim, then locked.
- Any file the maintainer adds to `docs/.human-written` (one path per
  line; the lock script reads it).

`scripts/human-lock.ts` (`check:human-lock`) fails a PR that changes
non-markup characters in any locked region. It compares the plain text of
each locked file or region before and after, with Markdown syntax and
whitespace stripped.

Moving a locked file is allowed only with the maintainer's approval on the
PR, and only verbatim.

## 2.10 Writing voice

Append to `AGENTS.md`:

> ## Writing voice (hard rule)
>
> Everything an agent writes that a person will read — docs, README
> sections, release notes, console page copy, PR descriptions, comments —
> must read as if the maintainer wrote it. Not "polished". Written.
>
> Voice reference: `docs/voice.md` describes the project voice. Read it before writing anything longer than a sentence. Match its
> register (Korean: 해요체 or 합니다체 as the file already uses; English:
> plain, first person where the project already uses it), its sentence
> length, and its habit of naming the specific thing — the part number,
> the detent count, the date — instead of the category.
>
> Do not:
> - Open with what the document is about ("This document describes…",
>   "이 문서는 …을 설명합니다"). Start with the thing.
> - Close with a summary that repeats the body, or with "In conclusion" /
>   "결론적으로".
> - Turn prose into bullet lists, or bold phrases for emphasis. Bullets are
>   for lists of things.
> - Use these words or their Korean equivalents: seamless, robust,
>   leverage, comprehensive, streamline, empower, cutting-edge, ensure,
>   utilize, delve, "it's important to note", "here's", 효율적으로,
>   원활하게, 강력한, 최적화된, 혁신적인, 다양한, 전반적으로, 참고로,
>   살펴보겠습니다.
> - Write in threes ("fast, simple, and reliable"). One reason is a
>   reason; three is a pattern.
> - Join clauses with em dashes (—). End the sentence and start another.
> - Hedge every claim. Say it, or leave it out.
> - Add emoji, decorative headers, "Note:" callouts, or a "Generated by"
>   line.
> - Mention that an AI, an agent or a tool wrote or helped write the text.
>   Ever.
> - Reformat an existing human-written paragraph into another structure.
>
> Do:
> - Prefer one specific example over a general statement.
> - Vary sentence length. A short one can stand alone.
> - Keep the project's own terms (core, feature, edition, bundle, preset,
>   module) exactly as the existing docs use them.
> - For PR descriptions and commits: imperative first line, one line of
>   why, nothing else. No "This PR introduces…".
> - When unsure of tone, write less.
>
> Any new or rewritten text over 20 lines goes through
> `scripts/voice-lint.ts` (banned phrases, triplets, opener and closer
> patterns) before the PR is opened, and a person reads it before merge.

`docs/voice.md` is written by an agent at the maintainer's request (§2.13,
answer 6), and the maintainer reads it before merge. `scripts/voice-lint.ts` (`check:voice`) reads the banned list from
`docs/voice-banned.txt` so the maintainer can add to it without touching
the script.

## 2.11 PR protocol

- Branch names: `cleanup/<step>-<short-name>`.
- Labels: `cleanup`, plus `step-0` … `step-5`.
- Each PR description has three lines: what moved or changed, which §2.1
  commands ran, and which doc-map rows it touched (or "none").
- Batching: at most five open cleanup PRs at a time. The maintainer
  reviews in one sitting a week; agents do not open new PRs while five are
  waiting.
- A PR that fails a check added by an earlier step is fixed, not
  rebased around.
- Agents do not merge. Agents do not approve.

## 2.12 Order, and what "done" means

Steps run in order 0, 1, 2, 3, 4, with 5 allowed to start once step 2 is
merged. Inside a step, PRs are independent unless the step says otherwise.

The cleanup is done — and `docs/rfc-any-resolution.md` may move from
draft to proposed — when all of these hold at HEAD:

1. Every command in §2.1(1) passes.
2. Every script in §2.4, §2.5 (`check:shared`), §2.6 and §2.9
   (`check:human-lock`) runs in CI and passes.
3. The virtual panel speaks at least REST and MQTT and renders the full
   preset list.
4. The doc map has zero unresolved rows.
5. Root contains only the files agreed under §2.3.
6. Both RFC drafts from §2.7 exist.

## 2.13 Open questions for the maintainer

1. Which files stay at the repository root (§2.3)? Default list given.
2. Do the README's narrative sections stay, or move verbatim to
   `docs/story.md`?
3. Which contract does the virtual panel speak first (§2.6)? Default:
   REST.
4. Which major dependency updates, if any, are in scope this window
   (§2.5)?
5. Any file to add to `docs/.human-written` beyond the list in §2.9?
6. The three to five excerpts for `docs/voice.md`, and additions to
   `docs/voice-banned.txt`.

### Answers (maintainer, 2026-10-14)

1. The root keeps `README.md`, `BUILD_GUIDE.md`, `PATTERN_GUIDE.md`,
   `FEATURE_GUIDE.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `AGENTS.md`,
   `CLAUDE.md`, `CITATION.cff`, `LICENSE`, `LICENSE-MIT`, `LICENSE-CC-BY-SA`
   and the dotfiles. `CODE_OF_CONDUCT.md`, `SECURITY.md` and `SUPPORT.md`
   move to `.github/`, where GitHub still finds them. `AUDIO_GUIDE.md` moves
   to `docs/`. `BUILD_GUIDE_v2.md` moves to `docs/legacy/` as §2.3 says. A
   first-time visitor should be able to read the root at a glance.
2. The narrative sections stay in the README as they are.
3. REST first.
4. None. Major updates wait until the cleanup is done.
5. Nothing beyond §2.9.
6. An agent writes `docs/voice.md`. It does not quote the journal. It
   describes the voice the README and the build guide already use: short,
   specific, finished, nothing that reads as generated. One page at most.
   It is the first prose PR of step 1, and no other step 1 PR that writes
   prose opens before it is merged. `docs/voice-banned.txt` starts with
   the list in §2.10.
