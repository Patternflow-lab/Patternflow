# tools/

Clients that Patternflow ships and that run on their own — a browser extension, a phone app, a diagnostic script. The line between this folder and [`integrations/`](../integrations/README.md): a **tool** is a standalone program of ours; an **integration** is a bridge that runs inside or beside someone else's software (a DAW, Max, TouchDesigner, Node-RED). Both talk to the panel only through the contracts in [`docs/`](../docs/README.md#contracts--other-software-is-built-against-these-not-against-the-firmware-source).

| Folder | What it is | Contract |
| :--- | :--- | :--- |
| [`patternflow-audio-extension/`](patternflow-audio-extension/README.md) | Chrome/Edge extension: captures the current tab's audio, splits it into four bands, one per knob, that you shape as boxes on the live spectrum, and streams the four knob values to the panel | [`audio-ws-spec.md`](../docs/audio-ws-spec.md) |
| [`patternflow-audio-android/`](patternflow-audio-android/README.md) | The phone-side twin: captures what the phone is playing and drives the knobs with it, for filming. It takes its mapping from the panel | [`audio-ws-spec.md`](../docs/audio-ws-spec.md), and the microphone endpoints of [`rest-api.md`](../docs/rest-api.md#microphone-audio-edition) |
| [`rtpmidi-probe/`](rtpmidi-probe/README.md) | A plain-Python RTP-MIDI session initiator that walks the MIDI contract against a panel from a machine with no MIDI driver | [`midi-spec.md`](../docs/midi-spec.md) |

## The extension is also firmware source

The mapping editor in `patternflow-audio-extension/` is the **authoring source of the device's own `/audio-in` console page**. Four of its files travel to the panel: `editor.html` (the editor's body), `editor.css` and `mapping.js` (each down to its `EXTENSION ONLY` line) and `editor.js`. `editor-adapter.js` does not: the panel has its own adapter, frame and styles beside the other console sources (`firmware/patternflow/console/_audio_in_*`). `python firmware/toolchain/console_pages.py build` assembles `firmware/patternflow/console/audio-in.html` from both halves (the step is `firmware/toolchain/build_audio_in_page.py`) and bakes the header the panel serves; `python firmware/toolchain/console_serve.py` previews the page from the sources without building. The `console-sync` workflow fails when the generated page is not what its sources assemble to, or is over its size budget. Edit the editor here, never the generated page, and do not move this folder — the build script and the workflow hold its path.

## License

Code in `tools/` is MIT, like the firmware and the site ([`LICENSE-MIT`](../LICENSE-MIT)). Each tool's README says how to build and run it.
