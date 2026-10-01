"use client";

/* eslint-disable react-hooks/immutability --
   The effects are imperative postprocessing objects driven from the frame
   loop; that is their API and it never feeds back into React. */

import { useFrame } from "@react-three/fiber";
import { EffectComposer, Bloom, FXAA, N8AO, ToneMapping, Vignette } from "@react-three/postprocessing";
import { BlendFunction, Effect, EffectAttribute, ToneMappingMode } from "postprocessing";
import { memo, useEffect, useMemo, type JSX } from "react";
import * as THREE from "three";
import { useGuideStore } from "../../store";
import { stageLoad } from "../../ui/stageLoad";
import { buildFocus } from "../build/focus";
import { stageFocus } from "./focus";
import { measureFrame, settingsFor, useTier } from "./quality";

// What the lens and the film do to the frame, in order:
//
//   occlusion   where surfaces meet, the room's light does not reach (N8AO)
//   focus       a shallow depth of field on what the step is about; the rest
//               of the stage falls a little soft, more the closer the camera is
//   bloom       only what is brighter than white glows: LEDs past their knee,
//               the live rings. The white case, however well lit, stays under
//               the threshold — it used to bloom the screen white.
//   tone curve  ACES
//   grade       a film's: shadows a touch cool, highlights a touch warm, a
//               gentle shoulder and toe, a little more colour
//   vignette
//
// Which of these a machine gets is its tier (quality.ts), measured from its
// own frame times. The composer is rebuilt only when the tier changes.

// ── the grade ───────────────────────────────────────────────────────────────

const gradeFrag = /* glsl */ `
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  // The frame here is display-linear; the eye's scale is what a grade works on.
  vec3 c = pow(max(inputColor.rgb, 0.0), vec3(1.0 / 2.2));
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  // Split tone: nothing is added to black (the canvas is transparent there), the tint is a gain.
  c *= mix(vec3(0.97, 0.995, 1.04), vec3(1.012, 1.0, 0.985), smoothstep(0.08, 0.75, l));
  // A film's curve: a toe and a shoulder round the same mid grey.
  c = mix(c, c * c * (3.0 - 2.0 * c), 0.16);
  // A little more colour in the mid-tones, none added to what is already full.
  float sat = 1.0 + 0.06 * (1.0 - smoothstep(0.55, 1.0, max(c.r, max(c.g, c.b)) - min(c.r, min(c.g, c.b))));
  c = mix(vec3(dot(c, vec3(0.2126, 0.7152, 0.0722))), c, sat);
  outputColor = vec4(pow(max(c, 0.0), vec3(2.2)), inputColor.a);
}
`;

class GradeEffect extends Effect {
  constructor() {
    super("GradeEffect", gradeFrag, { blendFunction: BlendFunction.NORMAL });
  }
}

function Grade() {
  const effect = useMemo(() => new GradeEffect(), []);
  useEffect(() => () => effect.dispose(), [effect]);
  return <primitive object={effect} dispose={null} />;
}

// ── the focus ───────────────────────────────────────────────────────────────
//
// A shallow depth of field, in close. The plane of focus is on what the step
// is about: the Build guide says what that is (build/focus.ts: the joint, the
// screw, the plug), and everywhere else it is what the camera is aimed at.
// It is followed on a spring, so a new subject is racked to, not cut to. How
// much falls soft goes with how close the camera is: from where the whole
// device is seen nothing does — as it would be — and the stage's drawn light
// (the stream, the Wi-Fi's arcs), which has no depth of its own, is in those
// wide shots and must stay sharp.
//
// One pass, and only where there is something to blur: each pixel off the
// plane of focus gathers from a small disc, taking from a neighbour only as
// much as that neighbour is itself out of focus — so what is sharp never
// smears into what is soft beside it, and what is sharp is never touched at
// all. (postprocessing's own depth of field is seven passes, a third of the
// frame's cost at a laptop's pixel ratio, and it halos what is in focus with
// what is behind it.)

const focusFrag = /* glsl */ `
uniform float uFocus;
uniform float uRange;
uniform float uRadius;

float softness(const in float depth) {
  return smoothstep(0.0, 1.0, abs(-getViewZ(depth) - uFocus) / uRange) * uRadius;
}

void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  float r = softness(depth);
  if (r < 0.6) {
    outputColor = inputColor;
    return;
  }
  vec4 sum = inputColor;
  float wsum = 1.0;
  // A ring of 6 at half the radius and a ring of 10 at the whole of it.
  for (int i = 0; i < 16; i++) {
    float ring = i < 6 ? 0.5 : 1.0;
    float a = i < 6 ? float(i) * 1.0471976 : float(i - 6) * 0.6283185 + 0.3;
    vec2 at = uv + vec2(cos(a), sin(a)) * (ring * r) * texelSize;
    float w = clamp(softness(readDepth(at)) - ring * r + 1.0, 0.0, 1.0);
    sum += texture2D(inputBuffer, at) * w;
    wsum += w;
  }
  outputColor = sum / wsum;
}
`;

class SoftFocusEffect extends Effect {
  constructor() {
    super("SoftFocusEffect", focusFrag, {
      blendFunction: BlendFunction.NORMAL,
      // DEPTH only. Declared a CONVOLUTION, the composer gives the effect a
      // pass of its own with a multisampled target, whose resolve blits
      // colour and depth together and fails on this depth format — every
      // frame, silently: the pass after it then read the scene as it was
      // before the occlusion, and the top tier drew neither. It gathers from
      // the pass's input buffer, which is all it needs.
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map([
        ["uFocus", new THREE.Uniform(10)],
        ["uRange", new THREE.Uniform(10)],
        ["uRadius", new THREE.Uniform(0)],
      ]),
    });
  }
}

/** How quickly the focus follows a new subject, seconds. */
const FOCUS_S = 0.35;
/** The blur's radius at its most, in pixels of a 900-pixel-high frame, and the camera distances between which it comes in (all of it at the nearer). */
const FOCUS_RADIUS = 6.5;
const FOCUS_NEAR = 5.6;
const FOCUS_FAR = 9;

function Focus({ reducedMotion }: { reducedMotion: boolean }) {
  const effect = useMemo(() => new SoftFocusEffect(), []);
  useEffect(() => () => effect.dispose(), [effect]);
  const st = useMemo(() => ({ init: false, at: new THREE.Vector3(), range: 8, v: new THREE.Vector3() }), []);
  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const page = useGuideStore.getState().page;
    const want = page === "build" && buildFocus.on ? buildFocus.world : stageFocus.target;
    const k = st.init && !reducedMotion ? 1 - Math.exp(-dt / FOCUS_S) : 1;
    st.init = true;
    st.at.lerp(want, k);
    const camera = state.camera;
    const dist = camera.position.distanceTo(st.at);
    // Sharp for a good way either side of the subject: the blur is all there only as far off again as the subject is from the lens.
    st.range += (Math.max(0.8, dist) - st.range) * k;
    const close = 1 - THREE.MathUtils.smoothstep(dist, FOCUS_NEAR, FOCUS_FAR);
    const u = effect.uniforms;
    // The plane of focus, as a depth along the camera's axis.
    u.get("uFocus")!.value = -st.v.copy(st.at).applyMatrix4(camera.matrixWorldInverse).z;
    u.get("uRange")!.value = st.range;
    u.get("uRadius")!.value = FOCUS_RADIUS * close * ((state.size.height * state.viewport.dpr) / 900);
  });
  return <primitive object={effect} dispose={null} />;
}

// ── frame times ─────────────────────────────────────────────────────────────

function Probe() {
  useFrame((_, dt) => {
    const s = useGuideStore.getState();
    // Not while the stage is still loading, a page is on its way in or out, a cut is on, or the device has left for Make.
    measureFrame(dt * 1000, stageLoad.get().ready && s.entered && !s.leaving && !s.cut && s.page !== "make");
  });
  return null;
}

type Props = { narrow: boolean; reducedMotion: boolean; ao: boolean; dof: boolean };

export default memo(function StagePost({ narrow, reducedMotion, ao, dof }: Props) {
  const tier = useTier();
  const q = settingsFor(tier, narrow);
  const effects: JSX.Element[] = [];
  if (q.ao && ao) {
    effects.push(
      <N8AO
        key="ao"
        aoRadius={0.45}
        distanceFalloff={0.8}
        intensity={2.4}
        quality={q.ao}
        halfRes
      />,
    );
  }
  if (q.dof && dof) effects.push(<Focus key="focus" reducedMotion={reducedMotion} />);
  effects.push(
    <Bloom key="bloom" luminanceThreshold={1.15} luminanceSmoothing={0.2} intensity={0.85} radius={0.72} mipmapBlur />,
    <ToneMapping key="tone" mode={ToneMappingMode.ACES_FILMIC} />,
    <Grade key="grade" />,
    <Vignette key="vignette" offset={0.32} darkness={0.55} />,
  );
  // Last, on the finished picture: its edges are what the eye sees.
  if (q.fxaa) effects.push(<FXAA key="fxaa" />);
  return (
    <>
      <Probe />
      <EffectComposer multisampling={q.msaa} enableNormalPass={false}>
        {effects}
      </EffectComposer>
    </>
  );
});
