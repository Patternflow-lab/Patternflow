# RFC: the Linux player

*Patterns on a Linux computer, with no ESP32-S3 in between. Written 2026-10-15.*

> **Status, 15 October 2026.** Draft. Nothing in this RFC changes what the
> firmware or the site does. It sets out a program that does not exist yet,
> the player path of [rfc-cleanup.md](rfc-cleanup.md) §2.7.

This document is two things on purpose. **Part 1 is the maintainer, in his
own words.** **Part 2 is the specification** — precise and mechanical,
written so a contributor (or an AI agent handed this file) can implement
against it without asking what was meant.

---

# Part 1 — Why

---

# Part 2 — The specification

## 2.1 What it is

The player is a Linux process that plays Patternflow patterns with the site's
engine and puts the frames on an LED panel or a screen. A Raspberry Pi with a
HUB75 HAT is the first machine it is written for. It is not firmware and not
an edition: an edition is a firmware build
([EDITIONS.md](EDITIONS.md#the-three-words)), and nothing here compiles for
the ESP32-S3.
The firmware path, any size on one ESP32-S3, is [rfc-any-resolution.md](rfc-any-resolution.md).

Facts are from `dev` at `adbe923`. Where the player leans on work that is only
planned, the plan and its k are named and the paths are in backticks. "Size" is
the canvas, width × height. A path that starts `player/` is inside the player's
own folder, wherever that lives (§2.7). Each section ends with its rows in
§2.8, the table of files, lines and PRs.

## 2.2 The engine

`PatternRuntime` (`web/src/lib/pattern/harness.ts:463`) imports nothing and
touches no DOM. It compiles a pattern with `new Function` (`:443-454`), and
`draw` writes an RGBA buffer of width × height × 4 bytes, sized by the
constructor (`:486`, 128 and 64 by default). It already runs outside a
browser: `check:flatten` renders frames with it under Node 20 in CI
(`web/scripts/lab-flatten-smoke.ts:57-69`).

Around it, `DeviceSim` (`web/src/lib/guide/deviceSim.ts:163`) plays the
firmware's rules for the guide's 3D board: the parameter bus, the lanes and
their holds, sleep, select, and the device's screens. The player is `DeviceSim`
with an output where the guide has a mesh, calling `tick(dt)` (`:412`) and
handing `frame` (`:165`) on. Step 4 builds its virtual panel the same way, so
that a rule `DeviceSim` has is not written again
([the step 4 plan](investigations/2026-10-cleanup-step4-plan.md), D1).

The player starts with the 34 patterns a board lists after the Basics pack,
Origin and the 33 slugs of `web/public/packs/basics.json`'s `order`, each run
from its JS twin (`deviceSim.ts:92-104`). The other 14 JS presets and every
community pattern play as JS too. The community keeps a pattern as plain JS
(`web/src/lib/community/server/schema.ts:95`) with an optional C++ port
(`:102`), and the feed's cards carry the JS (`server/serialize.ts:10`), so the
player plays patterns no board runs until someone ports them.

The size comes from the output (§2.3). At 128×64 nothing in `web/` changes.
At any other size `DeviceSim` is in the way, fixed through `PANEL_W` and
`PANEL_H` (`web/src/lib/guide/panelScreens.ts:42-43`), and so are the typed
sizes the [panel geometry record](investigations/2026-10-panel-geometry.md#the-site)
lists. Step 4 asks for the size in one place (its D1), the firmware path
proposes the change, and the player waits for it. 46 of the 48 JS presets take
the size only from what `draw` is given.

A pattern can declare its frame with `// @matrix`, 8 to 512 on a side
(`web/src/lib/pattern/matrix.ts:46-47`). `DeviceSim` never reads it, so a
community pattern drawn for 64×128 runs there at 128×64. The device fits a
declared frame in `setFrame` (`firmware/patternflow/src/core_canvas.h:137-163`):
equal draws straight through, swapped rotates, anything else is letterboxed.
`matrixFit` (`matrix.ts:131`) names the same cases and nothing calls it.
`DeviceSim` learns the rule before the player plays community patterns. No JS
preset carries `// @matrix`, so the guide shows nothing new (rows 1, 8 and 9).

## 2.3 The outputs

An output is a file in `player/outputs/` with `open(options)`, which returns
its width and height, `write(rgba)` and `close()`. Until `DeviceSim` takes a
size, the player refuses an output that is not 128×64 and says what it got.

### rpi-rgb-led-matrix

[rpi-rgb-led-matrix](https://github.com/hzeller/rpi-rgb-led-matrix) drives
HUB75 panels from a Pi's GPIO header, bare or through a HAT. Its README covers
every Pi up to the Pi 4, and says of the Pi 5 both that support has been added
and that it is not official as of November 2025. A program that uses it starts
as root, and the library drops privileges once the hardware is set up. It
exits while the on-board sound module, `snd_bcm2835`, is loaded, so the
install turns sound off.

The library is GPL-2.0 or later. An addon would link it and bring the GPL into
a tree whose code is MIT (`LICENSE:4`, hard rule 3), and the Node.js bindings
its README lists are addons. The proposal is a second program on a pipe, about
100 lines of C++ kept outside this tree under the GPL (question 2), that reads
raw RGB frames on stdin and shows each one. A 128×64 frame is 24,576 bytes, so
60 frames a second is 1,474,560 bytes a second (arithmetic). The player starts
it with the library's own `--led-rows`, `--led-cols`, `--led-chain` and
`--led-parallel` and takes the size from them. The child starts as root and
drops. The player never runs as root (row 5).

### A receiving card

The S-PWM panels Patternflow cannot light (ICN2053, FM6353, MBI5051 and the
rest, `firmware/patternflow/config.h:153-160`) are sold for a receiving card,
and [panel-compatibility.md](panel-compatibility.md) tells a buyer to walk away
from them. A receiving card turns that around: it scans the panel the way an
S-PWM panel expects and takes its pixels over Ethernet. This is the output for
those panels, and for signs larger than one ESP32-S3 drives.

The reference card is the Colorlight 5A-75B (question 6). Colorlight does not
publish its protocol. People have worked it out from packet captures, and
[haraldkubota/colorlight](https://github.com/haraldkubota/colorlight) (MIT)
sends a 5A-75B plain Ethernet frames, no IP, out of a named interface. Linux
sends such a frame from an `AF_PACKET` socket, which needs `CAP_NET_RAW`.
Node's `dgram` and `net` stop at UDP and TCP, so the output needs an addon or
a helper program given the capability with `setcap`. A protocol learned from
captures can change with a card's firmware (row 11).

### HDMI

The screen output writes the Linux framebuffer, `/dev/fb0`, with plain file
writes on a console with no desktop running. Its size and depth are in
`/sys/class/graphics/fb0/virtual_size` and `bits_per_pixel`. The output
reports the size it is given, 128×64 by default, and scales it by a whole
number, nearest pixel, centred: 128×64 on 1920×1080 is ×15, 1920×960 with 60
rows of black above and below. A browser in kiosk mode would be the site, and
a page cannot open the UDP ports §2.4 needs (row 2).

## 2.4 The inputs

Every input ends in a call the guide already makes, so a knob on the player
behaves as it does on a board: a hand is `turn` (`deviceSim.ts:359`), a button
`press` and `release` (`:372`, `:381`), a remote value `applyRemoteParam`
(`:501`).

USB encoders. The player reads a USB knob box's `/dev/input/by-id/*-event-*`
node as a file: 24-byte events on 64-bit Raspberry Pi OS, a rotation as a
relative step (`EV_REL`) or, on some single knobs, a key per step.
`player/knobs.json` maps a device's axis or key to K1 to K4 and their buttons,
with steps per detent. A board's `PEC11R-4220F-S0024` has 24 detents a turn,
`DETENTS_PER_TURN` in `shared/constants.json`. The player reads the generated
`web/src/lib/shared/constants.ts`, which the site does not import yet
(`harness.ts:11` still types 24). `DeviceSim` takes a direction and an edge
count per knob (`setKnobSettings`, `:522`), as `/api/knobs` does on a board.

MIDI. A USB controller appears as an ALSA raw device,
`/dev/snd/midiC<card>D<device>`, and reads as a byte stream with no addon.
RTP-MIDI is the player listening on UDP 5004 and 5005 as the panel does
([midi-spec.md](midi-spec.md) line 28), not `rtpmidid`, which hands a session
to the ALSA sequencer, and the sequencer needs an addon. Both go through the
panel's map (`midi-spec.md:35-45`): CC 20 to 23 absolute, CC 24 to 27
relative, notes 60 to 63 the buttons, Program Change the pattern. Step 4's k15
writes the receive side (`tools/virtual-panel/transports/midi.ts`).

OSC. UDP 9001 in, replies to 9000 ([osc-spec.md](osc-spec.md) lines 13-14):
`/patternflow/ping`, `/patternflow/knob/N/delta` and
`/patternflow/pattern/index` (lines 41-48). Step 4's k13 writes it
(`tools/virtual-panel/transports/osc.ts`).

The web knobs. The console's four sliders, 0 to 100
(`firmware/patternflow/console/home.html:112-115`), post `pN` as a form body
to `POST /api/params`, one request in flight at a time (`:383-390`,
[rest-api.md](rest-api.md) line 160). The player answers that route and
serves one page with the same four sliders. It does not serve `home.html`
whole: most of what that page reads, Wi-Fi and storage among it, has nothing
behind it on a player (rows 3, 4, 6 and 7).

## 2.5 The contracts

The panel speaks five: [rest-api.md](rest-api.md), [osc-spec.md](osc-spec.md),
[midi-spec.md](midi-spec.md), [mqtt-spec.md](mqtt-spec.md) and
[audio-ws-spec.md](audio-ws-spec.md). The player speaks them in this order.

1. REST first, as for the virtual panel (rfc-cleanup.md §2.13, answer 3). It
   carries the web knobs, and a client finds a player with `GET /api/status`
   the way it finds a panel.
2. OSC, then MIDI, the inputs rfc-cleanup.md §2.7 names. The virtual panel
   puts MQTT here (question 3).
3. MQTT, as a broker's client with the panel's topics and roles
   (`mqtt-spec.md:16`), so a player can follow a show channel beside panels.
4. The audio WebSocket on 81, for lanes from the browser extension and the
   phone app in `tools/`.

REST is five routes: `GET /api/status` (`rest-api.md:42`), `POST /api/params`
(`:160`), `POST /api/sleep` (`:189`), `GET /api/patterns` (`:232`) and
`GET /api/patterns/select` (`:251`). Status keeps what a client reads to play
(`active`, `patterns`, `sleep`, `knobs`, `params`, `paramActive`, `lanes`,
`laneActive`, and `panel` as the output's size) and leaves out the fields that
describe an ESP32, such as heap and flash. The spec asks a client to tolerate
fields it does not know (`:5`), not fields that are missing (question 8). HTTP
on 80 and the audio socket on 81 sit below 1024, which Linux keeps from an
unprivileged process (step 4's finding 3). The systemd unit grants
`CAP_NET_BIND_SERVICE` through `AmbientCapabilities=`, and a port flag moves
either one, as in the virtual panel's D3.

Step 4 plans `tools/virtual-panel/`: `DeviceSim` behind sockets, one transport
per file in `tools/virtual-panel/transports/`, each handed the `DeviceSim`, a
clock, the HTTP routes and its ports (its D5). The player imports those
transports and writes none of its own. It does not take `/vp/` (D6) or the
manual clock and `advance(ms)` (D4): it runs on the wall clock, and the virtual
panel is a test fixture (rfc-cleanup.md §2.6). If step 4 moves the transports
or changes their seam, the player follows. If step 4 does not land, the player
writes each transport itself, and §2.8 grows by one PR for each of step 4's k4,
k5, k9, k10, k13, k15 and k19 (rows 3, 6, 7 and 10).

## 2.6 What it cannot do

- Load a `.pfm`. A module is ESP32-S3 machine code for the device's relocator
  (`firmware/patternflow/src/core_module_loader.h`). One with no JS twin, like
  a module in a pack built outside the repo, does not play (`deviceSim.ts:97`).
- Be flashed from the browser. The Flash Patternflow button installs an
  ESP32-S3 image (`web/public/flash/manifest.json`).
- Run a C++ feature. Weather, the clock, shows and the microphone live in
  `firmware/patternflow/features/`. The audio socket carries lanes a phone or
  a browser worked out, which is not the microphone.
- Do the board's own jobs: Wi-Fi setup, OTA, the crash record,
  `/api/display`'s white balance and gamma, the calibration pattern.

## 2.7 Where it lives and how it ships

Two builds on the site already run Patternflow on a Raspberry Pi: day's, with
a 64×32 matrix (`web/src/components/sections/InsideGlobe/builds.ts:130`), and
Philipppp's Pi 4 with a HUB75 HAT and firmware of its own (`:333`). The player
starts from neither, but the hardware is already in people's hands.

Two homes are open (question 1). In this repository it is
`tools/linux-player/`, MIT like the rest of `tools/` (`LICENSE:4`). It imports
`web/src/lib/` by path as step 4's virtual panel does, with a `tsconfig.json`
that extends the site's (step 4's k2), so a change to `DeviceSim` that breaks
the player fails `typecheck` in the same PR. In a repository of its own, as the
Home Assistant integration has been since 2026-09-03, it cannot import
`web/src/lib/` or step 4's transports by path. It needs the engine as a package
or copies of `harness.ts`, `deviceSim.ts` and their imports, and copies drift:
the 24-vs-20 detent incident is why step 3 has a shared constants file at all
(rfc-cleanup.md §2.5). The C++ program for the matrix lives outside this tree
either way.

It ships as source with a `package.json` of its own, so a Pi never installs the
site's dependencies: `npm ci` on Raspberry Pi OS, Node 20 as CI runs
(`.github/workflows/web-ci.yml:36`), and a systemd unit that starts it at boot.
There is no disk image (row 12). Its own home adds two PRs, the package or the
copies and the check that keeps them in step.

## 2.8 The order of the work

| # | what | files | lines | PRs | where |
| --- | --- | --- | --- | --- | --- |
| 1 | the loop, `DeviceSim`, a `null` output for CI | `player/main.ts`, `player/engine.ts`, `player/outputs/null.ts` | 200 | 1 | player |
| 2 | HDMI | `player/outputs/fb.ts` | 100 | 1 | player |
| 3 | REST and the slider page | `player/rest.ts`, `player/knobs.html` | 180 | 1 | player |
| 4 | USB encoders | `player/inputs/evdev.ts`, `player/knobs.json` | 150 | 1 | player |
| 5 | the matrix | `player/outputs/matrix.ts`; the C++ program in its own home | 120 | 1 | player |
| 6 | OSC | `player/transports.ts` | 60 | 1 | player |
| 7 | MIDI | `player/inputs/rawmidi.ts`, `player/transports.ts` | 140 | 1 | player |
| 8 | `// @matrix` in `DeviceSim` | `web/src/lib/guide/deviceSim.ts`, `deviceSim.test.ts` | 80 | 1 | site |
| 9 | community patterns | `player/community.ts` | 120 | 1 | player |
| 10 | MQTT, then the audio socket | `player/transports.ts` | 60 each | 2 | player |
| 11 | the receiving card | `player/outputs/card.ts`, the raw-socket helper | 250 | 2 | player |
| 12 | the systemd unit and the install page | `player/patternflow-player.service`, `player/README.md` | 120 | 1 | player |

Fourteen PRs, each under rfc-cleanup.md §2.1's 300 lines with one concern. The
`null` output fails on a thrown error, so CI runs the player with no panel. No
row touches the core, the frozen ABI or a feature, so hard rule 7 does not come
into it. After row 4 a Pi with a screen and a USB knob box plays the Basics,
and row 5 puts it on a HAT. Rows 3, 6, 7 and 10 wait for step 4's k2 and the
transport each imports (k4 and k5, k13, k15, then k9, k10 and k19). Row 11
waits for someone with a card. Any size but 128×64 waits for the site to take
its size from one place, which the firmware path counts instead.

## 2.9 Open questions for the maintainer

Each has the default this draft uses until there is an answer.

1. Where does the player live: here as `tools/linux-player/`, or in a
   repository of its own, like the Home Assistant integration (§2.7)?
   Default: the draft sets out both and picks neither.
2. Where does the C++ program for rpi-rgb-led-matrix live, and who keeps it?
   It is GPL, and this tree's code is MIT. Default: a repository of its own.
3. Is REST, OSC, MIDI, MQTT, audio the right order, when the virtual panel's
   is REST, MQTT, OSC, MIDI, audio (§2.5)? Default: yes.
4. Does the player ship at 128×64 only, until the site takes its size from one
   place (§2.2)? Default: yes.
5. Where do community patterns come from: the feed on patternflow.work, which
   needs the network and a running community, or a deck exported to a file?
   Default: the file first, the feed after.
6. Which receiving card is the reference, and who has one on the bench?
   Default: the Colorlight 5A-75B, and row 11 waits for someone who has one.
7. Encoders on the Pi's own header, beside a HAT? Philipppp's Pi 4 has four
   knobs by its HAT, wired in a way the site does not say. Default: USB only.
8. What does `/api/status` say on a player, whose ESP32 fields have nothing
   behind them? Default: those fields are left out, and none is added.
9. Does the player move to proposed with the firmware path at the cleanup's
   gate (rfc-cleanup.md §2.12)? Default: no. It stays a draft until you say.
