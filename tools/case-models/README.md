# Case models

The 3D models the [/build](https://patternflow.work/build) page's preview shows, one per case on its case switch, and the scripts that make them from files in this repository. Pick a case on the switch and the device in the preview is that case, with the same Patternflow inside it: the LED panel, the v3.9 board, the ESP32 DevKit and four knobs.

| Case | Model | Made from | Script |
| :--- | :--- | :--- | :--- |
| Official | `web/public/cases/official/model.glb` | `web/public/guide/case-v39.glb`, the guide's v3.9 case (itself exported from `hardware/case/source/patternflow_case.blend`) | `assemble.mjs official` |
| Besoiobiy | `web/public/cases/besoiobiy-printed/model.glb` | `hardware/case/remixes/besoiobiy-printed/source/patternbox.stl` | `besoiobiy.py`, then `assemble.mjs` |
| SimonePDA | `web/public/cases/simonepda-lasercut/model.glb` | `hardware/case/remixes/simonepda-lasercut/lasercut_layout.pdf` | `simonepda.py`, then `assemble.mjs` |

Run `./build.sh` to make all three again (or `./build.sh <case>` for one). The models are committed; nothing here runs when the site builds. Every step is deterministic: the same files in give the same bytes out.

| Model | Size | Loads |
| :--- | ---: | :--- |
| `official/model.glb` | 316 KB | with the page (the guide uses it too) |
| `besoiobiy-printed/model.glb` | 345 KB | when its tab is hovered or picked |
| `simonepda-lasercut/model.glb` | 331 KB | when its tab is hovered or picked |

The landing page's model before these, `web/public/3dforweb.glb` (a v3.0 device), was 1,155 KB and loaded with the page.

## Setup

```sh
cd tools/case-models
npm ci                                   # glTF-Transform, Draco, meshoptimizer
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
```

`build.sh` uses `.venv/bin/python` when it is there (or `$PYTHON`). `preview.mjs` also needs the web app's dependencies (`npm ci` in `web/`) and Playwright with a Chromium.

## How a model is put together

A case script makes the case's *shell*: one mesh per part, assembled, in the model frame below, with material names from `lib/looks.mjs`, and a `placement.json` saying where this case holds the board and the LED panel:

```text
{ "board": [dx, dy, dz], "led": [x, y, z], "knobs": "official" | "shell", "knobBaseZ": z }
```

`board` is added to where the official case has the board, the DevKit and the knobs; `led` is the panel node's translation, its z the LED face; `knobs` says whether the shell has its own `c1` … `c4` or takes the official ones (standing at `knobBaseZ`). `assemble.mjs` then adds what every case has, from the files the guide uses:

- the LED panel, `source/led_panel.glb`: the node `l` of the landing page's old model, its name, transform, geometry and UVs unchanged. `extract_led.mjs` took it out; the old file is at `git show v3.11.0:web/public/3dforweb.glb`;
- the v3.9 board, `web/public/guide/pcb-v39.glb`, and the DevKit, `web/public/guide/devkit.glb`, simplified with meshoptimizer — the preview shows them small, through a case;
- the official knobs from `case-v39.glb`, unless the case has its own;

sets every material's look by name (`lib/looks.mjs`; materials merge only when their names match, since the page swaps looks by name), compresses the meshes with Draco like the site's other models, and writes `web/public/cases/<case>/model.glb`.

`preview.mjs <model.glb> <out.png> [--explode]` renders a model from four sides without starting the site.

### The model frame

One unit is 10 mm. The device stands facing +z, +y up with the knobs at the top, +x to the reader's right: the LED panel on the left, the knob column on the right. It is the frame the guide's models share (`web/src/components/guide/stage/geometry.ts`, `parts.ts`); `lib/frame.mjs` copies the numbers this folder needs from there.

### The nodes the page relies on

`web/src/components/3d/caseModels.ts` finds these by name in every model, and `caseModels.test.ts` checks that they are there:

| Node | What |
| :--- | :--- |
| `l` | The LED panel. The pattern shaders draw on its front face, with its UVs. |
| `c1` … `c4` | The knobs: origin on the encoder axis at the knob's base, axis +z, no rotation. Named after the encoder nets as `case-v39.glb` names them: seen from the front, `c1` top-left, `c2` top-right, `c3` bottom-left, `c4` bottom-right. |
| `pcb_v39` | The board; its children keep `pcb-v39.glb`'s names. |
| `devkit` | The DevKit; its `module` is the ESP32 module, its `board` is renamed `devkit_board`. |

Every other top-level node is a part of the case, named by its script. Where each one goes when the preview draws the device apart is in `web/src/components/3d/cases/<case>.ts`.

## Official: `assemble.mjs official`

The guide's v3.9 case (`body`, `back_plate`, `back_slider`, `top_lid`) in white PLA, with the knobs, the board and the DevKit where the guide seats them. There is no shell script: the case is already in the model frame.

## Besoiobiy: `besoiobiy.py`

`hardware/case/remixes/besoiobiy-printed/source/patternbox.stl` is Besoiobiy's whole Blender scene in one STL. The case lies face up, front toward +z, and every part faces the way it does assembled, but the parts are pulled apart: the variant box halves are stacked above the main ones, the covers lie below, the knob cap stands above it all, and 45 modelling helpers lie around them. Each file in the remix's `stl/` is one connected piece of that scene, moved to where it prints. The script:

1. **Finds the parts.** It splits the scene into connected pieces and matches each `stl/` file on numbers a move cannot change: triangle count, surface area, volume and principal moments of inertia. It takes the two frame halves, the lettered box halves with the bridge (`box_top.stl`, `box_bottom.stl`, as in Besoiobiy's photo), the four covers and the knob cap, and leaves out the variants and the helpers.
2. **Puts them together with translations only**, each worked out from the faces that meet, not from the scene's spacing:
   - each bottom half's joint face goes onto its top half's, with its 2 mm keys in the top half's pockets;
   - the box's side goes onto the frame's outer side, with the box's keys in the frame's pockets and the fronts flush;
   - each cover keeps its half's x and y, and its back sits flush with the case's back, which puts it on its 2 mm ledge.
3. **Checks the result against the remix README** and stops if any of it is off: 267 × 329 × 30.85 mm overall, the 161 × 321 mm panel opening, the tabs 14.35 mm behind the front edge, four 7.2 mm encoder holes 30.8 × 30.1 mm apart, nothing behind the front where an encoder sits, and no two parts overlapping (boolean intersections, manifold3d).
4. **Moves it into the model frame** with a half turn about z, 10 mm to the unit. The outline is centred where the official case's is and the front face is set at the official's z. Each part is one node (`frame_top`, `frame_bottom`, `box_top`, `box_bottom`, `cover_frame_top`, `cover_frame_bottom`, `cover_box_top`, `cover_box_bottom`, in `pla_white`), and Besoiobiy's knob cap is `c1` … `c4` (`pla_black`). Normals keep every edge sharper than 35° hard and smooth the round surfaces.

In `placement.json`, `board` centres the board's encoders on the four holes: the board's 31 × 30.5 mm grid against the holes' 30.8 × 30.1 mm leaves half the difference on each side, which the build absorbs in play. The board sits 1 mm further back than in the official case, because the box's front is 4 mm thick where the official's is 3 mm. The knob caps stand on the board's encoder axes, 0.8 mm off the front, like the official knobs. `led` centres the panel in the frame's opening with its face flush with the frame's front edge, as a panel with Besoiobiy's 14.35 mm socket depth sits. The panel model is a 17 mm slab, so its back passes 2.6 mm into the frame's tabs; a real panel's sockets stop on them.

## SimonePDA: `simonepda.py`

There is no 3D file for this case, only Simone's drawing. `simonepda.py` builds the shell from `hardware/case/remixes/simonepda-lasercut/lasercut_layout.pdf`. It reads every cut path with PyMuPDF (the drawing is 1:1, 1 pt = 25.4/72 mm) and stops if the sheet does not come out at 256 × 340 mm. Every other size comes from the drawing:

| Page | What the script takes from it |
| :--- | :--- |
| 3 | The plate: its rounded outline, 14 screw holes (5 mm), 4 knob holes (8 mm, on 30 × 30 mm), 4 connector windows (60 × 40 mm) and the 3 slots for the box (2.7 mm wide) |
| 2 | Where the panel sits: the 160 × 320 mm outline drawn on the plate |
| 4 | Where the box sits: its lid drawn on the plate. The script checks it is the outline page 5 cuts |
| 1 | The four border strips, 16 mm wide: 322 and 162 mm long |
| 5 | The box (a lid and four finger-jointed walls, keys on three of them, two cable notches) and a foot (an open cube of five 30 mm squares) |

Each part is its drawn outline, holes and fingers included, extruded and stood where it goes. Page 3 is the plate seen from the front, so the panel ends up on the left and the knobs at the top right.

The plate and strips are 2.75 mm thick, the acrylic the remix README names. The box and the feet are 2.7 mm thick, the depth their finger joints are drawn at, so they interlock exactly. The plate takes the place of the official case's front face; the board is centred under the knob holes, its encoders bearing on the plate's back. The strips stand on edge around the panel, each flush at one corner and 2 mm past the next.

The drawing does not say which way the box walls face along their length. The photos do: the ribbon-cable notch is towards the panel, a little below the middle, and the power notch is at the bottom right. Nor does it place the three feet: since the box is as deep as a cube is tall, they go in the three back corners the box leaves free.

The plate, strips and feet use `sheet_face`/`sheet_edge`; the page shows them as acrylic or MDF (the finishes in `web/src/components/3d/cases/simonepda-lasercut.ts`). The box uses `acrylic_face`/`acrylic_edge` in both finishes. Run it with no arguments; `--pdf` and `--out` override the defaults.

## How the preview uses a model

`web/src/components/3d/HeroScene.tsx` with `heroCase.ts` draws whichever model the Build panel's case switch is on.

- **Loading.** Only the official model is preloaded with the page. A remix's model loads when it is picked, or when its tab is hovered (`preloadCaseModel.ts`). The current case stays on screen until the new model has arrived. A model that fails to load is caught, and the official case stays up.
- **Its own copy.** The preview works on a deep clone of drei's cached scene, with its own copy of each material, so it never changes what the guide shares. It finds the parts by the node names above; every other top-level node is treated as a piece of the case.
- **Placement.** The model is measured once when it arrives. It is centred on the preview's orbit target and scaled so its front outline (the diagonal of its box's width and height) matches the official device's. A case bigger than the official one is drawn a little smaller, so all three cases stand in the same place at the same size; a script does not need to match the official case's size or origin, only the frame's axes and units.
- **The Build steps** use what `web/src/components/3d/cases/<case>.ts` gives: step 1 shows the case pieces and knobs at 40% of their explode vectors; step 2 shows the board and DevKit, framed on their box; step 3 moves every top-level node by its explode vector times the panel's slider.
- **Finishes.** A case's alternative finishes recolour materials by name over the file's own. A look below full opacity is drawn see-through: blended, not writing depth, and casting no shadow.

## Adding a case

A remix with 3D files (or a drawing exact enough to stand up) gets a model the same way: a script in this folder that writes a shell and a `placement.json` in the frame above, a line in `build.sh`, an entry in `web/src/components/3d/cases/`, and the case's card in `web/src/components/sections/build-cases-data.ts`.

## License

The scripts are MIT, like the rest of `tools/`. The models they make are drawings of the cases, and take the cases' license: CC BY-SA 4.0, crediting each remix's author as its README names them.
