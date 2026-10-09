'use client';

import { Effect } from 'postprocessing';
import { useEffect, useMemo } from 'react';

// The preview's canvas is see-through: the page is behind the device, and
// whatever only partly covers a pixel — the clear acrylic of a laser-cut
// case, a soft shadow, the antialiased edge of anything — lets it through.
//
// What reaches the composer is premultiplied colour (three blends that way),
// and its last pass sRGB-encodes the colour as it stands. For a pixel that is
// half covered that is far too bright — the encoding is a curve, and a
// premultiplied value sits low on it — so the page composites a clear sheet
// as a frosted white one, however clear the sheet is drawn. These two put the
// tone curve (and neutralToe.tsx before it) between them, in order:
//
//   StraightAlpha   each pixel's own colour, for the tone curve to work on
//   PageAlpha       premultiplied again, so that once the last pass has
//                   encoded it, it is what the page should composite: the
//                   encoded colour times its coverage
//
// A pixel with next to no coverage is left alone in both: there is no colour
// of its own to speak of, only light added over the page (the bloom's glow,
// which comes after them).

const EPS = '0.002';

const straightFrag = /* glsl */ `
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  float a = inputColor.a;
  outputColor = a > ${EPS} && a < 1.0 ? vec4(inputColor.rgb / a, a) : inputColor;
}
`;

const pageFrag = /* glsl */ `
vec3 pageEncode(vec3 c) {
  c = clamp(c, 0.0, 1.0);
  return mix(1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, c * 12.92, vec3(lessThanEqual(c, vec3(0.0031308))));
}
vec3 pageDecode(vec3 c) {
  return mix(pow((c + 0.055) / 1.055, vec3(2.4)), c / 12.92, vec3(lessThanEqual(c, vec3(0.04045))));
}
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
  float a = inputColor.a;
  outputColor = a > ${EPS} && a < 1.0 ? vec4(pageDecode(pageEncode(inputColor.rgb) * a), a) : inputColor;
}
`;

class StraightAlphaEffect extends Effect {
  constructor() {
    super('StraightAlphaEffect', straightFrag);
  }
}

class PageAlphaEffect extends Effect {
  constructor() {
    super('PageAlphaEffect', pageFrag);
  }
}

/** Before the tone curve: each pixel's own colour, not its colour times its coverage. */
export function StraightAlpha() {
  const effect = useMemo(() => new StraightAlphaEffect(), []);
  useEffect(() => () => effect.dispose(), [effect]);
  return <primitive object={effect} dispose={null} />;
}

/** After the tone curve: premultiplied again, as the page composites an sRGB canvas. */
export function PageAlpha() {
  const effect = useMemo(() => new PageAlphaEffect(), []);
  useEffect(() => () => effect.dispose(), [effect]);
  return <primitive object={effect} dispose={null} />;
}
