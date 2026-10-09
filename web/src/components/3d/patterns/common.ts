// Common vertex shader shared by all patterns
export const patternVert = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// The LED panel's mesh in the case models ("l") is the whole panel: its face,
// and its moulded rim, sides and back. ledVert hands ledPanel what it needs to
// tell them apart and to light the frame.
export const ledVert = `
varying vec2 vUv;
varying vec3 vObjN;
varying vec3 vViewN;
varying vec3 vViewPos;
void main() {
  vUv = uv;
  vObjN = normal;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vViewPos = mv.xyz;
  vViewN = normalMatrix * normal;
  gl_Position = projectionMatrix * mv;
}`;

/**
 * What a pattern's colour for one LED looks like on the panel: GLSL defining
 * vec3 ledPanel(vec3 col), for a pattern's fragment shader to finish with
 * (it declares vUv itself; this adds ledVert's other varyings).
 *
 * As on the real panel: a grid of round emitters on a black mask, an unlit
 * LED a dark package in it. Each emitter's edge is smoothed over a screen
 * pixel; once an LED is smaller than about three pixels the dots would beat
 * against the pixel grid, so each LED becomes its whole cell instead, which
 * is how the preview always drew it.
 *
 * The colours reach the bloom and the tone curve (HeroScene) as light. A
 * single colour's emitter is held under the curve's knee, so it keeps its
 * hue, as pure as before there was a curve; only the white in a colour (all
 * three of an LED's dies at once) runs hot, so whites glow, and a white dot
 * carries its whole cell's light, so the bloom off a field of dots is what it
 * was off the solid cells.
 *
 * Off the face — the rim, the sides and the back — it is the frame's black
 * plastic under the preview's key light, not the pattern smeared over it.
 */
export const ledPanel = `
varying vec3 vObjN;
varying vec3 vViewN;
varying vec3 vViewPos;

const vec2 LED_GRID = vec2(128.0, 64.0);
// The emitter's radius in its cell.
const float LED_R = 0.4;
// Where a colour tops out: under the tone curve's knee (NeutralToneMapping
// leaves everything below 0.76 alone).
const float LED_HUE_MAX = 0.8;
// A white emitter, drawn as a dot, carries its whole cell's light: the bloom
// takes in what is over its threshold whole, so a field of white dots glows
// as the solid cells did.
const float LED_WHITE_DOT = 1.0 / (3.14159265 * LED_R * LED_R);

vec3 ledPanel(vec3 col) {
  vec3 n = normalize(vViewN);
  vec3 v = normalize(-vViewPos);
  // HeroScene's key light: above right, in front.
  vec3 key = normalize((viewMatrix * vec4(0.306, 0.519, 0.799, 0.0)).xyz);
  float diff = max(dot(n, key), 0.0);

  if (vObjN.y > -0.5) {
    float spec = pow(max(dot(n, normalize(key + v)), 0.0), 28.0);
    return vec3(0.010) + vec3(0.040) * diff + vec3(0.05) * spec;
  }

  // The white in the colour, and the colour over it, held under the knee.
  float white = min(col.r, min(col.g, col.b));
  vec3 hue = col - white;
  hue *= min(1.0, LED_HUE_MAX / max(max(hue.r, max(hue.g, hue.b)), 1e-5));
  float hot = smoothstep(1.0, 2.0, white);

  vec2 g = vec2(vUv.y, 1.0 - vUv.x) * LED_GRID;
  vec2 gw = fwidth(g);
  // LEDs per screen pixel, along the worse of the two directions.
  float fw = max(gw.x, gw.y);
  float d = length(fract(g) - 0.5);
  float edge = max(fw * 0.7, 0.06);
  float emitter = 1.0 - smoothstep(LED_R - edge, LED_R + edge, d);
  // Dots while an LED is about three pixels or more; its whole cell below that.
  float dots = 1.0 - smoothstep(0.28, 0.42, fw);
  float shape = mix(1.0, emitter * mix(1.0, LED_WHITE_DOT, hot), dots);

  // Unlit: the black mask, and each LED's dark package in it.
  vec3 body = vec3(0.004) + vec3(0.012) * mix(1.0, emitter, dots) + vec3(0.004) * diff;
  return body + (hue + white) * shape;
}
`;

// Pattern type definition
export interface PatternDef {
  name: string;
  fragmentShader: string;
  // Default uniform values (all patterns share these base uniforms)
  defaults?: {
    uSpeed?: number;
    uParam1?: number;
    uParam2?: number;
    uParam3?: number;
    uParam4?: number;
  };
}
