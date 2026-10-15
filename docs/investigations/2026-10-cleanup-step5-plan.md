# Cleanup step 5: the plan

*For [rfc-cleanup.md](../rfc-cleanup.md) §2.7. Scouted on 15 October 2026 at
`d4668ad` on `dev`, after the step 4 plan merged and while step 1 was closing.
Nothing here is implemented.*

§2.7 gives step 5 no code. It asks for two RFC drafts, Part 2 only:
`docs/rfc-any-resolution.md`, the firmware path, and `docs/rfc-linux-player.md`,
the player path. Each ends with questions for the maintainer, and §2.12 counts
both toward the gate (its item 6). Step 5 is also the one step that runs beside
others: it may start once step 2 is merged, while steps 3 and 4 are still open.
Two things in the tree shape the drafts. The panel size is set or assumed in far
more places than the 36 §2.7 counts (finding 1). And the site already runs a
pattern at any size, while the device and the site's simulator of it do not
(findings 2 and 6). This plan cuts the step into four PRs.

## The PRs

| k | what | files it may edit | merges after | §2.13 |
| --- | --- | --- | --- | --- |
| 1 | where the panel size lives, as a record | `docs/investigations/2026-10-panel-geometry.md` | — | — |
| 2 | the any-resolution draft | `docs/rfc-any-resolution.md` | 1 | 3, 5 |
| 3 | the Linux player draft | `docs/rfc-linux-player.md` | 1 | 3, 5 |
| 4 | close step 5 | `docs/rfc-cleanup-progress.md`, `docs/README.md`, `docs/investigations/2026-10-doc-map.csv`, `docs/investigations/2026-10-doc-parity.csv`; in `docs/rfc-any-resolution.md` and `docs/rfc-linux-player.md`, the one line naming the other draft | 1, 2, 3; and step 3's k27 and step 4's k22 and k24 if one is open | — |

Step 5 opens when step 2 is closed (§2.12), so its PRs can be open beside step
3's and step 4's. k1, k2 and k3 each make a new file and share none with any PR
of any step. k1 waits on nothing. k2 and k3 can be written beside it and merge
after it, because both link its record. Three people can work at once, one per
row, inside §2.11's limit of five open cleanup PRs, counted across steps.

The shared places belong to k4: `docs/README.md`, the progress log and the two
doc-map CSVs. Step 3's k27 and step 4's k22 and k24 edit the same files, so k4
opens only when none of them is open. Until k4, each draft names the other in
backticks, and k4 turns both mentions into links. That line in each draft is the
one exception to a file sitting in one row, and it runs in order. Every other PR
runs `npm run doc-map` after `git fetch --tags`, quotes its two summary lines
and checks both CSVs out again.

No PR here edits `AGENTS.md`, `CHANGELOG.md`, `.github/` or `web/package.json`.
A draft changes no command, no path an agent works in and no workflow, and
`docs-links.yml` and step 2's checks already read a new file under `docs/`. A PR
that finds it needs one of them writes the change under "for another k", and the
change becomes a PR of its own after k4. Each PR's changelog line rides in its
description. Prose follows [voice.md](../voice.md) and goes through step 2's
voice lint (its k9, `web/scripts/voice-lint.ts`). Part 1 of every RFC is text
step 2's lock covers (its k8, `web/scripts/human-lock.ts`), and no PR here
writes any. Neither script is in the tree today, and this plan does not write
them again.

## What the tree says

1. The count. §2.7's 25, four and seven count occurrences of `PANEL_RES_W` and
   `PANEL_RES_H`, not lines. Under `src/` the 25 sit on 21 lines in six files,
   and eight of them are in comments (`core_display.h:18`, `core_mem.h:17`,
   four in `core_tables.h`). In `features/` the four are the clock's JSON and
   the weather preset. In `abi/` two of the seven are comments. The count leaves
   out where the size is set (`config.h`, 11), the presets (142 across all 35
   headers, with arrays sized by it in `preset_0629_2.h` and `preset_calib.h`),
   `PFCanvas::W` and `H` (`core_canvas.h:38`, aliased again in
   `core_thumbs.h:44`) and the 24 KB canvas buffer they size
   (`core_canvas.h:40`). It also leaves out the menus, which ask the driver
   (`dma_display->width()`, `core_ui_text.h`), and four sizes typed as numbers:
   `core_ui_text.h:16`, `preset_weather.h:491`, `console/clock.html:414` and
   `preset_0712_2.h:60`. The module toolchain types 128 and 64 too
   (`build_module.py:51`).
2. Geometry today is chosen at compile time. `config.h:81-108` offers three:
   one 128×64 module (the default), one 64×64, and two 64×64 chained into
   128×64, which `platformio.ini` builds as `firmware64x2`. Each sets the
   module size, the chain and the canvas, and two `#error`s hold the canvas to
   module width times chain. The driver IC is a separate line, `PANEL_PROFILE`
   (`config.h:168`). One call hands the geometry to the driver
   (`core_display.h:20`). A pattern already declares its own grid, with
   `setFrame` on the device and `// @matrix` on the site, and both put it on the
   panel directly, rotated or letterboxed by the same rule (`matrix.ts:127`
   says to keep the two in step). The panel is what no setting changes without a
   rebuild.
3. Modules. A `.pfm` is ESP32-S3 machine code built for one size.
   `pf_module.h:61-72` stops a build that lacks `-DPF_PANEL_W` and `H`, and the
   host and the module each refuse the other at a different size
   (`pf_module.h:312`, `core_module_loader.h:1145`). Both ABI structs already
   carry `panel_w` and `panel_h` (`pf_abi.h:82` and `117`), and the ABI is
   frozen at 1, append only. The cache key is `(source_sha, builder_rev)`
   (`web/src/lib/community/server/schema.ts:725`). The size reaches it only
   because `builder_rev` hashes `build_module.py`, where 128 and 64 are typed.
   The sidecar records `panel_w` and `panel_h`, and the device never reads them.
4. Memory. The driver allocates its row buffers once, at `begin()`, in internal
   DMA RAM (`MALLOC_CAP_INTERNAL | MALLOC_CAP_DMA`,
   `hub75/ESP32-HUB75-MatrixPanel-I2S-DMA.h:195`). `SPIRAM_DMA_BUFFER` is not
   set anywhere. A row takes width × colour depth × 2 bytes (`.h:168`), the
   depth is the default 8, and the display is double-buffered
   (`core_display.h:22`). By that formula 128×64 at 1/32 scan takes 128 KB, a
   figure the tree does not state. When a size does not fit, `begin()` fails with
   "Not enough memory" (`.cpp:123`). The vendored blit adds limits of its own:
   an even width and depth 8 for the fast path, and a timing argument worked out
   for 128 words at 16 MHz (`hub75/VENDORED.md:147-188`).
5. Panels. `config.h:153-160` and
   [panel-compatibility.md](../panel-compatibility.md) sort driver ICs into three
   tiers. Plain shift-register panels and panels that need an init sequence
   work. S-PWM panels (ICN2053, FM6353, MBI5051 and the rest) stay dark whatever
   is set, because they need a grey-scale clock the library cannot make
   (upstream issue 642, closed wontfix). They are built to be fed by a Novastar,
   Huidu or Colorlight receiving card, which is one of the outputs §2.7 gives
   the Linux player.
6. The site. `PatternRuntime` (`web/src/lib/pattern/harness.ts`) imports
   nothing and touches no DOM. It compiles a pattern with `new Function` and
   writes an RGBA buffer, and its constructor takes a width and a height, 128
   and 64 by default (lines 1, 2 and 486). `// @matrix` takes any size from 8 to
   512 (`matrix.ts:46`), and the sandbox resizes to it per pattern. 47 of the 48
   JS presets draw from `display.width` and `display.height`, and two of them,
   `pattern-0719.ts` and `pattern-0712-2.ts`, also type a size of their own.
   Fixed at 128×64: `DeviceSim` (through `panelScreens.ts:42`), the 3D panel's
   texture and shader (`LedMatrixTexture.ts:20`,
   `components/3d/patterns/common.ts:55`), the guide's preview
   (`Extras.tsx:185`) and the AI prompts (`gemini.ts:226`).
   `web/src/lib/harness/`, the folder §2.6 names, does not exist (step 4's
   finding 2).
7. Steps not yet merged. The any-resolution draft leans on two things that are
   only planned: `shared/constants.json`, which will hold the three geometries
   (step 3, k7), and the virtual panel, `DeviceSim` behind sockets with its width
   and height in one place (step 4, k2 and D1). Step 3's k8 keeps every use of
   `PANEL_RES_W` and `PANEL_RES_H` so that step 5 can count them. None of it is
   on `dev` today, and step 5 may start before any of it is.
8. Linux. Nothing in the tree runs on Linux, and nothing outside §2.7 names
   rpi-rgb-led-matrix or HDMI. Two builds on the site already run Patternflow on
   a Raspberry Pi: one with a 64×32 matrix (`InsideGlobe/builds.ts:130`), one a
   Pi 4 with a HUB75 HAT and its own firmware (`builds.ts:333`). A `.pfm` loads
   only through the device's relocator, and the flasher installs an ESP32-S3
   image with ESP Web Tools (`web/public/flash/manifest.json`), so neither
   crosses over, as §2.7 says. Knobs over the web today are the console's four
   sliders posting to `/api/params` (`console/home.html:112`). The site's knobs
   drive only its own preview, and no page asks for Web MIDI.
9. Contracts. Of the five, only `rest-api.md` states a size:
   `"panel": "128x64"` in status (line 48), the thumbnail as a 128×64 frame
   (274), the sidecar's `panel_w` and `panel_h` (284) and `/api/clock`'s `w`
   and `h` (499).
   OSC, MIDI, MQTT and the audio socket never name one. A device at another size
   changes REST and nothing else on the wire.
10. Settings. No console page stores a panel setting. The nearest is `/knobs`
    (`core_knobs_http.h`), which changes a hardware property without a rebuild
    and keeps it in NVS under `pf_knobs` (`core_encoders.h:102`). Brightness and
    the power budget are kept the same way. Because the DMA buffers are
    allocated at `begin()`, a geometry chosen on a page would take effect at the
    next boot.
11. The form. `rfc-cleanup.md` opens with a dated line, a status block and a
    paragraph saying Part 1 is the maintainer's and Part 2 the specification.
    §2.9 locks Part 1 of every RFC under `docs/`. Step 2's lock passes a new
    locked file and fails any later change to it (its D5), so Part 1 written into
    a draft after it merges turns `check:human-lock` red. Its finding 10 names
    Part 1 of two RFCs. Whether it reads a third depends on k8 listing files or
    reading every `docs/rfc-*.md`.

## Defaults this plan takes

- D1. The form. Each draft takes `rfc-cleanup.md`'s frame: the title, a dated
  line, a status block that says "Draft", the paragraph on Part 1 and Part 2
  copied as written, `# Part 1 — Why` with nothing under it, then
  `# Part 2 — The specification` in numbered sections, the last one "Open
  questions for the maintainer". The any-resolution status block names §2.12's
  gate as what moves it to proposed. The player's names nothing (question 34).
  Neither draft goes into `docs/.human-written` (answer 5): §2.9 already locks
  Part 1 of every RFC.
- D2. The inventory is a record. k1 lists every place the size is set or
  assumed, by file and line, with the SHA and the `git grep` behind each count.
  §2.7's three numbers keep rows of their own, so a reader can find 25, four and
  seven. The any-resolution draft carries a table per file and links the record
  (question 31).
- D3. The tree at the PR's SHA, plans for the rest. Facts come from `dev` when
  the PR opens. Where a draft leans on something not yet merged (finding 7), it
  names the plan and its k, writes the path in backticks, and says what changes
  for the draft if that plan changes.
- D4. No implementation. No code, no prototype branch, no build to measure. A
  number the tree does not state, like the DMA bytes for a size, is worked from
  the driver's formula with its file and line, and marked as arithmetic.
- D5. Estimates in this cleanup's units. Each proposal section ends with the
  files it would touch, how many PRs that is by §2.1's rule (300 lines, one
  concern), and whether those files are the core (hard rule 7), the frozen ABI
  (append only), a feature or the site. That is the unit the maintainer already
  reviews in.
- D6. Words. "Geometry" is `config.h`'s word for module size and chain. "Size"
  is the canvas, width × height. The player is a program, not an edition:
  edition, feature and core mean what `EDITIONS.md` says they mean.
- D7. Branches, labels and descriptions as in the step 1 plan's D4, with the
  label `step-5`.

## The PRs in detail

Every PR touches only `docs/`, so the commands in §2.1(1) do not apply. Each runs
`python .github/scripts/check_links.py`, `npm run doc-map` (CSVs checked out
again), `npm run check:voice` on what it adds and `npm run check:human-lock`,
and quotes the output. A person reads each draft before it merges (§2.10).

k1. `docs/investigations/2026-10-panel-geometry.md`, about 200 lines. A header
gives the SHA and the commands. Then a table per place, with file, line, code or
comment, and what the line does with the size: the 36 occurrences §2.7 counts;
`config.h`; `PFCanvas` and what reads it; the menus; the presets, one row per
file with its count and its arrays; the sizes typed by hand; the module
toolchain and the cache key (finding 3); HTTP and the specs (finding 9); the
driver's allocation and the blit's limits (finding 4); and the site (finding 6).
It proposes nothing. Proof: each count, run again from its quoted command, gives
the same number.

k2. `docs/rfc-any-resolution.md`, Part 2, under 300 lines, in sections sized by
D5:

- What changes and what stays: one ESP32-S3 and one chain; the stock 128×64
  build unchanged; `setFrame` and `// @matrix` as they are.
- Where the size lives: the table per file from k1, linked.
- The runtime geometry: a struct of canvas size, module size, chain and driver
  profile, filled from `config.h`'s values as compile-time defaults and from NVS
  at boot, before `begin()`. Which of the 36 read it instead of the macro, which
  stay compile-time and why (the presets' arrays, the macro in the frozen ABI),
  and what becomes an allocation (the canvas buffer).
- Modules: one build per size, `build_module.py` taking the size, the cache key
  gaining W×H as §2.7 asks, the schema migration that costs and the cheaper way
  (question 33), and what the device shows for a module built at another size.
- The console page: a core page, since the panel is the device (hard rule 7),
  kept in NVS like `pf_knobs` and applied at the next boot. It offers only
  geometries that fit the memory bound, and it says how to get back when a
  geometry leaves the panel dark. `/api/status`'s `panel` and the other REST
  lines in finding 9.
- The site: `PatternRuntime` already takes a size. What remains is `DeviceSim`,
  the 3D panel and the previews (finding 6), with `shared/constants.json` as
  their source (step 3, k7).
- The virtual panel at other sizes: its size from step 4's one place,
  `/frame.png` at that size, `/api/status` reporting it, REST first (answer 3),
  and `check:virtual-panel` run at a second size.
- The limits, stated as limits: classic HUB75 only (tiers 1 and 2), S-PWM
  unsupported (finding 5), the memory bound with the formula and a table of the
  sizes and depths that fit, and the blit's even width and timing (finding 4).
- The order of the work and its PR count.
- Open questions.

k3. `docs/rfc-linux-player.md`, Part 2, under 300 lines, in sections sized by
D5:

- What it is: a Linux process that plays patterns with the site's engine onto a
  panel or a screen. Not firmware, and not an edition.
- The engine: `PatternRuntime` under Node (finding 6), the JS presets and the
  Basics order, community patterns as JS, and the size taken from the output.
- The outputs, each with what it needs and what it costs. rpi-rgb-led-matrix on
  a Pi's GPIO or a HAT, and how a Node process reaches a C++ library (an addon,
  a child process or a pipe). A Colorlight-class receiving card over raw
  Ethernet, which also lights S-PWM panels and LED walls (finding 5). HDMI.
- The inputs: USB encoders, MIDI (ALSA and RTP-MIDI), OSC on 9001, and the web
  knobs as the console has them, sliders posting to `/api/params` (finding 8).
- The contracts: which of the five it speaks and in what order, REST first
  (answer 3). What it can share with step 4's virtual panel, which speaks all
  five in Node over `DeviceSim`, and what it must not take from it (the `/vp/`
  routes, the manual clock).
- What it cannot do: no `.pfm`, no browser flash, and none of the C++ features
  (weather, clock, shows, the microphone) unless they are written again.
- Where it lives and how it ships, with the two Pi builds on the site as prior
  work (finding 8, question 34).
- The order of the work and its PR count.
- Open questions.

k4. After k1, k2 and k3, and while none of step 3's k27 or step 4's k22 and
k24 is open: check §2.7's "done when" (both files, every section D5 asks for,
open questions last) and §2.12's sixth item. Turn each draft's backtick mention
of the other into a link. Give `docs/README.md` one line for each draft.
Regenerate both CSVs. Write step 5 into `docs/rfc-cleanup-progress.md` the way
step 0 is written, and mark item 6 met in the gate line. If step 2's lock does
not read the drafts' Part 1 (finding 11), the entry says so, and the fix to
`web/scripts/human-lock.ts` is a PR of its own.

## Questions for the maintainer

Numbered on from the step 4 plan's 29. Each has the default the PRs use until
there is an answer.

30. Part 1 of each draft stays empty until you write it. Written after the draft
    merges, it turns `check:human-lock` red (finding 11). Default: you write it
    on k2's or k3's branch before merge, which the lock reads as a new file;
    otherwise step 2's question 13 applies.
31. The inventory as a record of its own, with the draft carrying a table per
    file (D2)? §2.7 puts the inventory in the draft. Default: yes.
32. Which sizes does the any-resolution draft cost the work for? `config.h` has
    three geometries, the roadmap names 64×32, 128×64 and a commercial sign, and
    the site takes anything from 8 to 512. Default: what one ESP32-S3 can drive
    by finding 4's formula. Walls and signs go to the player.
33. §2.7 extends the cache key with W×H. The size already moves `builder_rev`
    through `build_module.py`, and a new column in the key is a migration of the
    community database. Default: the draft proposes the column, costs the
    migration and names the other way beside it.
34. Where does the player live: in this repository, or in its own, as the Home
    Assistant integration now does? And does it move to proposed with
    any-resolution at the gate? Default: the draft sets out both homes and picks
    neither, and it stays a draft until you say.
