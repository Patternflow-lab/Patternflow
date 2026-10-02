import * as THREE from "three";
import { PANEL_H, PANEL_W } from "@/lib/guide/panelScreens";

// The LED panel's face.
//
// From where the whole device is seen it is an image: 128 × 64 LEDs are a
// pixel or two each and the eye — and the texture filter — blend them. As the
// camera comes close they come apart into what they are: a grid of small
// emitters, each a lit window in a black package, bright in the middle and
// falling off toward its edge, with black between them.
//
// The change-over is by how many screen pixels an LED covers, and it is made
// so that it cannot shimmer: an emitter is only drawn as a dot while its soft
// profile is a good pixel wide or more (a narrower dot would beat against the
// pixel grid as the camera moves — moiré), and below that the face is the
// filtered image, which the mipmaps keep still at any distance.
//
// The frame is the firmware's: sRGB bytes, the values a pattern was drawn
// with. The texture decodes them to light (SRGBColorSpace), so a mid grey is
// a fifth of full power, as it is on the real panel after the driver's gamma,
// and the room light, the bloom and the tone curve all work on light.
//
// The mesh ("l" of the landing model) is the whole panel, not only its face:
// its rim, sides and back are the moulded black frame, and they are drawn as
// that — dark plastic under the key light — instead of with the pattern
// smeared over them, which showed when the device comes apart.

/** LEDs across and up, as the panel stands in the device (portrait). */
const ACROSS = PANEL_H;
const UP = PANEL_W;

/** How bright a full-power LED is, in the stage's light (the white case under the key is about 1). */
export const LED_GAIN = 1.5;

const vertex = /* glsl */ `
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
}
`;

const fragment = /* glsl */ `
uniform sampler2D uTex;
uniform float uPower;
uniform float uGain;
varying vec2 vUv;
varying vec3 vObjN;
varying vec3 vViewN;
varying vec3 vViewPos;

const vec2 GRID = vec2(${ACROSS.toFixed(1)}, ${UP.toFixed(1)});

void main() {
  vec3 n = normalize(vViewN);
  vec3 v = normalize(-vViewPos);
  // The room's key light (GuideCanvas: from above right, in front), for what little a black surface shows of it.
  vec3 key = normalize((viewMatrix * vec4(0.41, 0.58, 0.7, 0.0)).xyz);
  float diff = max(dot(n, key), 0.0);

  // Not the face: the moulded frame.
  if (vObjN.y > -0.5) {
    float spec = pow(max(dot(n, normalize(key + v)), 0.0), 28.0);
    float rim = pow(1.0 - max(dot(n, v), 0.0), 3.0);
    gl_FragColor = vec4(vec3(0.012) + vec3(0.045) * diff + vec3(0.05) * spec + vec3(0.016) * rim, 1.0);
    return;
  }

  vec2 g = vUv * GRID;
  vec2 gw = fwidth(g);
  // LEDs per screen pixel, along the worse of the two directions.
  float fw = max(gw.x, gw.y);

  // The frame's x runs up the device, its y across.
  vec2 smoothUv = vec2(vUv.y, 1.0 - vUv.x);
  vec2 cell = (floor(g) + 0.5) / GRID;
  vec2 cellUv = vec2(cell.y, 1.0 - cell.x);
  // Up close each LED is one value; once LEDs are smaller than about two
  // pixels the filter takes over. The mip level follows the true footprint
  // either way (the snapped coordinate has no gradient of its own).
  float far = smoothstep(0.4, 1.0, fw);
  vec3 col = textureGrad(uTex, mix(cellUv, smoothUv, far), dFdx(smoothUv), dFdy(smoothUv)).rgb;
  // What the lit LEDs put into their surround: the lens, the mask, the eye.
  vec3 haze = textureLod(uTex, smoothUv, 3.0).rgb;

  // An emitter: a soft round window in its cell.
  vec2 c = fract(g) - 0.5;
  float d2 = dot(c, c);
  float dots = 1.0 - smoothstep(0.07, 0.24, fw);
  float lens = exp(-d2 / 0.085);
  float shape = mix(1.0, lens * 2.1, dots);

  // Whites run hot (they are three LEDs at once, and they bloom); a single
  // colour stays under the bloom's knee and keeps its hue through the tone curve.
  // (Judged on the eye's scale: a light grey is already most of the way to white.)
  float luma = pow(dot(col, vec3(0.2126, 0.7152, 0.0722)), 0.4545);
  vec3 emit = col * uGain * (1.0 + 0.95 * smoothstep(0.55, 0.95, luma));
  // LEDs are brightest square on, and lose a little to the side.
  float lobe = 0.4 + 0.6 * pow(max(dot(n, v), 0.0), 0.6);

  // Unlit: the black mask, and — up close — each package's dark window catching the room.
  vec3 body = vec3(0.007) + vec3(0.012) * diff + vec3(0.008) * lens * dots;

  gl_FragColor = vec4(body + (emit * shape + haze * uGain * 0.07) * lobe * uPower, 1.0);
}
`;

let shared: THREE.DataTexture | null = null;

/**
 * The texture the Device writes the shown frame into each frame (bottom row
 * first, as GL has it). One for the guide: the panel's face reads it, and so
 * does the floor, which mirrors the panel (StageLight.tsx). Its u runs up
 * the device and its v from the knob side to the left edge — a point of the
 * face at (across, up), both 0 … 1, is at (up, 1 − across).
 */
export function ledPanelTexture(): THREE.DataTexture {
  if (shared) return shared;
  const t = new THREE.DataTexture(new Uint8Array(PANEL_W * PANEL_H * 4), PANEL_W, PANEL_H, THREE.RGBAFormat);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  // For the face at a slant, and for the floor, which reads it through long thin footprints.
  t.anisotropy = 8;
  t.needsUpdate = true;
  shared = t;
  return t;
}

export function ledPanelMaterial(texture: THREE.Texture): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uTex: { value: texture }, uPower: { value: 0 }, uGain: { value: LED_GAIN } },
    vertexShader: vertex,
    fragmentShader: fragment,
  });
}
