// What the panel is showing, for the page — the stage's own signal
// (stage/look/panelGlow.ts) handed across without three.js coming with it.
//
// panelGlow lives in the stage's chunk and is made of three's colours; the
// page's bundle must not pull three in (the words never wait for it). So the
// stage copies what the page needs into this plain object a few times a
// second (ui/StageLoadReport, mounted with the canvas), and the page's tint
// (ui/panelTint.ts) reads it here. It is what the panel *shows*: dark while
// the device is apart on the hub or the power is held on the Build guide,
// fading when the power is cut — which the simulator's frame alone does not
// say. Until the stage is up (`live` false) the tint reads the simulator's
// frame itself.

export type PanelSignal = {
  /** The stage is up and writing this. */
  live: boolean;
  /** What colour the panel's light is, sRGB 0..255 (meaningless while `colour` is 0). */
  rgb: [number, number, number];
  /** 0..1: how much colour the panel carries (0: dark, or white and grey only). */
  colour: number;
  /** 0..1: how lit the panel is at all. */
  lit: number;
};

export const panelSignal: PanelSignal = { live: false, rgb: [0, 0, 0], colour: 0, lit: 0 };
