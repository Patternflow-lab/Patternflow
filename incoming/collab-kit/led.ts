/**
 * The panel's colour, shared by kit.ts (pictures) and play.ts (the sheet's
 * live tiles). Copied from the study's look.ts: PF_POST_PIXEL raises
 * saturation by 1.62 around Rec. 601 luma, then each channel goes through the
 * CIE1931 table to a rounded 8-bit PWM step, shown back on a screen as the
 * lightness that step gives. The browser preview does neither, so the dark end
 * of a frame looks different on the panel.
 */
const cie = (v: number) => {
  const l = (v / 255) * 100;
  return l <= 8 ? l / 903.3 : ((l + 16) / 116) ** 3;
};
const lightness = (y: number) => ((y <= 0.008856 ? 903.3 * y : 116 * Math.cbrt(y) - 16) / 100) * 255;
const STEP = Array.from({ length: 256 }, (_, v) => lightness(Math.min(255, Math.round((cie(v) * 65535) / 256)) / 255));

export function panel(r: number, g: number, b: number): [number, number, number] {
  const y = (r * 77 + g * 150 + b * 29) >> 8;
  const boost = (c: number) => Math.max(0, Math.min(255, y + Math.floor(((c - y) * 415) / 256)));
  return [STEP[boost(r)], STEP[boost(g)], STEP[boost(b)]];
}
