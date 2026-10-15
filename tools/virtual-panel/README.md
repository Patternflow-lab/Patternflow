# tools/virtual-panel/

A Patternflow with no board: the guide's `DeviceSim` (`web/src/lib/guide/deviceSim.ts`) behind the ports the firmware listens on, so the contract vectors in [`docs/`](../../docs/README.md) have a panel to replay against ([rfc-cleanup.md §2.6](../../docs/rfc-cleanup.md#26-step-4--the-test-spine)). It runs each pattern's JS twin, the code the guide and Pattern Lab run, never a `.pfm` module. It is a test fixture. Wi-Fi and firmware updates are not part of it.

    cd web
    npm run virtual-panel -- --port http=8080

HTTP is on 80 here as on the device, and Linux keeps every port below 1024 from a process that is not root, so the flag moves it. `--port '*=0'` binds each port to a free one and prints the number it got. `--features mqtt` composes a feature in by its directory name in `firmware/patternflow/features/`; with none the panel is the default build. `--pack origin` leaves out the Basics pack. `--clock manual` holds time still until something moves it.

`GET /frame.png` and everything under `/vp/` are the panel's own, and the firmware has neither. The PNG is the 128×64 frame as the LEDs would show it, brightness included. `/vp/turn?knob=2&detents=3` and `/vp/button?knob=4&down=1` are a hand, and `/vp/advance?ms=500` moves the manual clock. `/vp/state` says what the running pattern has been given since start, its knob deltas and button presses, with the name card over it and the first error it threw. Knobs count from 1, as in every contract.

A transport is a file in `transports/` whose default export is a `Transport` (`panel.ts`). `start()` attaches each one whose `feature` is `null`, and a feature's only when asked for it. Each gets a `Seam` with the `DeviceSim`, the panel's clock, the HTTP routes and its ports, a place for the fields it adds to `/api/status`, and events for a hand's turn, a button, a pattern change and sleep. There are eight:

| Transport | Feature | What it answers | `--port` |
| :--- | :--- | :--- | :--- |
| `rest-state.ts` | core | Device state in [rest-api.md](../../docs/rest-api.md): `/api/status`, `/api/params`, `/api/sleep`, `/api/display`, `/api/knobs`, `DELETE /api/crash` and the favicon | `http`, 80 |
| `rest-patterns.ts` | core | The pattern list, select and a module's files, over the Basics pack as `basics.zip` carries it, and the volume's fields in `/api/status` | `http` |
| `mqtt.ts` | `mqtt` | [mqtt-spec.md](../../docs/mqtt-spec.md) as a broker's client: the roles, the channels, the topics and the eight-second snapshot. `GET /vp/mqtt` is the banner a `message` put up | none, it dials the broker `/api/mqtt` names |
| `mqtt-http.ts` | `mqtt` | `/api/mqtt`, the device page's `/api/mqtt/config` and `/api/mqtt/forget`, and the three `mqtt` fields in `/api/status`. The Director's routes are the 404 | `http` |
| `osc.ts` | `osc` | [osc-spec.md](../../docs/osc-spec.md) both ways | `osc`, 9001, and replies to `oscReply`, 9000 |
| `midi.ts` | `midi` | The RTP-MIDI session in [midi-spec.md](../../docs/midi-spec.md) and its *Host → device* table | `midi`, 5004, and the next port for data |
| `midi-out.ts` | `midi` | *Device → host* on `midi.ts`'s session, `/api/midi` and the `midi` block in `/api/status` | `http` |
| `audio-ws.ts` | `audio` | The WebSocket in [audio-ws-spec.md](../../docs/audio-ws-spec.md), its 500 ms release and `/api/audio` | `ws`, 81 |

Each file's header comment says which lines of the spec it follows, and which firmware source it reads where the spec says nothing. What none of them does is in each vector folder's README, under the vectors it does not have.

Nothing in CI runs `main.ts`. The suites in `web/scripts/drift/` call `start()` themselves: a vector suite gives each vector a fresh panel on free ports and the manual clock, and `check:virtual-panel` gives each preset in `firmware/patternflow/presets/` one of its own for two seconds and fails when any of them throws.
