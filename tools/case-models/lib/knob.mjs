// The official knob, drawn round. hardware/case/knobs/knobs_20mm.stl is the
// knob people print (the BOM names it), and case-v39.glb carries it as
// exported: a 32-sided prism, whose flats and corners show at the size the
// preview draws it. Here its profile — its radius at each height, read from
// the STL — is turned about its axis with enough sides to read as round.
//
// What the STL has, and this keeps: a 20 mm knob that tapers from 16.26 mm
// across at its base to 12.89 mm at its top, a little convex; an open recess
// under it that clears the encoder's nut; and the bore for the shaft. What it
// does not keep: the 16 flutes round the top half, 0.14 mm deep, too fine to
// see here, and the D's flat in the bore, which nothing shows. The top edge
// gets a 0.4 mm round so it catches the light: a choice for the preview, as
// the knob prints standing on its top and that edge comes off the bed sharp.
//
// The knob's frame is the case models' contract (caseModels.ts): the origin
// on its axis at its base, the axis +z, one unit 10 mm.
import fs from 'node:fs';

/** Sides of the turned knob: as round as the eye needs at the preview's sizes. */
const SIDES = 96;
/** The top edge's round, mm. */
const TOP_ROUND = 0.4;
/** Two faces meeting at more than this are an edge; under it, one smooth surface. */
const CREASE_DEG = 35;
const MM = 0.1;

/** A binary STL's vertices, three per triangle, as one flat array of x, y, z. */
function readStl(file) {
  const buf = fs.readFileSync(file);
  const count = buf.readUInt32LE(80);
  if (buf.length !== 84 + count * 50) throw new Error(`${file}: not a binary STL`);
  const out = new Float64Array(count * 9);
  for (let t = 0; t < count; t++) {
    for (let k = 0; k < 9; k++) out[t * 9 + k] = buf.readFloatLE(84 + t * 50 + 12 + k * 4);
  }
  return out;
}

const near = (a, b, tol, what) => {
  if (Math.abs(a - b) > tol) throw new Error(`knob: ${what} is ${a.toFixed(3)}, expected ${b} ± ${tol}`);
};

/**
 * The profile of one knob of the STL, in mm: [r, h] points with h up from the
 * base, as one outline of the solid's section from the axis round to the
 * axis, clockwise with r to the right and h up, so the solid is on the right
 * of each step and its outward normal is the step's left normal: [-dh, dr].
 */
export function knobProfile(stlFile) {
  const v = readStl(stlFile);
  // The file lays four knobs out in a row along y: take the first.
  const ys = [];
  for (let i = 1; i < v.length; i += 3) ys.push(v[i]);
  ys.sort((a, b) => a - b);
  let end = ys[0];
  for (const y of ys) {
    if (y - end > 1) break;
    end = y;
  }
  const pts = [];
  for (let i = 0; i < v.length; i += 3) if (v[i + 1] <= end) pts.push([v[i], v[i + 1], v[i + 2]]);
  const lo = [0, 1, 2].map((k) => Math.min(...pts.map((p) => p[k])));
  const hi = [0, 1, 2].map((k) => Math.max(...pts.map((p) => p[k])));
  const cx = (lo[0] + hi[0]) / 2;
  const cy = (lo[1] + hi[1]) / 2;
  const height = hi[2] - lo[2];

  // Every height the STL has vertices at, with the radii there.
  const levels = new Map();
  for (const [x, y, z] of pts) {
    const key = Math.round((z - lo[2]) * 1000);
    const r = Math.hypot(x - cx, y - cy);
    const l = levels.get(key) ?? { z: key / 1000, min: Infinity, max: -Infinity };
    l.min = Math.min(l.min, r);
    l.max = Math.max(l.max, r);
    levels.set(key, l);
  }
  const byZ = [...levels.values()].sort((a, b) => a.z - b.z);
  // The STL stands the knob on its top (z = 0), the open base up.
  const top = byZ[0];
  const base = byZ[byZ.length - 1];
  const rBase = base.max;
  const h = (z) => height - z;

  // The outside: at each height its largest radius (the flutes' crests).
  const outer = byZ.filter((l) => l.max > 0.75 * rBase).map((l) => [l.max, h(l.z)]);
  // Under it: the recess opens at the base's inner ring and ends at the
  // ceiling, the one height whose largest radius is between the bore's and
  // the outside's; the bore runs up from the ceiling and ends in a cone.
  const recessOpen = base.min;
  const ceiling = byZ.find((l) => l.max > 0.55 * rBase && l.max < 0.75 * rBase);
  const bore = byZ.filter((l) => l.max < 0.45 * rBase);
  const boreR = Math.max(...bore.map((l) => l.max));
  const coneStart = bore.find((l) => Math.abs(l.max - boreR) < 1e-3 && l !== ceiling);
  const boreEnd = bore[0];

  // What the knob is (hardware/case/README.md's knob for the BOM's 20 mm
  // shaft, as measured from this STL when this was written): stop if
  // the file has become something else rather than draw it wrong.
  near(height, 20, 0.05, 'height');
  near(2 * rBase, 16.26, 0.1, 'base diameter');
  near(2 * top.max, 12.89, 0.1, 'top diameter');
  if (!ceiling || !coneStart || outer.length < 4) throw new Error('knob: the STL no longer has the recess, bore and wall this reads');

  // Round, top first: centre of the top, its edge, down the outside to the
  // base, in across the base to the recess, up the recess to its ceiling, in
  // to the bore, up the bore and its cone, and in across the bore's end.
  const outside = outer.slice().sort((a, b) => b[1] - a[1]);
  const outline = [
    [0, height],
    ...outside,
    [recessOpen, 0],
    [ceiling.max, h(ceiling.z)],
    [boreR, h(ceiling.z)],
    [boreR, h(coneStart.z)],
    [boreEnd.max, h(boreEnd.z)],
    [0, h(boreEnd.z)],
  ];
  return roundCorner(outline, 1, TOP_ROUND);
}

/** Replaces outline point i with a circular arc of radius rho tangent to both of its segments. */
function roundCorner(outline, i, rho, steps = 5) {
  const [p, a, b] = [outline[i], outline[i - 1], outline[i + 1]];
  const unit = (q, o) => {
    const d = Math.hypot(q[0] - o[0], q[1] - o[1]);
    return [(q[0] - o[0]) / d, (q[1] - o[1]) / d];
  };
  const u = unit(a, p);
  const w = unit(b, p);
  const turn = Math.acos(u[0] * w[0] + u[1] * w[1]);
  const t = rho / Math.tan(turn / 2);
  const s = [p[0] + u[0] * t, p[1] + u[1] * t];
  const e = [p[0] + w[0] * t, p[1] + w[1] * t];
  const bis = unit([u[0] + w[0], u[1] + w[1]], [0, 0]);
  const dc = rho / Math.sin(turn / 2);
  const c = [p[0] + bis[0] * dc, p[1] + bis[1] * dc];
  const a0 = Math.atan2(s[1] - c[1], s[0] - c[0]);
  let a1 = Math.atan2(e[1] - c[1], e[0] - c[0]);
  while (a1 - a0 > Math.PI) a1 -= 2 * Math.PI;
  while (a1 - a0 < -Math.PI) a1 += 2 * Math.PI;
  const arc = [];
  for (let k = 0; k <= steps; k++) {
    const ang = a0 + ((a1 - a0) * k) / steps;
    arc.push([c[0] + rho * Math.cos(ang), c[1] + rho * Math.sin(ang)]);
  }
  return [...outline.slice(0, i), ...arc, ...outline.slice(i + 1)];
}

/**
 * The knob as a mesh in `doc`, in model units (10 mm), material `material`:
 * the profile turned SIDES times about +z, smooth across every bend under
 * CREASE_DEG and sharp at the rest.
 */
export function knobMesh(doc, stlFile, material) {
  const outline = knobProfile(stlFile);
  const segs = [];
  for (let i = 0; i + 1 < outline.length; i++) {
    const [a, b] = [outline[i], outline[i + 1]];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    segs.push({ a, b, n: [-(b[1] - a[1]) / len, (b[0] - a[0]) / len] });
  }
  // The normal at each end of each segment: its own, or shared with its
  // neighbour where the two meet at less than the crease angle.
  const cosCrease = Math.cos((CREASE_DEG * Math.PI) / 180);
  const blend = (n, m) => {
    if (!m || n[0] * m[0] + n[1] * m[1] < cosCrease) return n;
    const d = Math.hypot(n[0] + m[0], n[1] + m[1]);
    return [(n[0] + m[0]) / d, (n[1] + m[1]) / d];
  };
  segs.forEach((s, i) => {
    s.na = blend(s.n, segs[i - 1]?.n);
    s.nb = blend(s.n, segs[i + 1]?.n);
  });

  const pos = [];
  const nor = [];
  const idx = [];
  const ring = (p, n) => {
    const start = pos.length / 3;
    for (let k = 0; k < SIDES; k++) {
      const phi = (2 * Math.PI * k) / SIDES;
      const [c, s] = [Math.cos(phi), Math.sin(phi)];
      pos.push(p[0] * c * MM, p[0] * s * MM, p[1] * MM);
      nor.push(n[0] * c, n[0] * s, n[1]);
    }
    return start;
  };
  for (const s of segs) {
    const ra = ring(s.a, s.na);
    const rb = ring(s.b, s.nb);
    for (let k = 0; k < SIDES; k++) {
      const k1 = (k + 1) % SIDES;
      // Facing out of the solid (the normal's side), counter-clockwise.
      if (s.a[0] > 0) idx.push(ra + k, rb + k, ra + k1);
      if (s.b[0] > 0) idx.push(ra + k1, rb + k, rb + k1);
    }
  }
  const buffer = doc.getRoot().listBuffers()[0];
  const prim = doc
    .createPrimitive()
    .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(pos)).setBuffer(buffer))
    .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(new Float32Array(nor)).setBuffer(buffer))
    .setIndices(doc.createAccessor().setType('SCALAR').setArray(new Uint32Array(idx)).setBuffer(buffer))
    .setMaterial(material);
  return doc.createMesh('knob').addPrimitive(prim);
}
