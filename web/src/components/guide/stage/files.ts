// The stage's files by address, and nothing else. Nothing is imported here,
// three.js least of all, so the page can start fetching them before the
// stage's code has arrived (world/GuideWorld). What each file is and where
// it comes from: parts.ts (the device's four), geometry.ts (the LED panel),
// build/layout.ts (the Build stage's two).

/**
 * The official case model's LED panel, "l", the one part of that file the
 * guide uses, cut out of it by scripts/cut-led-panel.ts. The landing page's
 * preview loads the whole file (public/cases/official/model.glb): 317 KB,
 * where the panel is 11.
 */
export const LED_URL = "/guide/led-panel.glb";
export const CASE_URL = "/guide/case-v39.glb";
export const PCB_URL = "/guide/pcb-v39.glb";
export const DEVKIT_URL = "/guide/devkit.glb";

/**
 * The four, as Device loads them. useGLTF keeps what it loads under the whole
 * list it was given, so anything else on the stage that needs these files
 * asks for this list, in this order, and is handed Device's. The Build stage
 * asked for three of them in a list of its own, and they were fetched, parsed
 * and decoded a second time as the Build guide opened.
 */
export const DEVICE_MODELS = [LED_URL, CASE_URL, PCB_URL, DEVKIT_URL];

export const SPLIT_URL = "/guide/build/case-split.glb";
export const PLATES_URL = "/guide/build/plates.glb";
/** The Build stage's own two, as it loads them (build/BuildStage.tsx). */
export const BUILD_MODELS = [SPLIT_URL, PLATES_URL];

export const DRACO_URL = "https://www.gstatic.com/draco/versioned/decoders/1.5.7/";
/** What the models' decoder fetches from there in a browser with WebAssembly (three's DRACOLoader). */
export const DRACO_FILES = [`${DRACO_URL}draco_wasm_wrapper.js`, `${DRACO_URL}draco_decoder.wasm`];
