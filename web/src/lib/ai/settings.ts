// ── The colour model a copied prompt asks for ───────────────────────────────
// The lab's project stores it (serialize.ts) and Copy prompt reads it
// (variantPrompt.ts). It lives apart from the prompt text so the serializer
// can name it without pulling the prompt in.

// How the patterns an AI writes handle colour:
// - "rgb": the model colours every pixel itself via setPixel (classic mode).
// - "vfield": the model outputs a pure 0..1 value field via setValue; colour is
//   applied by the user-controlled Color Ramp in Pattern Lab. Keeps the model
//   focused on geometry/motion — the part it's good at — and leaves colour to
//   the human.
//
// NOTE — there is deliberately no "orientation" setting any more. There used
// to be one, and it was the source of a whole class of broken output: it told
// the model to compose along the *opposite* axis from the one the user picked,
// to compensate for the panel's mounting, while every other line of the prompt
// still claimed the frame was 128×64. Orientation is not independent
// information: a 64×128 frame *is* portrait. The model gets the real frame
// dimensions and nothing else, and the logical→physical mapping happens once,
// at the display boundary. See lib/pattern/matrix.ts.
export type ColorMode = "rgb" | "vfield";
export const COLOR_MODES: ColorMode[] = ["vfield", "rgb"];
