# Cleanup step 4: the plan

*For [rfc-cleanup.md](../rfc-cleanup.md) §2.6. Scouted on 14 October 2026 at
`e3b977f` on `dev`, after the step 3 plan and `docs/voice.md` merged and before
step 1 closed. Nothing here is implemented.*

§2.6 gives step 4 two jobs. Five contracts each get a folder of vectors and a
script that replays them, and a virtual panel speaks all five so the scripts
have a device to replay against. Answer 3 of §2.13 puts REST first. Two things
in the tree change how the RFC reads: the harness it names
(`web/src/lib/harness/`) is not a folder, and the status field a vector would
read for most knob inputs does not move for them (findings 2 and 4). This plan
cuts the step into 24 PRs.

## The PRs

| k | what | files it may edit | merges after | §2.13 |
| --- | --- | --- | --- | --- |
| 1 | `DeviceSim` gives a socket what it reads and writes | `web/src/lib/guide/deviceSim.ts`, `web/src/lib/guide/deviceSim.test.ts` | — | — |
| 2 | the virtual panel: process, clock, frame, fixture routes, the seam; every npm name | `tools/virtual-panel/README.md`, `tools/virtual-panel/tsconfig.json`, `tools/virtual-panel/main.ts`, `tools/virtual-panel/panel.ts`, `tools/virtual-panel/http.ts`, `tools/virtual-panel/png.ts`, `web/package.json` | — | — |
| 3 | the vector format and the replay library | `docs/contract-vectors.md`, `web/scripts/drift/_vectors.ts` | 2 | — |
| 4 | REST: device state | `tools/virtual-panel/transports/rest-state.ts` | 1, 2 | 3 |
| 5 | REST: patterns | `tools/virtual-panel/transports/rest-patterns.ts` | 2 | 3 |
| 6 | REST vectors: status, params, sleep; `check:rest-vectors` | `docs/rest-api-vectors/README.md`, `docs/rest-api-vectors/state-*.json`, `web/scripts/drift/rest-vectors.ts` | 3, 4 | 3 |
| 7 | REST vectors: the rest of the core, and what a build without a feature does not serve | `docs/rest-api-vectors/device-*.json`, `docs/rest-api-vectors/patterns-*.json`, `docs/rest-api-vectors/absent-*.json` | 5, 6 | 3 |
| 8 | `check:virtual-panel`: every preset runs | `web/scripts/drift/virtual-panel.ts` | 5 | — |
| 9 | MQTT: the client, topics, roles, channels | `tools/virtual-panel/transports/mqtt.ts` | 1, 2 | — |
| 10 | MQTT: `/api/mqtt` and its status fields | `tools/virtual-panel/transports/mqtt-http.ts` | 9 | — |
| 11 | MQTT vectors: topics and roles; the test broker; `check:mqtt-vectors` | `docs/mqtt-vectors/README.md`, `docs/mqtt-vectors/topics-*.json`, `web/scripts/drift/_broker.ts`, `web/scripts/drift/mqtt-vectors.ts` | 3, 4, 10 | — |
| 12 | MQTT vectors: channels, the snapshot, `/api/mqtt` | `docs/mqtt-vectors/channels-*.json`, `docs/rest-api-vectors/mqtt-*.json` | 6, 11 | — |
| 13 | OSC | `tools/virtual-panel/transports/osc.ts` | 1, 2 | — |
| 14 | OSC vectors; `check:osc-vectors` | `docs/osc-vectors/`, `web/scripts/drift/_osc.ts`, `web/scripts/drift/osc-vectors.ts` | 3, 4, 13 | — |
| 15 | MIDI: the RTP-MIDI session and what comes in | `tools/virtual-panel/transports/midi.ts` | 1, 2 | — |
| 16 | MIDI: what goes out, `/api/midi` | `tools/virtual-panel/transports/midi-out.ts` | 15 | — |
| 17 | MIDI vectors in; the test initiator; `check:midi-vectors` | `docs/midi-vectors/README.md`, `docs/midi-vectors/in-*.json`, `web/scripts/drift/_rtpmidi.ts`, `web/scripts/drift/midi-vectors.ts` | 3, 4, 15 | — |
| 18 | MIDI vectors out, `/api/midi` | `docs/midi-vectors/out-*.json`, `docs/rest-api-vectors/midi-*.json` | 6, 16, 17 | — |
| 19 | the audio WebSocket and `/api/audio` | `tools/virtual-panel/transports/audio-ws.ts` | 1, 2 | — |
| 20 | audio vectors; `check:audio-vectors` | `docs/audio-ws-vectors/`, `docs/rest-api-vectors/audio-*.json`, `web/scripts/drift/_ws.ts`, `web/scripts/drift/audio-vectors.ts` | 3, 4, 6, 19 | — |
| 21 | `AGENTS.md`: the virtual panel, the vector folders, the commands | `AGENTS.md` | 1 to 20 | — |
| 22 | the docs that map the tree | `docs/README.md`, `docs/REPOSITORY.md`, `CONTRIBUTING.md`, `tools/README.md`, `tools/virtual-panel/README.md`, `web/ARCHITECTURE.md`, `web/README.md` | 1 to 20 | — |
| 23 | spec lines the vectors could not follow, once ruled on | `docs/rest-api.md`, `docs/midi-spec.md`, and each vector that quotes a line it changes | 6, 7, 11, 12, 14, 17, 18, 20 | — |
| 24 | close step 4 | `docs/rfc-cleanup-progress.md`, `docs/investigations/2026-10-doc-map.csv`, `docs/investigations/2026-10-doc-parity.csv` | every other k | — |

Step 4 opens when step 3 is closed (§2.12). Step 2's runner (its k1) runs every
file in `web/scripts/drift/` from `check:ci`, and its workflow (k10) runs them
strict on every pull request, so a suite reaches CI by adding a file and no PR
edits `check:ci` or `.github/`. k2 adds every npm name the step needs to
`web/package.json`. Prose follows [voice.md](../voice.md) and goes through step
2's voice lint (its k9, `web/scripts/voice-lint.ts`); no PR edits text step 2's
lock (its k8, `web/scripts/human-lock.ts`) covers. Neither script is in the
tree today, and this plan does not write them again.

A file sits in one row, with two exceptions that run in order.
`tools/virtual-panel/README.md` belongs to k2, then to k22. A vector that
quotes a line k23 corrects is edited by k23, which opens after every vector PR.
Rows that can be open at the same time share no file. Start with k1 and k2,
which wait on nothing; after k2, k3 and k5; after both, k4, k9, k13, k15 and
k19, inside §2.11's limit of five. A contract's vectors can be drafted beside
its transport and merge after it. Only k24 commits the doc-map CSVs: every
other PR runs `npm run doc-map` after `git fetch --tags`, quotes its two
summary lines and checks both CSVs out again. `AGENTS.md` gets a PR of its own
(k21). No PR edits `CHANGELOG.md`; each one's line rides in its description.

## What the tree says

1. The model. `docs/pfst-v2-vectors/` holds three real `.pfs` files. What they
   should give is printed in `pfst-v2-spec.md` §5, and `check:pfstvectors`
   runs an executable model of the spec's player rule over them, not the
   firmware. Nothing replays the other five contracts.
2. The harness. `web/src/lib/harness/` does not exist. Patterns run in
   `PatternRuntime` (`web/src/lib/pattern/harness.ts`), plain TypeScript with
   no DOM. Beside it, `DeviceSim` (`web/src/lib/guide/deviceSim.ts`) already
   plays the firmware rules the contracts lean on, for the guide's 3D board:
   the bus (ten units a click, a 250 ms grace), the lanes (500 ms release, a
   five-second hand hold), sleep, select, the Basics order. It keeps bus and
   lane values private, and its one way to move a knob is `turn`, a hand.
   `console_demo.py` (the guide's `pf-demo.js`) and `console_serve.py` also
   answer HTTP; neither speaks UDP, and the second disagrees with the spec.
3. Ports and packages. HTTP on 80, the audio WebSocket on 81, OSC in on 9001
   with every reply sent to 9000 (`osc_config.h:38,41`), RTP-MIDI on 5004 and
   5005; for MQTT the panel is a broker's client. Linux keeps ports below 1024
   from an unprivileged process, and Actions runners are not root. The
   lockfile has `ws` only as something two packages pull in, and no MQTT, OSC
   or PNG package. Node 20, which CI runs, has no WebSocket server.
4. What a client can read. `knobs` in `/api/status` is the physical click count
   (`patternflow.ino:1214`), so an OSC delta, MIDI CC 24 to 27, an MQTT
   `knob/N` or an audio `d=` never shows there. `params`, `paramActive`,
   `lanes`, `laneActive`, `active` and `sleep` do. A held MIDI note, an MQTT
   `message` and everything the panel sends are seen only on the wire or on
   the panel. `tools/rtpmidi-probe` asserts nothing, and its CC 24 step waits
   for `knobs` to move.
5. REST against itself. `rest-api.md` says HTTP cannot write knobs (lines 596,
   604) and documents `POST /api/params` (160). It sends knob reads to
   `/api/mqtt` (595) and to `/api/status` (321). It calls MIDI the only
   absolute transport (604). Select answers with the state before the switch
   (38), and its example with the pick (259). A `pN` is required (165) and
   `dN` alone is allowed (178). Every error has a JSON body (610) and the 404
   a plain one (21). The clock is "Performance edition" (491) and "Utility
   edition" (620). The caps line (110) leaves out `audio-in`, `clock` and
   `midi`.
6. REST against the firmware. Undocumented: `rN=1` releases a channel, a `dN`
   past ±100 is a 400, `/api/patterns/file` and `/api/knobs` have replies the
   spec does not list, and status carries `variantVersion`, `hostAlias`,
   `txDbm` and `nvs`. `/api/display` clamps neither `screen` nor `level`.
7. The other four against the firmware. OSC rounds a float half away from zero,
   and an unknown address still teaches the panel its host. MIDI reads CC 24
   to 27 as binary offset (`core_midi.h:287`), as `midi-spec.md` line 57 says
   and line 40 does not; CC 120, 121 and 123 clear held notes. An empty MQTT
   `param/N` does not free a channel set in the last 250 ms
   (`core_bus.h:107`), and any `knob/N` drops the hold and moves 16 at most. The
   audio socket reads `a=-0.5` as a skipped slot and puts 0.5 on the next
   lane, takes `off=x` as `off=0`, and frees lanes when the last client
   leaves, not when a socket closes. Every delta starts the five-second hold
   (`patternflow.ino:1333`), where `audio-ws-spec.md` line 47 says a physical
   turn. MIDI over USB needs the S3's OTG controller, and a Node process has no
   USB device side; `midi_test.cpp` (CI) checks that receive map natively.
8. Presets. `firmware/patternflow/presets/` has 35 headers: 34 with a JS twin,
   and `calib`, firmware-only by `FIRMWARE_ONLY` in `check_presets.py`.
   `DeviceSim` with the Basics pack runs the same 34. `basics.zip` carries each
   module's sidecar, `absoluteReady` and knob names included.

## Defaults this plan takes

- D1. The virtual panel is `DeviceSim` behind sockets. A rule `DeviceSim` has
  is not written again; what it lacks, k1 adds without changing what the guide
  shows. Numbers come from `web/src/lib/shared/constants.ts` (step 3, k7), and
  width and height from one place, so §2.7's parameterised harness changes one
  line here.
- D2. No new dependency. Each protocol is the subset its spec names, on Node's
  own `http`, `dgram`, `net`, `crypto` and `zlib`. The lockfile does not move.
- D3. Ports. Defaults are the firmware's numbers, so the browser extension or
  an rtpMIDI driver can point at a virtual panel. Each takes an override, and
  the suites pass 0 for any free port, so they run without root.
- D4. Time. `npm run virtual-panel` runs in real time. A suite starts the panel
  on a manual clock and calls `advance(ms)`, which lets the sockets drain
  first, so the 500 ms release and the eight-second snapshot take no waiting.
- D5. One seam, fixed by k2. A transport is a file in
  `tools/virtual-panel/transports/`, attached when the caller asks for its
  feature (REST always). It gets the `DeviceSim`, the clock, the HTTP routes, a
  hook into `/api/status`, its cap, its ports, and events for a hand turn, a
  button, a pattern change and sleep. A transport that needs more says so
  under "for another k"; none edits `panel.ts`.
- D6. Fixture routes. `GET /frame.png` as §2.6 says, and under `/vp/` what no
  contract reaches: a hand, the clock, and what the pattern is given and shows
  (knob deltas, buttons, the banner, a thrown error). The firmware has none.
- D7. The vector format, fixed by k3 in `docs/contract-vectors.md`. One JSON
  file per vector: `contract` (spec and anchor), `says` (the sentence it comes
  from), `features`, and `steps`, each a `send` (`http`, `osc`, `midi`,
  `mqtt`, `ws`, `hand`, `wait`) and an `expect`: `reply` (status, headers,
  body), `status` (fields of `/api/status`), `out` (what the panel sent, and
  how soon) or `input` (D6). A shape is a literal, a type such as
  `"<number>"`, or an object naming the keys it needs; other keys pass
  (`rest-api.md` line 5), and `"<absent>"` forbids one. A vector whose `says`
  is gone from its spec fails, Markdown and whitespace aside, so a spec edit
  brings its vectors along.
- D8. Spec, not firmware. Vectors and the virtual panel follow the spec. Where
  the spec contradicts itself (finding 5), the vector follows the section
  that defines the route or message, and the PR names the other line for k23.
  Where the firmware disagrees (findings 6 and 7), the vector keeps the spec.
  Where the spec says nothing (`rN`, how a float rounds), there is no vector.
- D9. Issues. Each vector PR lists the firmware disagreements it encodes under
  "for an issue": the vector, the spec line, the firmware line (question 26).
- D10. The suites are drift checks; a file starting with `_` is a library. A
  suite starts a fresh panel per vector, talks to it only through its ports,
  and prints both sides through `compare` in `_lib.ts`. Once k3 merges,
  `_vectors.ts` is frozen, and a suite keeps its sender in its own `_` file.
- D11. Not replayed: Wi-Fi, the hotspot, firmware update, install, delete and
  format (no volume), the microphone, the clock feature, shows, weather, MIDI
  over USB. Each vector folder's README says so.
- D12. Branches, labels and descriptions as in the step 1 plan's D4. Vector JSON
  is written by hand and counts toward the 300 lines. `typecheck` and `lint`
  read `web/` only; k2 adds `tools/virtual-panel/` to `typecheck`, not `lint`.

## The PRs in detail

k1 touches `web/src/`, so it runs `typecheck`, `lint`, `check:ci` and
`check:panels` (§2.1). Every other PR runs `typecheck` and its own check, and
quotes one failing run made on a throwaway edit, reverted before commit. No PR
touches `firmware/`.

k1. `DeviceSim` gains reads of the bus values and holds, the lane values and
the click counts; a knob delta that is not a hand, which takes no lane and
frees no channel (the specs give that to a hand, `mqtt-spec.md` line 38,
`midi-spec.md` line 40); the release of one channel (an empty `param/N`) and
of one lane (`off=N`); and a lane source for the WebSocket. Proof:
`deviceSim.test.ts` passes as it was, a new case covers each addition, and
`check:sandbox-sync` shows the sandbox unchanged.

k2. `panel.ts` holds `start(options)`: the features (none is the default
build), the pack (Basics), a port per transport, the clock. It returns the
bound ports, `advance(ms)` and `close()`; `main.ts` takes the same as flags.
`http.ts` serves one request at a time (`rest-api.md` line 18), reads the query
and a form body only (26), and gives anything unrouted the plain-text 404 with
`no-store` (21). `tsconfig.json` extends `web/tsconfig.json`, `@/` mapped.
In `web/package.json`: `virtual-panel` (`tsx ../tools/virtual-panel/main.ts`),
`tsc --noEmit -p ../tools/virtual-panel` in `typecheck`, and
`check:rest-vectors`, `check:mqtt-vectors`, `check:osc-vectors`,
`check:midi-vectors`, `check:audio-vectors` and `check:virtual-panel`, each
`tsx scripts/drift.ts <name>`, which fails and says why until its file lands.
Proof: `/frame.png` shows Origin, and a `/vp/turn` changes the next one.

k3. `docs/contract-vectors.md` is D7 with one example per transport.
`_vectors.ts` reads a folder, starts a panel per vector, runs its steps with
its own senders (`http`, `hand`, `wait`) and those a suite passes in, matches
shapes, checks `says`, and prints both sides.

k4 and k5. `rest-state.ts`: `GET /api/status` with every field the table
documents (`rest-api.md` lines 72 to 112), caps from its features, and what
transports add; `/api/params`, `/api/sleep`, `/api/display`, `/api/knobs`,
`DELETE /api/crash` (its 404) and the favicon. `rest-patterns.ts`:
`GET /api/patterns` (Origin as the preset, the rest as modules), select by
`index`, `name` and `step` with its 404 and CORS, and `/api/patterns/file` for
`ext=json` (the sidecars in `basics.zip`, read as `console_demo.py` reads
them) and `ext=thumb` (`PFT1`, the last frame in RGB565).

k6 and k7. k6: `/api/status` (the documented keys, by type), `/api/params` (a
subset, the reply, a hold a hand takes back), `/api/sleep` (each spelling of
`on`, the 400 and its text, the state before the switch), the README and
`rest-vectors.ts`. k7: display, knobs, crash, the favicon, the 404,
`no-store`, the pattern routes, and `absent-*`: on the default build
`/api/mqtt`, `/api/midi` and `/api/audio` answer 404 and `caps` is
`["patterns","params","sleep"]` (lines 110, 613).

k8. `virtual-panel.ts` lists the headers in `firmware/patternflow/presets/`,
drops `FIRMWARE_ONLY` as `check_presets.py` names it, and needs the rest on the
panel's list. It selects each over REST, advances two seconds, reads a 128×64
PNG, and fails on a thrown error `/vp/state` reports.

k9 to k12. `mqtt.ts` is an MQTT 3.1.1 client at QoS 0 with retain, keepalive
and no wildcards (`mqtt-spec.md` line 12), the roles and channels (13, 14),
the topics (22 to 28), and the eight-second snapshot. `mqtt-http.ts` is
`/api/mqtt` (`rest-api.md` lines 343 to 367) and the `mqtt` fields in status.
`_broker.ts` is enough of a broker to connect, subscribe, publish and retain.
k11: the topics in each role, the words `sleep` takes, `param/N` and its empty
payload, `knob/N` as a difference, `pattern` by name or slug. k12: channels 1
to 4 forcing Subscriber, Broadcast taking no snapshot, a snapshot's `param`
overwriting a write, and `/api/mqtt`.

k13 and k14. `osc.ts` listens on 9001 and replies to the sender's address on
9000: `i` and `f` arguments, 256 bytes, no `#bundle`, eight datagrams a frame,
the announce burst, the heartbeat, a hand's `delta` and `clicks`, buttons and
pattern changes. `_osc.ts` packs and reads OSC. The vectors: a ping and its
burst, a delta as an int and as a float any rounding settles (2.6), a pattern
index, `content/toggle` doing nothing, an unknown address, a `#bundle`.

k15 to k18. `midi.ts` is the session listener on 5004 and 5005 (invitation,
clock sync, `BY`), RTP-MIDI's command list, the channel rule and the receive
table (`midi-spec.md` lines 39 to 42). `midi-out.ts` is the send table (57 to
60), with `outDiv`, `outMul` and the 50 ms pacing, plus `/api/midi` and `midi`
in status. `_rtpmidi.ts` is an initiator shaped like `rtpmidi_probe.py`. In:
CC 20 at 0, 1, 64 and 127 (0, 8, 504, 1000), CC 24 at 65 and 63, where lines
40 and 57 agree, notes 60 to 63, Program Change, another channel. Out: a
hand's turn in `abs` and `rel`, the pacing, Program Change, no echo.

k19 and k20. `audio-ws.ts` is a WebSocket server on 81, the grammar in
`audio-ws-spec.md` lines 27 to 31, the 500 ms release, `audioRuntime` and
`/api/audio`; `_ws.ts` a client for Node 20. The vectors: `a=` with `-` slots,
`k=` clamped, `d=`, `off=N` and `off`, an unknown prefix, a lane let go 500 ms
after its last message and kept while it is resent, a hand taking a lane for
five seconds, and messages ignored while `audioRuntime` is off.

k21 and k22. `AGENTS.md` maps `tools/virtual-panel` and a vector folder beside
each contract (adding the missing `mqtt-spec.md`) and lists the new commands;
it runs `check_versions.py`, which parses the file. k22: `docs/README.md`
names each contract's vectors as it names pfst's, and the format;
`docs/REPOSITORY.md` and `tools/README.md` name the virtual panel, the one
thing in `tools/` that is not a client, and `tools/virtual-panel/README.md`
lists its transports; `CONTRIBUTING.md`'s wire-contract row says a spec change
moves its vectors; `web/ARCHITECTURE.md` (line 121) and `web/README.md` name
the suites.

k23. Only for the lines the maintainer rules on (question 27): it corrects the
losing line in `rest-api.md` or `midi-spec.md`, adds a version-history row, and
re-quotes each vector that quoted it. A docs fix, reviewed as one.

k24. After every other k: regenerate both CSVs, check §2.6's "done when" (five
suites in CI against the virtual panel, every preset running) and §2.12's
third item (REST and MQTT, the full preset list), and write step 4 into
`docs/rfc-cleanup-progress.md` the way step 0 is written.

## Questions for the maintainer

Numbered on from the step 3 plan's 25, each with the default the PRs use.

26. Who opens the issues the vector PRs list (D9)? A session scoped to the fork
    cannot write upstream. Default: you, from each PR's list.
27. Where the spec contradicts itself, does the route's own section win (D8)?
    Select is the sharpest case: line 38 says the old state, and the example
    and the firmware give the new pick. Default: yes, and k23 fixes the other.
28. The five-second hold: the spec gives it to a hand, the firmware to any
    delta (finding 7). An integration tested against the virtual panel meets a
    different panel there. Default: an issue, and the spec stands.
29. The suites reach the virtual panel only through its ports, so a
    `--panel <address>` could walk a real device too, except for vectors that
    use `/vp/` or the manual clock. Default: not in this step.
