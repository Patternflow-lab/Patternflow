// Basics pack module slug → the name the panel prints on its SELECT screen.
//
// Read out of the per-module .json files inside public/packs/basics.zip, because
// basics.json itself carries slugs and preset numbers but not the names. The
// guide's simulated panel needs them to show what a real board shows.
// Regenerate after rebuilding the pack; basicsNames.test.ts fails when a slug
// in basics.json has no name here.
export const BASICS_NAMES: Record<string, string> = {
  "wave_saw": "Wave Saw",
  "0510": "0510",
  "0511": "0511",
  "0512": "0512",
  "0513": "0513",
  "0514": "0514",
  "0515": "0515",
  "0515_3": "0515-3",
  "0515_4": "0515-4",
  "0518": "0518",
  "0519_1": "0519-1",
  "0520": "0520",
  "0521": "0521",
  "0522": "0522",
  "0527": "0527",
  "0528": "0528",
  "0531": "0531",
  "0601": "0601",
  "0602": "0602",
  "retro_digital_tapestry": "Retro Digital Tapestry",
  "chromatic_vortex": "Chromatic Vortex",
  "vector_field_flow": "Vector Field Flow",
  "lissajous_weave": "Lissajous Weave",
  "untitled_pattern": "Untitled pattern",
  "tilewaves": "TileWaves",
  "midsummer_sea": "Midsummer Sea",
  "breakout_arcade": "Breakout Arcade",
  "firefly_hollow": "Firefly Hollow",
  "poincar_sphere": "Poincaré Sphere",
  "tri_march": "Tri March",
  "warped_wave": "Warped Wave",
  "magvortex": "MagVortex",
  "a_big_hit": "a big hit",
};
