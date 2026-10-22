# docs/

What is here, and what is not. The rule for the split: **the repository root keeps three guides and no others** (`BUILD_GUIDE.md`, `PATTERN_GUIDE.md`, `FEATURE_GUIDE.md`), so a first-time visitor reads it at a glance; **a contract, a reference, a walk-through for one task (the audio guide is one), or a record lives here**; and a folder explains itself in its own README. The folder-by-folder map of the whole repository is [`REPOSITORY.md`](REPOSITORY.md).

## Contracts — other software is built against these, not against the firmware source

- [`rest-api.md`](rest-api.md) — the device's HTTP API (`/api/*`), the console pages, and the table for choosing between HTTP, OSC, MIDI and MQTT, with test vectors in [`rest-api-vectors/`](rest-api-vectors/)
- [`osc-spec.md`](osc-spec.md) — OSC over UDP (DAWs, Max, TouchDesigner), with test vectors in [`osc-vectors/`](osc-vectors/)
- [`midi-spec.md`](midi-spec.md) — the panel as a network MIDI port, with test vectors in [`midi-vectors/`](midi-vectors/) and those for `/api/midi` in `rest-api-vectors/`
- [`mqtt-spec.md`](mqtt-spec.md) — MQTT topics, both directions, the roles, and why the channel decides whether a write sticks, with test vectors in [`mqtt-vectors/`](mqtt-vectors/) and those for `/api/mqtt` in `rest-api-vectors/`
- [`audio-ws-spec.md`](audio-ws-spec.md) — the audio-react WebSocket the browser extension and the phone app speak, with test vectors in [`audio-ws-vectors/`](audio-ws-vectors/) and those for `/api/audio` in `rest-api-vectors/`
- [`pfst-v2-spec.md`](pfst-v2-spec.md) — the `.pfs` show table, with test vectors in [`pfst-v2-vectors/`](pfst-v2-vectors/)
- [`contract-vectors.md`](contract-vectors.md) — how a vector of the first five is written, and how `npm run check:rest-vectors` and the four like it replay them against the [virtual panel](../tools/virtual-panel/README.md), a Patternflow with no board
- [`panel-compatibility.md`](panel-compatibility.md) — a buying guide first (which HUB75 panels light up and which stay dark), then the reference for other sizes

## How the firmware is put together

- [`EDITIONS.md`](EDITIONS.md) — features, compositions, editions: the seam, the rule that the core names no feature, the vocabulary. **Read before touching firmware.**
- [`rfc-core-and-variants.md`](rfc-core-and-variants.md) and its [progress log](rfc-core-and-variants-progress.md) — the 2026-08 RFC that produced the seam. Historical: it says *addon* and *variant* where the tree says *feature* and *edition*, and its listing rules have been superseded by `EDITIONS.md`.

## Walk-throughs — one task, start to finish

- [`AUDIO_GUIDE.md`](AUDIO_GUIDE.md) — sound into the panel
- [`midi-ableton.md`](midi-ableton.md) — the panel as a MIDI port in Ableton Live, with screenshots
- [`director-midi.md`](director-midi.md) — how a Director show becomes a MIDI clip
- [`../firmware/CUSTOM_PATTERNS.md`](../firmware/CUSTOM_PATTERNS.md) — the hands-on pattern route (the everyday one is [`PATTERN_GUIDE.md`](../PATTERN_GUIDE.md))
- [`../firmware/patternflow/console/README.md`](../firmware/patternflow/console/README.md) — editing or adding a device console page

## Building it

- [`assembly/`](assembly/README.md) — the assembly map: which enclosure with which electronics, and where each route is documented. The full guide is [`../BUILD_GUIDE.md`](../BUILD_GUIDE.md); the files to order are described in [`../hardware/README.md`](../hardware/README.md); enclosures other people built are [`../hardware/case/remixes/`](../hardware/case/remixes/README.md)
- The same build in 3D, step by step, is [patternflow.work/guide/build](https://patternflow.work/guide/build). Its firmware chapter hands over to the Play guide's [Flash chapter](https://patternflow.work/guide/play#flash), which is also where to look when the first flash or the Wi-Fi step goes wrong (the written version is [`BUILD_GUIDE.md` §8](../BUILD_GUIDE.md#8-firmware))
- [`legacy/BUILD_GUIDE_v2.md`](legacy/BUILD_GUIDE_v2.md) — the build guide for the legacy v2.x board
- [`build-guide/images/`](build-guide/images/) — photos for the build guides (`images/` is the v2 set, `images/v3/` the current board)
- [`LICENSE-SUMMARY.md`](LICENSE-SUMMARY.md) — MIT for code, CC BY-SA 4.0 for hardware, docs and bundled patterns, and what that means for a pattern you publish or a remix you share

## On the site, not in this folder

The interactive guide at [patternflow.work/guide](https://patternflow.work/guide) has four parts, each in English and Korean: [Build](https://patternflow.work/guide/build) (soldering one from bare parts), [Play](https://patternflow.work/guide/play) (the first hour with a built one: flash, knobs, patterns, console), [Make](https://patternflow.work/guide/make) (community and Pattern Lab) and [Audio](https://patternflow.work/guide/audio) (the Audio edition: a browser tab, the microphone, MIDI with a DAW). They cover the same ground as the written guides, and every step has a **Stuck here?** link that opens an issue with that step filled in.

## Contributing

- [`../CONTRIBUTING.md`](../CONTRIBUTING.md) — one table: what you have → where it goes → what CI runs on it
- [`../.github/SUPPORT.md`](../.github/SUPPORT.md) — where to ask what
- [`REPOSITORY.md`](REPOSITORY.md) — the folder-by-folder map, and the list of files that outside things link to
- [`voice.md`](voice.md) — how the docs sound in English and in Korean, with the words that stay out in [`voice-banned.txt`](voice-banned.txt)

## Running the project

- [`RELEASING.md`](RELEASING.md) — the `dev` → `main` routine, cutting a release, what the workflows attach
- [`SERVICES.md`](SERVICES.md) — the production hosts (community, build worker) and their systemd units. Korean.

## Drafts — Part 2 only, and nothing in them is built

- [`rfc-any-resolution.md`](rfc-any-resolution.md) — a panel of another size on one ESP32-S3, chosen on a console page and applied at the next boot instead of in a rebuild. Classic HUB75 only, within the driver's DMA memory
- [`rfc-linux-player.md`](rfc-linux-player.md) — the site's pattern engine as a Linux program, onto a HUB75 HAT on a Raspberry Pi, a receiving card or a screen. Not firmware, and not an edition

## Records

- [`investigations/`](investigations/) — dated post-mortems, and the cleanup's plans. `npm run doc-map` in `web/` writes the two lists here: `2026-10-doc-map.csv`, every link in the tree and whether it resolves, and `2026-10-doc-parity.csv`, every Korean/English pair and which side is missing or short
- [`rfc-cleanup.md`](rfc-cleanup.md) and its [progress log](rfc-cleanup-progress.md) — the October 2026 tidy-up before the any-resolution work, done on 16 October. It changed where things live and what CI checks, and nothing the firmware or the site does. §2.9 lists the writing it locked
- [`releases/`](releases/) — every release's changelog section as written, one file each (`vX.Y.Z.md`), back to v1.0.0; `CHANGELOG.md` at the root keeps the three newest in full and links the rest. `v3.0.0-notes.md` and `v3.1.0-notes.md` are long-form notes for two July 2026 releases, beside the v3.0.0 launch checklist; notes since 3.2 are on [GitHub Releases](https://github.com/engmung/Patternflow/releases)
- [`manifesto.md`](manifesto.md) — why Patternflow exists, and (section 6) how we treat each other
- [`images/`](images/), [`media/`](media/) — assets the guides and the site reference
