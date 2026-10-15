# Where the panel size lives

*PR 1 of [the step 5 plan](2026-10-cleanup-step5-plan.md), for
[rfc-cleanup.md](../rfc-cleanup.md) §2.7. Counted on 15 October 2026 at
`e3d3e83` on `dev`. A record of the tree. It proposes nothing.*

The stock panel is 128×64, and the tree says so in more places than one macro.
Every count here comes from a command run at the repository root at `e3d3e83`,
and the command is quoted with its number or its table. A different number on a
later tree means the tree moved there.

## The macro

`PANEL_RES_W` and `PANEL_RES_H` are set in `config.h`. §2.7's 25, four and
seven count occurrences, not lines, so `core_display.h:18`, which names both,
counts twice. Each row below is one `<path>` in these three commands:

```sh
git grep -o -E 'PANEL_RES_(W|H)' -- <path> | wc -l   # occurrences
git grep -n -E 'PANEL_RES_(W|H)' -- <path> | wc -l   # lines
git grep -l -E 'PANEL_RES_(W|H)' -- <path> | wc -l   # files
```

| path | occurrences | lines | files | in comments |
| --- | --- | --- | --- | --- |
| `firmware/patternflow/src` | 25 | 21 | 6 | 8 |
| `firmware/patternflow/features` | 4 | 4 | 2 | 0 |
| `firmware/patternflow/abi` | 7 | 7 | 2 | 2 |
| `firmware/patternflow/config.h` | 11 | 11 | 1 | 1 |
| `firmware/patternflow/presets` | 142 | 128 | 35 | 6 |

`git grep -o -E 'PANEL_RES_(W|H)' -- . ':!docs' | wc -l` gives 245, so 56 sit
outside those five rows. `firmware/patternflow/README.md` has 5 and
`_TEMPLATE.h` 3. The four probe modules under `firmware/toolchain/tests/modules/`
have 16 between them. The site has 32. Of those, 28 are in C++ the site writes
or asks a model to write: `web/src/lib/lab/cppPrompt.ts` 14,
`web/src/components/guide/desk/ai/headers.ts` 12 and
`web/scripts/module-build-smoke.ts` 2. The other four are comments and prompt
text in `patternWaveSaw.ts` (2), `hExport.ts` and `matrix.ts`.

### `src/`, 25

| file and line | uses | what the line does with the size |
| --- | --- | --- |
| `core_canvas.h:38-39` | 2 | `PFCanvas::W` and `H`, the canvas every preset draws into |
| `core_display.h:18` | 2, comment | warns never to give the driver the canvas size |
| `core_mem.h:17` | 2, comment | an example per-pixel buffer |
| `core_module_loader.h:601-602` | 2 | `panel_w` and `panel_h` in the host API each module receives |
| `core_module_loader.h:1145` | 2 | refuses a module stamped with another size |
| `core_status_http.h:282, 284` | 2 | `"panel": "128x64"` in `/api/status` |
| `core_tables.h:11, 24-26` | 4, comment | how `rT` is scaled, and an example loop |
| `core_tables.h:52, 57` | 3 | `PFTables::idx`, and the length of the two tables |
| `core_tables.h:70-76` | 6 | the table fill: centre, scale and both loops |

### `features/`, 4

| file and line | uses | what the line does with the size |
| --- | --- | --- |
| `clock/core_clock_http.h:116, 118` | 2 | `w` and `h` in `/api/clock`, for the console page's preview |
| `weather/preset_weather.h:492-493` | 2 | the compact layout's frame (the extended one is typed, below) |

### `abi/`, 7

| file and line | uses | what the line does with the size |
| --- | --- | --- |
| `pf_abi.h:116` | 1, comment | why the loader refuses a mismatch |
| `pf_module.h:47` | 1, comment | the same, from the module's side |
| `pf_module.h:71-72` | 2 | defines both macros from `-DPF_PANEL_W` and `-DPF_PANEL_H` |
| `pf_module.h:175-176` | 2 | the module's own `PFCanvas::W` and `H` |
| `pf_module.h:281` | 1 | the module's `PFTables::idx` |

The ABI carries the size as `panel_w` and `panel_h` in both structs:
`PFHostAPI` at `pf_abi.h:82-83` and `PFPatternModule` at `pf_abi.h:117-118`.
`pf_module.h:61-66` stops a module build that lacks either flag, `:306` stamps
the descriptor and `:312` has the module refuse a host of another size. The ABI
is at version 1, frozen and append only.

## Where it is set

`config.h:81-108` offers three geometries, and `PANEL_GEOMETRY` picks one.

| geometry | module | chain | canvas | how it is built |
| --- | --- | --- | --- | --- |
| `PANEL_GEOM_128x64_SINGLE` | 128×64 | 1 | 128×64 | the default (`config.h:87`), `env:firmware` |
| `PANEL_GEOM_64x64_SINGLE` | 64×64 | 1 | 64×64 | an edit to `config.h` |
| `PANEL_GEOM_64x64_CHAIN2` | 64×64 | 2 | 128×64 | `env:firmware64x2` (`platformio.ini:121-126`) |

No workflow and no bundle builds the last two. Each branch sets `PANEL_PHYS_W`,
`PANEL_PHYS_H`, `PANEL_CHAIN` and the two canvas macros, and two `#error`s
(`config.h:110-115`) hold the canvas to module width × chain by module height.
`core_display.h:20` is the one line that hands the driver a geometry, and the
only code outside `config.h` that reads `PANEL_PHYS_*` or `PANEL_CHAIN`. The
driver IC is a separate line, `PANEL_PROFILE` (`config.h:168`), and it does not
touch the size.

## The canvas and what reads it

`core_canvas.h:38-42` gives `PFCanvas::W`, `H` and a global RGB888 array of
W × H × 3 bytes, 24,576 at 128×64, sized when the firmware links. `setFrame`
(`core_canvas.h:137-163`) compares a pattern's grid with W and H: equal draws
straight through, swapped rotates, anything else is centred and letterboxed.
`present()` passes W and H to the compose hook (`:227`) and the buffer to the
driver's `blitRGB888`.

Outside the file, `core_thumbs.h:44-45` aliases W and H as `PFThumbs::W` and
`H`. A thumbnail is W × H in RGB565 behind an 8-byte header, 16,392 bytes at
128×64, kept in PSRAM (`core_thumbs.h:139`). `core_module_loader.h:603` hands
the buffer to modules. `PFTables::init` (`core_tables.h:57-59`) allocates two
float tables of W × H through `PFMem`, 32,768 bytes each at 128×64.

## The menus

The menus never read the macro. They ask the driver, and the driver answers for
the rotation the menu set, so a portrait screen gets 64 × 128.
`git grep -n -E 'dma_display->(width|height)\(\)' -- firmware/patternflow | wc -l`
gives 31: 20 in `patternflow.ino`, 6 in `src/core_ui_text.h` and 5 in
features (`show/core_show_schedule.h` 2, `show/core_show_select.h` 2,
`weather/feature_weather.h` 1).

## Sizes typed by hand

| file and line | what is typed |
| --- | --- |
| `firmware/patternflow/src/core_ui_text.h:16` | `UI_PORTRAIT_TILE = 64`, the square portrait menus lay out in |
| `firmware/patternflow/features/weather/preset_weather.h:491` | `EXT_W = 64, EXT_H = 128`, the extended layout's frame |
| `firmware/patternflow/presets/preset_0712_2.h:60-61` | `VW = 64`, `VH = 128`, its portrait grid |
| `firmware/patternflow/console/clock.html:414` | 128 and 64 for the preview until `/api/clock` answers |
| `firmware/patternflow/console/weather.html:62` | "Compact (128×64)", a menu label |
| `firmware/toolchain/build_module.py:51-52` | `PANEL_W = 128`, `PANEL_H = 64` for every module build |
| `firmware/toolchain/make_pack.py:199` | `"panel": {"w": 128, "h": 64}` in a pack's manifest |
| `firmware/toolchain/console_serve.py:332, 1614` | the console preview server's `/api/status` and `/api/clock` |
| `firmware/toolchain/console_demo.py:516` | the demo console's status |
| `firmware/toolchain/tests/thumbs_test.cpp:36` | the host test's `PFCanvas::W = 128, H = 64` |

## The presets

`preset_0629_2.h` sizes four arrays by the macro, two globals at lines 53-54 and
two on the stack at 101 and 106. `preset_0713.h` sizes two on the stack through
its local `H` (186-187). `preset_calib.h:119` allocates `4 × W × 3` bytes and
`preset_0719.h:100` W × H floats. `preset_0712.h`, `preset_0712_2.h` and
`preset_0713.h` turn a portrait grid onto the panel by hand (`v = W - 1 - x`)
instead of calling `setFrame`, so they take the panel to be wider than it is
tall.

| file | uses | lines | | file | uses | lines |
| --- | --- | --- | --- | --- | --- | --- |
| `preset_0510.h` | 2 | 2 | | `preset_0628.h` | 2 | 2 |
| `preset_0511.h` | 2 | 2 | | `preset_0629.h` | 2 | 2 |
| `preset_0512.h` | 4 | 4 | | `preset_0629_2.h` | 12 | 12 |
| `preset_0513.h` | 2 | 1 | | `preset_0701.h` | 9 | 8 |
| `preset_0514.h` | 2 | 2 | | `preset_0707.h` | 2 | 2 |
| `preset_0515.h` | 2 | 2 | | `preset_0710.h` | 10 | 8 |
| `preset_0515_3.h` | 2 | 2 | | `preset_0712.h` | 2 | 2 |
| `preset_0515_4.h` | 2 | 2 | | `preset_0712_2.h` | 2 | 2 |
| `preset_0518.h` | 2 | 1 | | `preset_0713.h` | 2 | 2 |
| `preset_0519_1.h` | 2 | 2 | | `preset_0715.h` | 4 | 4 |
| `preset_0520.h` | 2 | 2 | | `preset_0716.h` | 2 | 2 |
| `preset_0521.h` | 2 | 2 | | `preset_0718.h` | 4 | 4 |
| `preset_0522.h` | 2 | 2 | | `preset_0719.h` | 16 | 12 |
| `preset_0527.h` | 2 | 2 | | `preset_a_big_hit.h` | 2 | 2 |
| `preset_0528.h` | 2 | 2 | | `preset_calib.h` | 21 | 20 |
| `preset_0531.h` | 2 | 2 | | `preset_origin.h` | 4 | 4 |
| `preset_0601.h` | 2 | 2 | | `preset_wave_saw.h` | 8 | 5 |
| `preset_0602.h` | 2 | 1 | | | | |

25 of the 35 use it exactly twice, as `w` and `h` or as the two pixel loops.
The six in comments are in `preset_0710.h` (84, 88) and `preset_wave_saw.h` (77).

## Modules and the cache key

A `.pfm` is built for one size. `build_module.py:258-259` passes its typed 128
and 64 as `-DPF_PANEL_W` and `-DPF_PANEL_H`, and `:323-324` writes the same two
into the sidecar as `panel_w` and `panel_h`. The device never reads the
sidecar's pair. It checks the descriptor (`core_module_loader.h:1145`).

The community's compiled-module cache is keyed `(source_sha, builder_rev)`
(`web/src/lib/community/server/schema.ts:725`). `builder_rev` is a digest of the
toolchain (`web/src/lib/firmware/builderRev.ts`), and `build_module.py` is one
of its inputs (`:45`). The size reaches the key only because it is typed in that
file.

## HTTP and the specs

Of the five wire contracts, only `docs/rest-api.md` states a size: `"panel":
"128x64"` in status (line 48, described at 77), the thumbnail as a 128×64 frame
of 16,392 bytes (274), the sidecar's `panel_w` and `panel_h` (284), and
`/api/clock`'s `w` and `h` (499). `osc-spec.md`, `mqtt-spec.md` and
`audio-ws-spec.md` have no 128 and no 64. `midi-spec.md` has 128 twice, both
queue lengths (96, 130).

## The driver's memory

The driver is vendored in `firmware/patternflow/src/hub75/`, and `.h` and `.cpp`
below are its `ESP32-HUB75-MatrixPanel-I2S-DMA` pair. It allocates its row
buffers once, in `begin()` (`.cpp:111-133`), one per row pair per buffer. A row
is module width × chain pixels, and there are module height / 2 of them
(`.h:750-751`, with `MATRIX_ROWS_IN_PARALLEL` 2 at `.h:67`). Each takes width ×
colour depth × 2 bytes (`.h:165-168`, words of `uint16_t` at `.h:87`), from
`MALLOC_CAP_INTERNAL | MALLOC_CAP_DMA` (`.h:195`). The PSRAM branch at `.h:186`
needs `SPIRAM_DMA_BUFFER`, and nothing in the tree defines it. The depth is the
default 8 (`.h:80`, at most 12 at `.h:83`), and nothing sets another.
`core_display.h:22` turns on double buffering. When a row does not fit,
`begin()` logs "Not enough memory" (`.cpp:123`) and returns false.

The tree states no total, though `begin()` logs one at boot (`.cpp:134`).
Worked from that formula, as arithmetic, with two buffers at depth 8 and the DMA
descriptors (`.cpp:236`) left out:

| geometry | row | rows | both buffers |
| --- | --- | --- | --- |
| 128×64, one module | 128 × 8 × 2 = 2,048 B | 32 | 131,072 B |
| 64×64, one module | 64 × 8 × 2 = 1,024 B | 32 | 65,536 B |
| 64×64, chain of 2 | 128 × 8 × 2 = 2,048 B | 32 | 131,072 B |

The vendored blit adds limits of its own. Its fast passes need depth 8 and an
even width (`.cpp:979`), and an odd width or any other depth goes through the
older loop. Above depth 10 it refuses to write the frame (`.cpp:538`, `:958`).
The host test runs it at nine widths from 2 to 256, 127 among them
(`firmware/toolchain/tests/blit_test.cpp:73`). `src/hub75/VENDORED.md:147-188`
works out why the blit never tears for 12 buffers of 128 words at 16 MHz: 96 µs
a row pair against the blit's 109. The line it draws is buffers per row × words
per row / pixel clock (`VENDORED.md:172`), so a wider row moves it.

## The site

`web/src/lib/pattern/harness.ts:1-2` sets `PATTERN_MATRIX_WIDTH = 128` and
`PATTERN_MATRIX_HEIGHT = 64`, and both `PatternRuntime` (`:486`) and
`renderPatternStill` (`:652-653`) default to them. `matrix.ts:30` keeps its own
`DEFAULT_MATRIX` of 128×64. `// @matrix` takes 8 to 512 on a side
(`matrix.ts:46-47`), and `matrix.ts:127` says its fit must match `core_canvas.h`.

`git grep -n -E 'new PatternRuntime\(' -- web/src | wc -l` gives 7. Four take
the pattern's frame (`sandbox/sandbox.ts:51`, `lib/lab/engine.ts:109`,
`GalleryPanel.tsx:106`, `desk/community/live.ts:46`), and `harness.ts:665` its
caller's. Two are fixed: `lib/guide/deviceSim.ts:167` through
`panelScreens.ts:42-43`, and `components/guide/Extras.tsx:185`, typed. The
sandbox canvas starts at 128×64 (`pattern-sandbox.template.html:18`) and resizes
to each frame (`sandbox.ts:104-107`).

| what | where the size comes from |
| --- | --- |
| `DeviceSim` and the guide's stage | `PANEL_W`, `PANEL_H` in `lib/guide/panelScreens.ts:42-43`, read by `deviceSim.ts` and five stage files (`Device.tsx`, `Fx.tsx`, `look/ledPanel.ts`, `look/panelGlow.ts`, `world/hubMake.ts`) |
| the 3D panel's texture | typed, `components/3d/LedMatrixTexture.ts:20-21, 29` |
| the 3D shaders | `vec2(128.0, 64.0)`, typed 5 times (`git grep -n -F 'vec2(128.0, 64.0)' -- web/src`): `patterns/common.ts:55`, `HeroScene.tsx:63, 66`, `patternFlowOriginal.ts:23`, `patternWaveSaw.ts:45` |
| the guide's preview | typed, `Extras.tsx:185` and the `ImageData` at `:248` |
| the AI prompts | typed defaults, `lib/ai/gemini.ts:226, 387` |
| Pattern Lab's C++ export | `PATTERN_MATRIX_*`, `lib/lab/cppPrompt.ts:68` and `hExport.ts:165` |
| a pack's manifest | the `panel` field typed in `make_pack.py`, read as `lib/pattern/packs.ts:54` |

`git grep -l -E '\b(display|d)\.(width|height)\b' -- 'web/src/lib/presets/pattern-*.ts' | wc -l`
gives 48, every JS preset, so each reads the size from the display
(`pattern-0716.ts` through `d`). `pattern-0719.ts` also types 128×64 for its
density map (33, 70, 132-134, 146) and its centre (40, 75). `pattern-0712-2.ts`
types its portrait grid as 64×128 (43, 53). No JS preset carries `// @matrix`.
