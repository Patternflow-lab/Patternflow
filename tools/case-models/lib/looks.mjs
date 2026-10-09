// What every case model's materials look like, by name. The scripts that make
// a shell only name a material; its colour and finish are set here, so the
// three cases sit side by side under one light.
//
// Colours are sRGB hex, as a designer writes them; glTF wants linear factors.
//
//   pla_white     printed case parts (the official case and Besoiobiy's)
//   pla_black     printed knobs
//   sheet_face    laser-cut sheet, its two faces: the plate, the border strips
//                 and the feet of SimonePDA's case. Clear acrylic here, as the
//                 acrylic build is; the page can swap in MDF (caseModels.ts)
//   sheet_edge    the same sheet's cut edges
//   acrylic_face  laser-cut parts that are acrylic in every build (the box
//   acrylic_edge  over the board), faces and cut edges
//
// Any other name is left as the file has it (the board's, the DevKit's, the
// LED panel's).

const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const hex = (h, alpha = 1) => {
  const n = parseInt(h.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => srgbToLinear(v / 255)).concat(alpha);
};

// Clear acrylic: barely tinted, glossy, mostly see-through; its cut edges
// read brighter and a touch green, as a sheet's edges do.
const ACRYLIC_FACE = { color: hex('#f4f8f7', 0.22), roughness: 0.08, blend: true };
const ACRYLIC_EDGE = { color: hex('#d9ece6', 0.6), roughness: 0.25, blend: true };

export const LOOKS = {
  pla_white: { color: hex('#eceae4'), roughness: 0.72 },
  pla_black: { color: hex('#151515'), roughness: 0.55 },
  sheet_face: ACRYLIC_FACE,
  sheet_edge: ACRYLIC_EDGE,
  acrylic_face: ACRYLIC_FACE,
  acrylic_edge: ACRYLIC_EDGE,
};

/** Sets the look of every material in the document whose name is in LOOKS. */
export function applyLooks(doc) {
  for (const m of doc.getRoot().listMaterials()) {
    const look = LOOKS[m.getName()];
    if (!look) continue;
    m.setBaseColorFactor(look.color)
      .setMetallicFactor(0)
      .setRoughnessFactor(look.roughness)
      .setAlphaMode(look.blend ? 'BLEND' : 'OPAQUE')
      .setDoubleSided(Boolean(look.blend));
  }
}
