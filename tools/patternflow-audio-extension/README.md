# Patternflow Audio Chrome Extension

Captures the audio of a Chrome or Edge tab, splits it into four frequency
bands, and sends each band to one of the panel's four knobs over your local
network. The panel has to run the **Audio edition**
([patternflow.work/editions](https://patternflow.work/editions)).
[`AUDIO_GUIDE.md`](../../AUDIO_GUIDE.md) is the guide to everything around it;
the wire protocol is a written contract,
[`docs/audio-ws-spec.md`](../../docs/audio-ws-spec.md).

## Install

It is not on the Chrome Web Store. Load it from this folder:

1. Get the repository: `git clone`, or **Code → Download ZIP** on GitHub and
   unzip it.
2. Open `chrome://extensions` (in Edge, `edge://extensions`).
3. Enable **Developer mode**.
4. Click **Load unpacked** and pick this folder,
   `tools/patternflow-audio-extension`.

**After pulling a newer copy, press Reload** on the extension's card in
`chrome://extensions`. Chrome goes on running the files it loaded until you
do. The card shows the version (`version` in `manifest.json`), which is how to
tell the copy that is loaded from the one on disk.

**Reload keeps the mapping you had.** A copy before 0.2.0 started with Auto
range off and no curve, and unless you changed them its mapping still says so
after Reload: the Auto range switch is off, the four boxes are full height,
and under the curves it reads "This knob uses the default response." The new
defaults (Auto range on, the Smooth curve) are what a new install starts
with. To get them on a copy you already had, do one of:

- in the mapping editor, select each knob in turn and press its Reset
  (**Reset K1** to **Reset K4**), then switch **Auto range** on. Reset also
  puts that knob's box and output range back to the default. The panel's
  address is kept;
- **Remove** the extension on `chrome://extensions` and load it again from
  this folder. That empties everything it stored, the panel's address
  included.

## Use

1. Go to the tab that is playing: YouTube, SoundCloud, a DJ set, a web DAW.
2. Click the Patternflow Audio button in the toolbar, on that tab.
3. Under **Device**, type the panel's address: `patternflow.local`, or its IP
   (the panel's NETWORK screen shows it).
4. Press **Start**. The button now reads **Stop**.

The word in the popup's corner is the state, and the line under the address
says the rest:

| | |
|---|---|
| **Idle** | Nothing is captured. |
| **Connecting** | The connection is not open yet, or the panel has not yet said whether it is listening. |
| **Live** | The tab is captured and the panel is being driven. The line reads `Capturing: <tab title>`, or "No sound from this tab yet." / "... right now." while the tab is silent. |
| **Aud off** | Connected, but Audio-React is switched off on the panel, which then ignores what arrives. Press **Turn on**, which appears under the address. It is the same switch as `AUD` on the panel's NETWORK screen and *Browser extension and phone app* on the console's Audio page. |
| **Test** | The test connection (below) is up. |
| **Error** | The line says what: nothing at that address, a panel that does not run the Audio edition, a page Chrome does not let be captured. A connection that fails is retried by itself. |

**While the tab is silent or paused the knobs are held**, each where its band
rests, until you press Stop. A knob you turn by hand during a pause goes back
there about five seconds after you let go. Stop hands all four back to the
encoders. Closing the captured tab ends the capture, and the popup says so.

Enter in the address field starts a capture when nothing is running. While
one is running it only changes the address, and the capture follows it; it
never stops one.

**Spectrum** is what the tab sounds like, 20 Hz to 20 kHz.

**Test without audio** (click it open) connects without capturing anything:
**Connect**, then move K1 to K4. Each knob stays where its slider was put
until **Disconnect**. It is how to tell a panel that does not react from a
tab that is not being heard.

## The mapping editor

**Mapping editor ↗** opens the editor in a tab of its own. From the top:

- **Auto range**, **Attack** and **Damping** hold for all four knobs. With
  Auto range on, each box follows the loudness of what it hears; with it off,
  each has the window you set by hand. Attack is how fast a knob rises to a
  hit, Damping how slowly it falls back.
- **The plot** is the live spectrum with four boxes on it, K1 to K4. A box's
  width is the frequencies that knob listens to; its height is the
  quiet-to-loud range mapped onto it, in dB. Drag a box to move it and an edge
  to resize it. The line across a box is where the level sits in it now.
- **K1 to K4**, the tabs under the plot, select a knob. K1 is always knob 1.
- **Preview**, at the end of that row, puts a scope where the plot is: a test
  signal (kick pulses, a noisy room, a slow swell) run through the selected
  knob's attack, damping, curve and output range, which all stay adjustable
  around it. The same button closes it, and so does Esc.
- **The knob's card**: its **response curve** (Smooth, Sharp, Fall, Gate,
  Steps, Arch, or drag the two handles for a shape of your own), its **output
  range** (how far the knob travels) and **Mute** (the knob goes back to its
  encoder).
- **Reset K1** puts the selected knob back to its default.

Every edit saves itself and reaches a running capture at once. A new install
starts with Auto range on and the Smooth curve on all four knobs. Switching
Auto range off goes back to the windows you set by hand; dragging a top or
bottom edge while it is on switches it off and starts all four windows from
where the boxes are at that moment.

The mapping is kept in this browser (`chrome.storage`), not on the panel. The
panel's own Audio page has the same editor for its on-board microphone, with a
mapping of its own that is stored on the panel.

The bar at the top says what is feeding the editor, in the popup's words, and
where it is going, and has a Stop. Opened outside the extension the editor
runs on a synthesized demo source, which is the fast way to work on the
editor itself:

    python -m http.server 8000 --bind 127.0.0.1 --directory tools/patternflow-audio-extension
    # http://127.0.0.1:8000/editor.html

Nothing is captured there and nothing is kept.

## What it sends

To `ws://<address>:81` (a port typed with the address is used instead), one
text message per frame:

    a=0.412,0.300,-,0.871

Four knob values from 0 to 1, with a `-` for a muted knob. The analysis runs
30 times a second. A frame that has not changed is sent again about every
210 ms, because the panel hands a knob back to its encoder 500 ms after the
last message that set it. Muting a knob sends `off=N` once, and Stop sends
`off`. The test sliders use the same `a=` message. Measured against a loopback
socket: 23–26 messages a second on music, 5 a second on silence.

It also asks the panel three things over HTTP, on port 80 of the same address.
Each is asked once, never polled, because the panel serves one connection at
a time:

- `GET /api/audio` when the socket opens, and once more when the popup is
  opened while it reads *Aud off*: is Audio-React on?
- `POST /api/audio` with `on=1`: the **Turn on** button.
- `GET /api/status` once when the socket will not open: is anything there,
  and does it run the Audio edition?

Builds before 0.2.0 sent the test sliders as `k=N,v=F`, and the first ones
sent `d=N,v=F` deltas. The firmware still takes both.

## The files

| File | What it is |
|---|---|
| `manifest.json` | The extension itself. Permissions: `tabCapture`, `offscreen`, `storage`, `activeTab`, and `http://*/*` with `ws://*/*` to reach a panel on the local network. |
| `popup.html` `.css` `.js` | The capture console. It owns the panel's address (`patternflowAudioHost` in `chrome.storage.local`) and asks Chrome for the tab's stream. |
| `background.js` | The service worker: creates the offscreen document and relays messages between it and the pages. |
| `offscreen.html` `.js` | Holds the capture, runs the analysis and the mapping, owns the socket, and is the one place that knows the state every page prints (`phase`). |
| `mapping.js` | The mapping model, one object, `PFMap`: the defaults, what a stored mapping is turned into, the curves, and the chain from a level to a knob value. The mapping is stored under `patternflowAudioConfig`. |
| `editor.html` `.css` `.js` | The mapping editor. `editor.js` reaches its source only through `window.PFAdapter`; the contract is the comment at its top. |
| `editor-adapter.js` | `PFAdapter` for the extension (storage, the capture's frames), the editor's source bar, and the demo source. |
| `icons/` | The Patternflow mark, as the web app has it. |

## This folder is also firmware source

The panel's own `/audio-in` console page is this editor.
`firmware/toolchain/build_audio_in_page.py` assembles that page from two
places:

- here: `editor.html` (what is between its two `EDITOR BODY` lines),
  `editor.css` and `mapping.js` (what is above their `EXTENSION ONLY` line)
  and all of `editor.js`;
- the panel's half, in `firmware/patternflow/console/`: `_audio_in_bar.html`
  (the page around the editor), `_audio_in.css` (the console's look) and
  `_audio_in_adapter.js` (`PFAdapter` over `/api/audio-in`).

So an edit to one of those four files here changes the panel's page as well.
After one:

    python firmware/toolchain/console_serve.py         # preview: /audio-in is assembled from the sources on every request
    python firmware/toolchain/console_pages.py build   # regenerate the page and the header the panel serves

Never edit the generated `firmware/patternflow/console/audio-in.html` or
`firmware/patternflow/features/audio_in/audio_in_index.h`, and do not move
this folder: the builder and the `console-sync` workflow hold its path. CI
fails a pull request whose generated page is not what its sources assemble
to, or whose page is over its size budget (17.5 KB gzipped, as the panel sends
it). Every byte of the shared half crosses the panel's Wi-Fi, so what only
the extension needs goes below the `EXTENSION ONLY` lines or into
`editor-adapter.js`. That includes the cream skin: above its line
`editor.css` is layout, and each surface brings its own colours. The rest is
in [`firmware/patternflow/console/README.md`](../../firmware/patternflow/console/README.md#the-page-that-is-assembled-audio-in).

The larger controller ideas that used to be listed here as "next" (spectrum
and waveform views, drag-to-select bands, per-band curves, gates and
smoothing) shipped as the mapping editor above. What remains open is tracked
in the repository's issues.
