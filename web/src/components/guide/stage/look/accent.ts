import * as THREE from "three";
import { accentNow } from "../../ui/panelTint";

// The page's accent, for what the stage draws in it.
//
// The page takes its accent from the panel (ui/panelTint.ts): the dot on the
// card being read, the chapter rail, a link's underline are the colour of the
// pattern playing. The stage's drawn light — the Wi-Fi's arcs, the stream of
// a deck arriving — used to stay the LED orange it was written in, and with
// the panel on a blue pattern the screen had two accents: a blue page, and
// orange arcs running into it. They are the page's signs, not the device's,
// so they take the page's colour: the very one it has now, eased and fenced
// as the page's is, not a second reading of the panel that could differ.
//
// What stays orange is what answers to the device itself: the dots on the
// knobs' dials and the tags beside them (Guide.module.css --g-led-fixed).

const ORANGE = new THREE.Color("#ff6a3d");
const now = new THREE.Color().copy(ORANGE);

/** The accent as light (the renderer's linear colour). The same object every call: copy it to keep it. */
export function stageAccent(): THREE.Color {
  const [r, g, b] = accentNow();
  // Whatever the page's loop is doing, the stage is never handed a colour that is not one.
  if (Number.isFinite(r + g + b)) now.setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
  else now.copy(ORANGE);
  return now;
}
