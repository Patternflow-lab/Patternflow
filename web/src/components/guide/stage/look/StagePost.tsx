"use client";

/* eslint-disable react-hooks/immutability --
   The effects are imperative postprocessing objects driven from the frame
   loop; that is their API and it never feeds back into React. */

import { useFrame, useThree } from "@react-three/fiber";
import { EffectComposer, N8AO, ToneMapping, Vignette } from "@react-three/postprocessing";
import { BlendFunction, BloomEffect, Effect, EffectAttribute, FXAAEffect, ToneMappingMode, type EffectComposer as Composer } from "postprocessing";
import { memo, useEffect, useMemo, useRef, type JSX, type RefObject } from "react";
import * as THREE from "three";
import { useGuideStore } from "../../store";
import { stageLoad } from "../../ui/stageLoad";
import { buildFocus } from "../build/focus";
import { stageFocus } from "./focus";
import { measureFrame, settingsFor, useTier } from "./quality";
import { stageSignature, takeWake, watchForRest } from "./rest";

// What the lens and the film do to the frame, in order:
//
//   occlusion   where surfaces meet, the room's light does not reach (N8AO)
//   focus       a shallow depth of field on what the step is about; the rest
//               of the stage falls a little soft, more the closer the camera is
//   bloom       only what is brighter than white glows: LEDs past their knee,
//               the live rings. The white case, however well lit, stays under
//               the threshold — it used to bloom the screen white. "Brighter
//               than white" is judged by luminance for what is white and by
//               its strongest channel for what is coloured (see the glow,
//               below): a blue LED at full power is as much a light as a
//               white one.
//   tone curve  ACES
//   grade       a film's: shadows a touch cool, highlights a touch warm, a
//               gentle shoulder and toe, a little more colour
//   vignette
//
//   edges       at the lowest tier, where there is no multisampling, an edge
//               filter over the finished picture — in a pass of its own
//
// Which of these a machine gets is its tier (quality.ts), measured from its
// own frame times. The composer is rebuilt only when the tier changes.
//
// And none of it is done for a frame that would be the picture already on
// the screen: the stage is drawn when it has changed (Draw, at the foot).

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
    // On a texel's centre: between two, the filter hands back half of each
    // texel's colour with only one's depth, and half of an in-focus edge then
    // counted as background — a faint second outline, a blur's radius out
    // from every sharp silhouette.
    vec2 at = (floor((uv + vec2(cos(a), sin(a)) * (ring * r) * texelSize) * resolution) + 0.5) * texelSize;
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
  // The focus is no part of the scene: the stage is drawn for as long as it racks (rest.ts).
  useEffect(() => {
    const watches = ["uFocus", "uRange", "uRadius"].map((name) => watchForRest(() => effect.uniforms.get(name)!.value as number));
    return () => watches.forEach((forget) => forget());
  }, [effect]);
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

// ── the glow ────────────────────────────────────────────────────────────────
//
// postprocessing's bloom takes what is over a luminance threshold. Luminance
// is the eye's weighing of white light, and by it a blue LED at full power is
// a ninth as bright as a white one, a red one a fifth: only the whites of a
// pattern ever glowed, and a pattern in full colour, seen from across the
// room, sat on the case like a printed card. A light is a light whatever its
// colour. So what is coloured is judged by its strongest channel instead, and
// what is white, grey or pale — the case, a highlight on a screw — still by
// its luminance, exactly as before: nothing white blooms that did not.

const GLOW_METRIC = /* glsl */ `float glowMax=max(texel.r,max(texel.g,texel.b));float glowMin=min(texel.r,min(texel.g,texel.b));float l=mix(luminance(texel.rgb),glowMax,smoothstep(0.3,0.75,(glowMax-glowMin)/max(glowMax,1e-4)));`;

function Glow() {
  const effect = useMemo(() => {
    const bloom = new BloomEffect({
      blendFunction: BlendFunction.ADD,
      luminanceThreshold: 1.15,
      luminanceSmoothing: 0.2,
      // Halved from 0.85 (the maker: the glow was too strong).
      intensity: 0.42,
      radius: 0.72,
      mipmapBlur: true,
    });
    const m = bloom.luminanceMaterial;
    const before = m.fragmentShader;
    m.fragmentShader = before.replace("float l=luminance(texel.rgb);", GLOW_METRIC);
    // The library's shader was not what this was written against: its own bloom, then, as it was.
    if (m.fragmentShader === before && process.env.NODE_ENV !== "production") console.warn("[guide] bloom: luminance shader not patched");
    m.needsUpdate = true;
    return bloom;
  }, []);
  useEffect(() => () => effect.dispose(), [effect]);
  return <primitive object={effect} dispose={null} />;
}

// ── the edge filter ─────────────────────────────────────────────────────────
//
// FXAA reads its neighbours from the pass's *input*. Merged into the pass
// that also blooms, tone-maps and grades, that input is the raw scene: every
// pixel it took for an edge — and against a tone-mapped centre, anything
// bright is one — was put back as it was before all of those. Lit LEDs came
// out flat white with a dark rim, and the case speckled. Declared a
// convolution it gets a pass of its own, after the rest, and filters the
// finished picture. (Only without multisampling: a second pass under
// multisampling is the resolve that fails — see the focus, above.)

class EdgeFilterEffect extends FXAAEffect {
  constructor() {
    super();
    this.setAttributes(this.getAttributes() | EffectAttribute.CONVOLUTION);
  }
}

function EdgeFilter() {
  const effect = useMemo(() => new EdgeFilterEffect(), []);
  useEffect(() => () => effect.dispose(), [effect]);
  return <primitive object={effect} dispose={null} />;
}

// ── drawing, and frame times ────────────────────────────────────────────────
//
// The composer does not draw itself (it is handed `enabled={false}`): this
// does, last in the frame, and only a frame that differs from the one on the
// screen (rest.ts). A frame is due when a part of the stage said so, when the
// canvas or the composer changed, or when the scene's signature has moved.
// Then it is drawn for TAIL frames more, for what follows a change a frame
// late: the focus reads the matrix the camera was drawn with. And once a
// second whatever happens, so a change the signature has no way to see is
// never on screen late by more than that.
//
// The frame times are measured here too, and only across two drawn frames
// in a row: a frame after a skipped one says nothing of what drawing costs.

/** Unchanged, the stage is still drawn this often, ms. */
const HEARTBEAT_MS = 1000;
/** Frames drawn after the last change. */
const TAIL = 2;

type DrawStats = { frames: number; drawn: number; readMs: number };

function Draw({ composer }: { composer: RefObject<Composer | null> }) {
  const gl = useThree((s) => s.gl);
  const st = useRef({ sig: NaN, at: 0, tail: 0, drew: false, w: -1, h: -1, ratio: -1, composer: null as Composer | null, passes: -1 });
  const size = useMemo(() => new THREE.Vector2(), []);

  // A context the GPU took away and gave back is empty: it is drawn at once.
  useEffect(() => {
    const canvas = gl.domElement;
    const again = () => {
      st.current.at = 0;
    };
    canvas.addEventListener("webglcontextrestored", again);
    return () => canvas.removeEventListener("webglcontextrestored", again);
  }, [gl]);

  // In development, for finding what will not let the stage rest: each object
  // the signature reads, with the number so far (window.__pfRestProbe()).
  // Called on two frames, the first line that differs names what moved.
  const get = useThree((s) => s.get);
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const none = new THREE.Object3D();
    none.visible = false;
    (window as unknown as { __pfRestProbe?: () => [string, number][] }).__pfRestProbe = () => {
      const { scene, camera } = get();
      const list: [string, number][] = [["camera and watched", stageSignature(none, camera)]];
      stageSignature(scene, camera, (o, soFar) => list.push([o.name || o.type, soFar]));
      return list;
    };
  }, [get]);

  useFrame((state, dt) => {
    const c = composer.current;
    if (!c) return;
    const s = st.current;
    const renderer = state.gl;
    let due = takeWake();
    // The composer's buffers follow the canvas (the library sizes them in the frame it draws, and that is this one now).
    renderer.getSize(size);
    const ratio = renderer.getPixelRatio();
    if (size.x !== s.w || size.y !== s.h || ratio !== s.ratio) {
      c.setSize(size.x, size.y);
      s.w = size.x;
      s.h = size.y;
      s.ratio = ratio;
      due = true;
    }
    // A new composer (the tier changed), or one whose effects have just gone in.
    if (c !== s.composer || c.passes.length !== s.passes) {
      s.composer = c;
      s.passes = c.passes.length;
      due = true;
    }
    const now = performance.now();
    if (due) {
      // The scene was not read: the next still frame has nothing to be the same as.
      s.sig = NaN;
    } else {
      const sig = stageSignature(state.scene, state.camera);
      due = sig !== s.sig;
      s.sig = sig;
      if (process.env.NODE_ENV !== "production") stats().readMs += performance.now() - now;
    }
    if (due) s.tail = TAIL;
    else if (s.tail > 0) {
      s.tail--;
      due = true;
    } else if (now - s.at >= HEARTBEAT_MS) due = true;

    // Frame times: not while the stage is still loading, a page is on its way in or out, a cut is on, or the device has left for Make.
    const g = useGuideStore.getState();
    const settled = stageLoad.get().ready && g.entered && !g.leaving && !g.cut && g.page !== "make";
    if (!settled) measureFrame(dt * 1000, false);
    else if (due && s.drew) measureFrame(dt * 1000, true);
    s.drew = due;
    if (process.env.NODE_ENV !== "production") {
      const n = stats();
      n.frames++;
      if (due) n.drawn++;
    }
    if (!due) return;
    s.at = now;
    const auto = renderer.autoClear;
    renderer.autoClear = true;
    c.render(dt);
    renderer.autoClear = auto;
  }, 1);
  return null;
}

/** In development, for measuring: frames run, frames drawn, and the time spent reading the scene (window.__pfRest). */
function stats(): DrawStats {
  const w = window as unknown as { __pfRest?: DrawStats };
  return (w.__pfRest ??= { frames: 0, drawn: 0, readMs: 0 });
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
    <Glow key="bloom" />,
    <ToneMapping key="tone" mode={ToneMappingMode.ACES_FILMIC} />,
    <Grade key="grade" />,
    <Vignette key="vignette" offset={0.32} darkness={0.55} />,
  );
  // Last, on the finished picture: its edges are what the eye sees.
  if (q.fxaa && !q.msaa) effects.push(<EdgeFilter key="fxaa" />);
  const composer = useRef<Composer | null>(null);
  return (
    <>
      <Draw composer={composer} />
      <EffectComposer ref={composer} enabled={false} multisampling={q.msaa} enableNormalPass={false}>
        {effects}
      </EffectComposer>
    </>
  );
});
