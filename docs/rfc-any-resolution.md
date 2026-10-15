# RFC: any resolution, the firmware path

*A panel of another size without a rebuild. Written 2026-10-15.*

> **Status, 15 October 2026.** Draft. Nothing in it is built. It moves to
> proposed when the cleanup's gate holds
> ([rfc-cleanup.md §2.12](rfc-cleanup.md#212-order-and-what-done-means)).
> Facts are from `dev` at `a800fd3`, and what a step plan has not merged yet
> is named by its plan and its k.

This document is two things on purpose. **Part 1 is the maintainer, in his
own words.** **Part 2 is the specification** — precise and mechanical,
written so a contributor (or an AI agent handed this file) can implement
against it without asking what was meant.

---

# Part 1 — Why

---

# Part 2 — The specification

## 2.1 What changes and what stays

One ESP32-S3 drives one chain of classic HUB75 modules, as it does today. What
changes is when the panel's geometry is chosen. Today it is `PANEL_GEOMETRY` in
`config.h`, and another panel means another build. Here it is a value the
device reads from NVS at boot, chosen on a console page.

The stock build stays as it is. With nothing saved, the device runs
`config.h`'s geometry, 128×64 on one module, and draws the same frames. A
pattern still declares its own grid with `setFrame` on the device and
`// @matrix` on the site, and both keep the rule they share
(`core_canvas.h:137-163`, `matrix.ts:127`).

## 2.2 Where the size lives

[The panel geometry record](investigations/2026-10-panel-geometry.md) lists
every place, with the command behind each count. The 36 occurrences of
`PANEL_RES_W` and `PANEL_RES_H` that §2.7 counts, and what this RFC does with
each:

| where | uses | after this RFC |
| --- | --- | --- |
| `src/core_canvas.h:38-39` | 2 | read the geometry; the buffer becomes an allocation (§2.3) |
| `src/core_module_loader.h:601-602` | 2 | read the geometry; `hostAPI` is filled at boot |
| `src/core_module_loader.h:1145` | 2 | read the geometry |
| `src/core_status_http.h:282, 284` | 2 | read the geometry |
| `src/core_tables.h:52, 57, 70-76` | 9 | read the geometry |
| `features/clock/core_clock_http.h:116, 118` | 2 | read the geometry |
| `features/weather/preset_weather.h:492-493` | 2 | stay: a layout drawn at the default size |
| `abi/pf_module.h:71-72, 175-176, 281` | 5 | stay: a module's size is its build's |
| `abi/pf_abi.h:116`, `abi/pf_module.h:47` | 2, comment | stay, and stay true |
| `src/core_display.h:18`, `src/core_mem.h:17`, `src/core_tables.h:11, 24-26` | 8, comment | reworded where they call the macro the panel |

Nineteen read the geometry and nine stay compile-time. `PANEL_RES_W` and
`PANEL_RES_H` keep their meaning: in the firmware they are the default, and in
a module they are the size it was built for (`pf_module.h:71-72`).

## 2.3 The runtime geometry

`src/core_geometry.h` holds one value, read once at boot and never changed while
the device runs:

| field | compile-time default | NVS key, namespace `pf_panel` |
| --- | --- | --- |
| module width and height | `PANEL_PHYS_W`, `PANEL_PHYS_H` | `mw`, `mh` |
| chain | `PANEL_CHAIN` | `chain` |
| driver profile | `PANEL_PROFILE` | `prof` |
| canvas width and height | module width × chain, module height | none |

The canvas is derived, by the rule the two `#error`s hold today
(`config.h:110-115`). `PFGeometry::load()` runs in `setup()` before
`initDisplay()` (`patternflow.ino:482`). A key that is missing, or a value
outside §2.8's bound, gives the default. `initDisplay()` passes the module size
and chain (`core_display.h:20`) and the driver the profile names
(`core_display.h:25`), which today is the `HUB75_DRIVER` macro.

What stays compile-time, and why. The ABI carries the size as `panel_w` and
`panel_h` in both structs (`pf_abi.h:82-83`, `117-118`), frozen at version 1,
and a module reads its own size from its build. The presets' arrays live in
modules: only Origin and the calibration card compile into the firmware
(`pattern_registry.h:44-48`), and the other 33 reach a device as `.pfm` files
in `basics.zip`. Origin, the calibration card and weather's compact layout keep
the macro. Before a compiled-in pattern's `draw()`, the sketch calls
`setFrame(PANEL_RES_W, PANEL_RES_H)`, and `setFrame` centres it on a panel of
another size. On the default panel that is the straight path
(`core_canvas.h:142`) and nothing changes.

What becomes an allocation. The canvas, a global of W × H × 3 bytes
(`core_canvas.h:40-42`, 24,576 at 128×64), is allocated at boot in internal
RAM, where it sits today, because the blit reads it every frame. `PFThumbs::W`
and `H` (`core_thumbs.h:44-47`) become values. A thumbnail of another size is
already refused when read (`core_thumbs.h:149-152`) and is taken again.
`PFTables` already allocates (`core_tables.h:57-59`).

Touches `src/core_geometry.h` (new), `src/core_display.h`, `src/core_canvas.h`,
`src/core_thumbs.h`, `src/core_tables.h`, `src/core_module_loader.h`,
`src/core_status_http.h`, `patternflow.ino` and
`features/clock/core_clock_http.h`. Five PRs: the geometry and the driver, the
canvas and thumbnails, the tables with the loader and status, the compiled-in
patterns, the clock. Four are core and build every composition; the clock is a
feature. The frozen ABI is not touched.

## 2.4 Modules

A `.pfm` is ESP32-S3 machine code for one size, and it stays that way: one
build per size. `build_module.py` takes `--panel WxH`, default `128x64`, in
place of the pair typed at `:51-52`, and uses it where it passes the size
(`:258-259`) and writes the sidecar (`:323-324`). `make_pack.py` takes the same
flag for the manifest's `panel` (`:199`). The toolchain is hashed into
`builder_rev` (`builderRev.ts:45`), so this edit rebuilds every cached module
once, like any toolchain change. `basics.zip` stays the 128×64 pack.

The cache key gains the size, as §2.7 asks. `module_cache` gets a `panel`
column, `"128x64"` on every row it holds, in its primary key
(`schema.ts:727`). SQLite cannot change a primary key in place, so the
migration in `web/drizzle/` rebuilds the table: create, copy, drop, rename.
Every lookup and upsert in `moduleCache.ts` (lines 102, 117, 159, 198, 217 and
624) and the bake job (`builds`, `schema.ts:619`) carry the size, and the deck and pack
downloads take one, `128x64` when none is given. No page reads a device's
`/api/status` today, so the size comes from the person.

The cheaper way, beside it. The web derives the key's second column from the
published `builder_rev` and the size: `builder_rev` itself at 128×64, a digest
of the two at any other. The worker writes rows under the same value. That is
no migration and one PR, and `builder_rev` stops meaning the toolchain alone,
which `schema.ts:733-737` says it does.

What the device shows for a module built at another size. Today both sides
refuse (`core_module_loader.h:1143-1150`, `pf_module.h:312`). The panel shows
PATTERN FAILED and "module rejected host ABI or panel size"
(`patternflow.ino:907-945`), and `/api/status` carries it in `loadError`. A
saved pattern that fails at boot falls back to pattern 0
(`patternflow.ino:567-577`). After a geometry change, every module from the old
size does this until the pack for the new size goes in. So the device reads
`panel_w` and `panel_h` from the sidecar it already reads for `absoluteReady`
(`pattern_registry.h:65-67`), skips such a module while browsing the way it
skips a `hidden` one (`:60-64`), and the Patterns page lists it with its size.
The refusal stays, and the loader's reason names both sizes.

Touches `firmware/toolchain/build_module.py`, `firmware/toolchain/make_pack.py`,
`pattern_registry.h`, `src/core_module_loader.h`,
`console/patterns.html` with its generated header,
`web/src/lib/community/server/schema.ts`, `moduleCache.ts`, the build worker,
a migration, the download routes and the pack list (`packs.ts:54`). Six PRs with the column, five the cheaper
way: the toolchain, the device's skip and reason (core), the Patterns page
(core), the key (site, two), the downloads (site). No ABI change.

## 2.5 The console page

The panel is the device, so the page is core (hard rule 7): `console/panel.html`,
spliced into `src/panel_index.h` by `console_pages.py` (one more row in `PAGES`,
`:112`), and `src/core_panel_http.h` with `GET /panel`, `GET /api/panel` and
`POST /api/panel`, built the way `/knobs` is (`core_knobs_http.h:121-123`). It
keeps its values in NVS under `pf_panel`, as the knobs keep theirs under
`pf_knobs` (`core_encoders.h:100-124`). The driver allocates its rows once, in
`begin()`, so a saved geometry takes effect at the next boot. The page says so
and offers the restart.

It offers modules of 64×32, 64×64, 128×32 and 128×64, chains of one to four,
and the six profiles (`config.h:161-166`), and only the combinations inside
§2.8's bound.

The way back, in three cases. When `begin()` fails, the device today stops in
`while (1)` before Wi-Fi comes up (`core_display.h:71-74`). Here it erases
`pf_panel` and restarts, and stops only when the default fails. When the panel
stays dark or scrambled and the device runs, the console still answers,
`/api/status` says what it runs, and `/panel` puts the default back. With no
network, holding K4's button through power-on erases `pf_panel`. Nothing reads
a button at power-on today.

On the wire. `/api/status`'s `panel` reads the geometry
(`core_status_http.h:282-285`), `"128x64"` on the stock build. `/api/panel`
answers with the module size, the chain, the profile, the defaults and what is
saved for the next boot. In `rest-api.md` that is line 77 (`panel`), 274 (the
thumbnail as "the 128×64 frame"), 284 (the sidecar's pair is the build's) and
499 (`/api/clock`'s `w` and `h`), and a section for `/api/panel`. OSC, MIDI,
MQTT and the audio socket name no size, and they do not change.

Touches `console/panel.html`, `src/panel_index.h` (generated),
`src/core_panel_http.h`, `firmware/toolchain/console_pages.py`,
`patternflow.ino`, `docs/rest-api.md`, `docs/panel-compatibility.md` and the
comments in `config.h` that say to edit `PANEL_PROFILE`. Three PRs: the page
and its API (core), the button at power-on (core), the docs.

## 2.6 The site

`PatternRuntime` takes a width and a height (`harness.ts:486`), and
`// @matrix` takes anything from 8 to 512 a side (`matrix.ts:46-47`). The
parameterised harness §2.7 asks for is there.

What remains is `DeviceSim`, which builds its runtime at `PANEL_W` × `PANEL_H`
(`deviceSim.ts:167`, `panelScreens.ts:42-43`). It takes a width and a height,
defaulting to those two. The guide's stage, the 3D panel's texture and shaders
(`LedMatrixTexture.ts:20-21`, `vec2(128.0, 64.0)` five times) and the guide's
preview (`Extras.tsx:185, 248`) draw the stock device, and they stay at
128×64. The AI prompts already take a matrix (`gemini.ts:226, 387`). Pattern
Lab's C++ export writes the macro (`cppPrompt.ts:68`, `hExport.ts:165`), which
a module build fills per size. The pack list shows a pack's `panel` with the
downloads (§2.4).

`shared/constants.json` (step 3, k7) will hold the three geometries and the
default (step 3, D7). This RFC adds the module sizes the page offers and the
bound, and the generated files carry them to the page and to `DeviceSim`. If
k7 lands in another shape, both stay by hand in `config.h` and `panelScreens.ts`
and no check covers them.

Touches `web/src/lib/guide/deviceSim.ts` and its test, and
`shared/constants.json` with its two generated files. Two PRs, one on the site
and one shared.

## 2.7 The virtual panel at other sizes

Step 4 builds the virtual panel as `DeviceSim` behind sockets, with its width
and height in one place (step 4, k2 and D1). `start()` takes a size and
`main.ts` takes `--size 64x64`, default 128×64. `/frame.png` is that size.
`/api/status` reports it in `panel`, and `/api/panel` answers in the REST
transport (`transports/rest-state.ts`). A value posted there is kept until the
next `start()`, the way the device keeps it until the next boot. REST comes
first (answer 3), and the other transports name no size.

`check:virtual-panel` (step 4, k8) runs the preset list at 128×64 and again at
64×64. Every JS preset reads `display.width` and `display.height`, so the
second run tests the site's engine at another size. It does not test the
device's modules. Two presets type a size of their own (`pattern-0719.ts`,
`pattern-0712-2.ts`), and the check fails on a thrown error, not on a picture.

Touches `tools/virtual-panel/panel.ts`, `main.ts`,
`transports/rest-state.ts`, `web/scripts/drift/virtual-panel.ts` and one vector
in `docs/rest-api-vectors/`. Two PRs, after step 4's k2, k4 and k8. If step 4
moves its seam (its D5), the size goes where the seam goes.

## 2.8 The limits

Classic HUB75 only: tiers 1 and 2 in
[panel-compatibility.md §9](panel-compatibility.md#9-why-hub75e-guarantees-nothing-and-the-three-tiers).
S-PWM panels (ICN2053, FM6353, MBI5051 and the rest) stay dark at any
geometry. They need a grey-scale clock the driver cannot make (upstream issue
642, closed wontfix; `config.h:153-160`), and they are built for a receiving
card, which is an output of the player in `docs/rfc-linux-player.md`.

One chain, in a row. `core_display.h:20` passes a module size and a chain, and
the driver makes the chain one long row
(`ESP32-HUB75-MatrixPanel-I2S-DMA.h:750-751`), two rows in parallel (`.h:67`), so a module is 32 or 64 tall. Stacked modules and
outdoor 1/8 or 1/4 scan modules need the remap in
`ESP32-HUB75-VirtualMatrixPanel_T.hpp`. It is vendored, nothing includes it,
and `blitRGB888` writes the driver's rows without it.

Memory. The driver's row buffers come from internal DMA RAM
(`.h:195`), width × depth × 2 bytes a row (`.h:165-168`), one per row pair per
buffer, and the display is double-buffered (`core_display.h:22`). That is
2 × W × H × depth bytes. With the canvas's 3 × W × H, worked as arithmetic at
depth 8:

| canvas | modules | row buffers | canvas | against 128×64 |
| --- | --- | --- | --- | --- |
| 64×32 | one 64×32 | 32,768 B | 6,144 B | −116,736 B |
| 64×64, 128×32 | one module, or two 64×32 | 65,536 B | 12,288 B | −77,824 B |
| 128×64, 256×32 | one 128×64, two 64×64, four 64×32 | 131,072 B | 24,576 B | 0 |
| 192×64 | three 64×64 | 196,608 B | 36,864 B | +77,824 B |
| 256×64 | two 128×64 | 262,144 B | 49,152 B | +155,648 B |
| 256×64 at depth 6 | two 128×64 | 196,608 B | 49,152 B | +90,112 B |

The budget on record is 98,708 bytes of internal heap free after the network
services, measured on the stock panel on 2026-08-18
([core 2 heap](investigations/2026-08-core2-heap-and-the-5s-stall.md)). Module
code moved to PSRAM after that (`platformio.ini:15-17`), and no later figure is
on record. 192×64 would leave about 20,900 bytes. The core 3 build had 15,320
free, and it was the build whose patterns would not install and whose console
stopped answering under a heavy pattern. 256×64 does not fit at depth 8. So the bound is the stock's own memory: W × H at most 8,192 at depth 8.
Anything larger opens with a heap figure measured on a board.

The blit and the refresh, also as arithmetic. The blit's time follows the pixel
count, 3,496 µs at 128×64 (`hub75/VENDORED.md:164`), so inside the bound it is
no longer than the stock's. Its fast pass needs depth 8 and an even width
(`ESP32-HUB75-MatrixPanel-I2S-DMA.cpp:979`), and every module width is even.
The scan must stay ahead of the blit, and the line between them is buffers per
row × words per row / pixel clock (`VENDORED.md:172`). The scan and the blit
both grow with the row's width, so 109 µs against 96 per row pair at 128 wide
keeps its ratio at 64 or 256. At 12 buffers and 16 MHz the refresh is
16,000,000 / (12 × W × H / 2): 325 Hz at 8,192 pixels, padded to 300 like the
stock's (`PF_TARGET_REFRESH_HZ`).

The menus. They draw portrait in a tile 64 wide (`core_ui_text.h:16, 69-76`),
and the info screens type their rows at y 26, 42 and 52 and at h − 28, h − 23
and h − 13 (`patternflow.ino:924-945`). On a panel 64 wide the portrait screen
is 64 tall, and those rows cross. On a panel 32 tall the tile shrinks to 32. So
every geometry but the two 128×64 ones needs the menus laid out from the screen
size, in one core PR.

## 2.9 The order of the work

| k | what | ground | after |
| --- | --- | --- | --- |
| 1 | the geometry, the driver, the fallback when `begin()` fails | core | the gate |
| 2 | the canvas as an allocation, thumbnails | core | 1 |
| 3 | the tables, the loader's host API, `/api/status` | core | 2 |
| 4 | compiled-in patterns through `setFrame` | core | 2 |
| 5 | the clock's `w` and `h` | feature | 1 |
| 6 | the menus from the screen size | core | 1 |
| 7 | `shared/constants.json`: module sizes and the bound | shared | step 3's k7 |
| 8 | the console page and `/api/panel` | core | 3, 6, 7 |
| 9 | the button at power-on | core | 1 |
| 10 | `build_module.py` and `make_pack.py` take a size | toolchain | — |
| 11 | the sidecar's size: skip and reason | core | 10 |
| 12 | the Patterns page shows a module's size | core | 11 |
| 13, 14 | the cache key, the migration and the worker | site | 10 |
| 15 | downloads take a size | site | 14 |
| 16 | `DeviceSim` takes a size | site | 7 |
| 17, 18 | the virtual panel at a size, its check and vector | site | 16, step 4's k8 |
| 19 | `rest-api.md`, `panel-compatibility.md`, the comments in `config.h` | docs | 8 |

Nineteen PRs, eighteen with the cheaper key. Nine are core and none touches the
frozen ABI. Each core PR runs `firmware/bundles/build.sh all`, and on the
default geometry it shows the stock's frames and cache keys unchanged, as the
cleanup's §2.1(2) asks of a move.

## 2.10 Open questions for the maintainer

1. The bound. The page offers W × H up to 8,192 at depth 8, the stock's own
   memory. Should 192×64 be measured on a board first? Default: the bound, and
   a larger size opens with that measurement.
2. The way back without a network: K4's button held through power-on?
   Default: yes.
3. The cache key: the column §2.7 asks for, with its migration, or the size
   folded into the `builder_rev` the web derives? Default: the column.
4. Basics at another size: built by the worker when asked, or a zip per size
   committed beside `basics.zip`? Default: the worker, and only 128×64 stays
   committed.
5. Origin on another panel: through `setFrame` at 128×64, cropped on a smaller
   panel, or reading the geometry? Default: `setFrame`, and Origin moves to the
   geometry in a preset PR of its own.
6. The menus: laid out from the screen size before the page offers anything
   but 128×64, or offered as they are? Default: the menus first.
7. `env:firmware64x2` (`platformio.ini:121-126`): kept as a build whose default
   is the chain, or retired once the page sets it? Default: kept.
