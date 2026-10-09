'use client';

import { Effect } from 'postprocessing';
import { useEffect, useMemo } from 'react';

// three's Neutral tone curve (Khronos PBR Neutral, NeutralToneMapping) does
// two things. Below its knee it takes an offset off every channel: 0.04, or,
// where a colour's smallest channel x is under 0.08, x − 6.25x², its toe —
// meant to take off the 4% a glossy surface reflects, so a base colour shows
// as authored. From the knee up it rolls the peak off toward white, the
// channels together. The preview wants only the second: here the toe crushed
// the dark things to black and saturated them — the knobs to 1/255, the
// panel's dim LEDs, MDF's burnt edges to orange.
//
// NeutralToeBack, just before the curve, adds back exactly what the toe will
// take, so below the knee the frame is as it was lit, and the curve only
// rolls off what is brighter. On each pixel's own colour (StraightAlpha).

const toeBackFrag = /* glsl */ `
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  vec3 c = max(inputColor.rgb, 0.0);
  float x = min(c.r, min(c.g, c.b));
  // The smallest channel that the toe takes back down to x.
  float lifted = x < 0.04 ? 0.4 * sqrt(x) : x + 0.04;
  outputColor = vec4(c + (lifted - x), inputColor.a);
}
`;

class NeutralToeBackEffect extends Effect {
  constructor() {
    super('NeutralToeBackEffect', toeBackFrag);
  }
}

/** Before the Neutral tone curve: what its toe takes off, added back. */
export function NeutralToeBack() {
  const effect = useMemo(() => new NeutralToeBackEffect(), []);
  useEffect(() => () => effect.dispose(), [effect]);
  return <primitive object={effect} dispose={null} />;
}
