# tools/virtual-panel/

A Patternflow with no board: the guide's `DeviceSim` (`web/src/lib/guide/deviceSim.ts`) behind the ports the firmware listens on, so the contract vectors in [`docs/`](../../docs/README.md) have a panel to replay against ([rfc-cleanup.md §2.6](../../docs/rfc-cleanup.md#26-step-4--the-test-spine)). It runs each pattern's JS twin, the code the guide and Pattern Lab run, never a `.pfm` module. It is a test fixture. Wi-Fi and firmware updates are not part of it.

    cd web
    npm run virtual-panel -- --port http=8080

HTTP is on 80 here as on the device, and Linux keeps every port below 1024 from a process that is not root, so the flag moves it. `--port '*=0'` binds each port to a free one and prints the number it got. `--features mqtt` composes a feature in by its directory name in `firmware/patternflow/features/`; with none the panel is the default build. `--pack origin` leaves out the Basics pack. `--clock manual` holds time still until something moves it.

`GET /frame.png` and everything under `/vp/` are the panel's own, and the firmware has neither. The PNG is the 128×64 frame as the LEDs would show it, brightness included. `/vp/turn?knob=2&detents=3` and `/vp/button?knob=4&down=1` are a hand, and `/vp/advance?ms=500` moves the manual clock. `/vp/state` says what the running pattern has been given since start, its knob deltas and button presses, with the name card over it and the first error it threw. Knobs count from 1, as in every contract.

A transport is a file in `transports/` whose default export is a `Transport` (`panel.ts`). `start()` attaches each one whose `feature` is `null`, and a feature's only when asked for it. Each gets a `Seam` with the `DeviceSim`, the panel's clock, the HTTP routes and its ports, a place for the fields it adds to `/api/status`, and events for a hand's turn, a button, a pattern change and sleep. Step 4's plan lists the transports to come ([k4 to k20](../../docs/investigations/2026-10-cleanup-step4-plan.md#the-prs)).
