# Case models

The 3D models the [/build](https://patternflow.work/build) page's preview shows, one per case on its case switch, and the scripts that make them from files in this repository. Pick a case on the switch and the device in the preview is that case, with the same Patternflow inside it: the LED panel, the v3.9 board, the ESP32 DevKit and four knobs.

| Case | Model | Made from | Script |
| :--- | :--- | :--- | :--- |
| Official | `web/public/cases/official/model.glb` | `web/public/guide/case-v39.glb`, the guide's v3.9 case (itself exported from `hardware/case/source/patternflow_case.blend`) | `assemble.mjs official` |
| Besoiobiy | `web/public/cases/besoiobiy-printed/model.glb` | `hardware/case/remixes/besoiobiy-printed/source/patternbox.stl` | `besoiobiy.py`, then `assemble.mjs` |
| SimonePDA | `web/public/cases/simonepda-lasercut/model.glb` | `hardware/case/remixes/simonepda-lasercut/lasercut_layout.pdf` | `simonepda.py`, then `assemble.mjs` |

Run `./build.sh` to make all three again. The models are committed; nothing here runs when the site builds.

## Setup

```sh
cd tools/case-models
npm ci                                   # glTF-Transform, Draco, meshoptimizer
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
```

`preview.mjs` also needs the web app's dependencies (`npm ci` in `web/`) and Playwright with a Chromium.

## How a model is put together

A case script makes the case's *shell*: one mesh per part, assembled, in the model frame below, with material names from `lib/looks.mjs`, and a `placement.json` saying where this case holds the board and the LED panel. `assemble.mjs` then adds what every case has, from the files the guide uses:

- the LED panel, `source/led_panel.glb`: the node `l` of the landing page's first model (`web/public/3dforweb.glb`, which this replaced), unchanged; `extract_led.mjs` took it out;
- the v3.9 board, `web/public/guide/pcb-v39.glb`, and the DevKit, `web/public/guide/devkit.glb`, simplified with meshoptimizer — the preview shows them small, through a case;
- the official knobs from `case-v39.glb`, unless the case has its own;

sets every material's look by name (`lib/looks.mjs`), compresses the meshes with Draco like the site's other models, and writes `web/public/cases/<case>/model.glb`.

### The model frame

One unit is 10 mm. The device stands facing +z, +y up with the knobs at the top, +x to the reader's right: the LED panel on the left, the knob column on the right. It is the frame the guide's models share (`web/src/components/guide/stage/geometry.ts`, `parts.ts`); `lib/frame.mjs` copies the numbers this folder needs from there.

### The nodes the page relies on

`web/src/components/3d/caseModels.ts` finds these by name in every model:

| Node | What |
| :--- | :--- |
| `l` | The LED panel. The pattern shaders draw on its front face. |
| `c1` … `c4` | The knobs: origin on the encoder axis at the knob's base, axis +z. Named after the encoder nets as `case-v39.glb` names them: seen from the front, `c1` top-left, `c2` top-right, `c3` bottom-left, `c4` bottom-right. |
| `pcb_v39` | The board; its children keep `pcb-v39.glb`'s names. |
| `devkit` | The DevKit; its `module` is the ESP32 module, its `board` is renamed `devkit_board`. |

Every other top-level node is a part of the case, named by its script. Where each one goes when the preview draws the device apart is in `web/src/components/3d/cases/<case>.ts`.

## License

The scripts are MIT, like the rest of `tools/`. The models they make are drawings of the cases, and take the cases' license: CC BY-SA 4.0, crediting each remix's author as its README names them.
