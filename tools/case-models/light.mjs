// Makes each case's light model from its full one, for the /build page's shelf.
//
//   node light.mjs                 every case in web/public/cases/
//   node light.mjs <case-id> ...   those cases
//
// The full model (model.glb, assemble.mjs) is every part of a case as its own
// node, with the board and the DevKit inside: about 105,000 triangles, 320 to
// 560 KB, Draco compressed, so the page waits for it and for the decoder. The
// preview takes it apart, part by part.
//
// The light model (light.glb) is the same device standing assembled and
// nothing else. The page shows all five on a shelf the moment the Build tab
// opens, and each stands in for its full model until that has arrived. What
// goes:
//   - the parts nobody sees while the case is closed (CASES below): the board
//     and the DevKit, a case's inner braces and wiring, the loose feet;
//   - most of the triangles of what stays: a part keeps at most BUDGET of
//     them (meshoptimizer), and what only shows through clear acrylic is cut
//     down further, without regard for its shape's fine detail;
//   - the normals: the page works them out again from the faces (HeroScene's
//     light models, toCreasedNormals), so vertices weld on position alone;
//   - the parts as separate things: everything is baked into one node,
//     `body`, one primitive per material.
// What stays as it is: the lit face of the LED panel, `l`, with its UVs (the
// pattern is drawn on it), the material names (the page swaps a case's finish
// by name) and the model frame, so a light model stands exactly where its
// full one does. The full model's box is written into the scene's extras for
// that, since the light one's own box no longer has the dropped parts in it.
//
// Written with EXT_meshopt_compression, not Draco: three's loader has that
// decoder built in, so nothing else is fetched before a light model draws.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Document } from '@gltf-transform/core';
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, quantize } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import { getIO, worldBounds, fmt } from './lib/io.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CASES_DIR = path.resolve(HERE, '../../web/public/cases');

/** The LED panel's node. Its lit face is kept whole; the rest of it is `inside`. */
const LED = 'l';
/** A triangle of the panel faces the reader when its normal's z is past this. */
const LED_FACING = 0.5;

/**
 * The most triangles a top-level node keeps, by what it is. A knob is a
 * cylinder two millimetres across on the shelf; a shell part keeps its holes
 * and its edges; what is inside only has to be there.
 */
const BUDGET = { knob: 96, shell: 900, inside: 260 };
/** How far a surface may move, as a share of the part's size (meshoptimizer's error). */
const ERROR = { knob: 0.05, shell: 0.01, inside: 0.2 };
/** Vertices closer than this are one vertex: a tenth of a millimetre (a unit is 10 mm). */
const WELD = 1e-3;

/**
 * What each case leaves out, by top-level node (a trailing * matches the rest
 * of a name), and what it keeps coarse because it only shows through
 * something: `inside`.
 */
const CASES = {
  official: { drop: ['pcb_v39', 'devkit'] },
  'besoiobiy-printed': { drop: ['pcb_v39', 'devkit'] },
  // Clear acrylic: the board and the DevKit show through it, so they stay,
  // coarse. The three feet are for laying it flat and are not on it.
  'simonepda-lasercut': { drop: ['foot_*'], inside: ['pcb_v39', 'devkit'] },
  // The joint bars and the USB retainer are behind the rear covers.
  'mbchars-horizontal-desktop-printed': { drop: ['pcb_v39', 'devkit', 'joint_bar_*', 'usb_retainer'] },
  // A closed birch box: the braces, rails, doublers, trays and everything
  // wired inside are behind the bezel, the walls and the back cover.
  'jof-patternflood': {
    drop: [
      'brace_*', 'rail_*', 'back_doubler', 'shelf', 'doubler_*', 'knob_rib_*', 'tray_*', 'bezel_inner',
      'colorlight', 'pi5', 'encoders', 'psu', 'power_bus', 'panel_connectors', 'wiring',
    ],
  },
};

const matches = (name, patterns = []) =>
  patterns.some((p) => (p.endsWith('*') ? name.startsWith(p.slice(0, -1)) : name === p));

/** p' = M p, for a column-major 4x4. */
function point(m, v) {
  return [
    m[0] * v[0] + m[4] * v[1] + m[8] * v[2] + m[12],
    m[1] * v[0] + m[5] * v[1] + m[9] * v[2] + m[13],
    m[2] * v[0] + m[6] * v[1] + m[10] * v[2] + m[14],
  ];
}

/** Triangles in the model's frame: positions, with or without UVs. */
class Soup {
  positions = [];
  uvs = [];
  indices = [];

  get triangles() {
    return this.indices.length / 3;
  }

  /** Adds another soup's triangles after this one's. */
  append(other) {
    const base = this.positions.length / 3;
    for (const p of other.positions) this.positions.push(p);
    for (const t of other.uvs) this.uvs.push(t);
    for (const i of other.indices) this.indices.push(base + i);
  }

  /** One vertex where several share a place. Only for soups without UVs. */
  weld() {
    const seen = new Map();
    const positions = [];
    const remap = new Uint32Array(this.positions.length / 3);
    for (let i = 0; i < remap.length; i += 1) {
      const [x, y, z] = this.positions.slice(i * 3, i * 3 + 3);
      const key = `${Math.round(x / WELD)},${Math.round(y / WELD)},${Math.round(z / WELD)}`;
      let at = seen.get(key);
      if (at === undefined) {
        at = positions.length / 3;
        seen.set(key, at);
        positions.push(x, y, z);
      }
      remap[i] = at;
    }
    const indices = [];
    for (let i = 0; i < this.indices.length; i += 3) {
      const [a, b, c] = [remap[this.indices[i]], remap[this.indices[i + 1]], remap[this.indices[i + 2]]];
      if (a !== b && b !== c && a !== c) indices.push(a, b, c);
    }
    this.positions = positions;
    this.indices = indices;
  }

  /** Down to `target` triangles: by collapsing edges, or `sloppy`, by merging whatever is near. */
  simplify(target, error, sloppy) {
    if (this.triangles <= target) return;
    const indices = new Uint32Array(this.indices);
    const positions = new Float32Array(this.positions);
    const [next] = sloppy
      ? MeshoptSimplifier.simplifySloppy(indices, positions, 3, null, target * 3, error)
      : MeshoptSimplifier.simplify(indices, positions, 3, target * 3, error, ['Prune']);
    this.indices = Array.from(next);
    this.compact();
  }

  /** Drops the vertices no triangle uses. */
  compact() {
    const remap = new Map();
    const positions = [];
    const uvs = [];
    const hasUv = this.uvs.length > 0;
    this.indices = this.indices.map((i) => {
      let at = remap.get(i);
      if (at === undefined) {
        at = positions.length / 3;
        remap.set(i, at);
        positions.push(this.positions[i * 3], this.positions[i * 3 + 1], this.positions[i * 3 + 2]);
        if (hasUv) uvs.push(this.uvs[i * 2], this.uvs[i * 2 + 1]);
      }
      return at;
    });
    this.positions = positions;
    this.uvs = uvs;
  }

  primitive(doc, buffer, material) {
    const count = this.positions.length / 3;
    const accessor = (type, array) => doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);
    const prim = doc
      .createPrimitive()
      .setMaterial(material)
      .setAttribute('POSITION', accessor('VEC3', new Float32Array(this.positions)))
      .setIndices(accessor('SCALAR', count > 65535 ? new Uint32Array(this.indices) : new Uint16Array(this.indices)));
    if (this.uvs.length) prim.setAttribute('TEXCOORD_0', accessor('VEC2', new Float32Array(this.uvs)));
    return prim;
  }
}

/** A top-level node's triangles, by material name, in the model's frame. `uv` keeps TEXCOORD_0. */
function gather(node, uv) {
  const soups = new Map();
  const materials = new Map();
  node.traverse((n) => {
    const mesh = n.getMesh();
    if (!mesh) return;
    const matrix = n.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      const name = prim.getMaterial()?.getName() ?? 'none';
      materials.set(name, prim.getMaterial());
      if (!soups.has(name)) soups.set(name, new Soup());
      const soup = soups.get(name);
      const position = prim.getAttribute('POSITION');
      const texcoord = uv ? prim.getAttribute('TEXCOORD_0') : null;
      const base = soup.positions.length / 3;
      const v = [0, 0, 0];
      const t = [0, 0];
      for (let i = 0; i < position.getCount(); i += 1) {
        soup.positions.push(...point(matrix, position.getElement(i, v)));
        if (uv) soup.uvs.push(...(texcoord ? texcoord.getElement(i, t) : [0, 0]));
      }
      const index = prim.getIndices();
      const count = index ? index.getCount() : position.getCount();
      for (let i = 0; i < count; i += 1) soup.indices.push(base + (index ? index.getScalar(i) : i));
    }
  });
  return { soups, materials };
}

/** Splits the LED panel's triangles into the lit face (normal towards +z) and the rest. */
function litFace(soup) {
  const face = new Soup();
  const rest = new Soup();
  face.positions = soup.positions;
  face.uvs = soup.uvs;
  rest.positions = soup.positions;
  for (let i = 0; i < soup.indices.length; i += 3) {
    const [a, b, c] = [soup.indices[i], soup.indices[i + 1], soup.indices[i + 2]];
    const p = (k) => soup.positions.slice(k * 3, k * 3 + 3);
    const [pa, pb, pc] = [p(a), p(b), p(c)];
    const u = [pb[0] - pa[0], pb[1] - pa[1], pb[2] - pa[2]];
    const w = [pc[0] - pa[0], pc[1] - pa[1], pc[2] - pa[2]];
    const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const length = Math.hypot(...n) || 1;
    (n[2] / length > LED_FACING ? face : rest).indices.push(a, b, c);
  }
  face.compact();
  rest.compact();
  return { face, rest };
}

async function lighten(id) {
  const io = (await getIO()).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  const rules = CASES[id];
  if (!rules) throw new Error(`light.mjs has no rules for ${id}: add it to CASES`);
  const source = await io.read(path.join(CASES_DIR, id, 'model.glb'));
  const scene = source.getRoot().listScenes()[0];
  await Promise.all([MeshoptSimplifier.ready, MeshoptEncoder.ready, MeshoptDecoder.ready]);

  // The full device's box, every node of it: where the page centres a case.
  const box = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
  for (const node of scene.listChildren()) {
    const b = worldBounds(node);
    for (let k = 0; k < 3; k += 1) {
      box.min[k] = Math.min(box.min[k], b.min[k]);
      box.max[k] = Math.max(box.max[k], b.max[k]);
    }
  }

  const out = new Document();
  const buffer = out.createBuffer();
  const materials = new Map();
  const materialFor = (name, from) => {
    if (!materials.has(name)) {
      const to = out.createMaterial(name);
      if (from) {
        to.setBaseColorFactor(from.getBaseColorFactor())
          .setRoughnessFactor(from.getRoughnessFactor())
          .setMetallicFactor(from.getMetallicFactor())
          .setEmissiveFactor(from.getEmissiveFactor())
          .setAlphaMode(from.getAlphaMode())
          .setAlpha(from.getAlpha())
          .setDoubleSided(from.getDoubleSided());
      }
      materials.set(name, to);
    }
    return materials.get(name);
  };

  const body = new Map();   // material name → Soup
  const led = new Map();
  let before = 0;
  const dropped = [];

  /** Welds and cuts a node's soups to its budget, shared by size, and adds them to the body. */
  const keep = (soups, kind) => {
    let total = 0;
    for (const soup of soups.values()) {
      soup.weld();
      total += soup.triangles;
    }
    for (const [name, soup] of soups) {
      if (!soup.triangles) continue;
      const target = Math.max(4, Math.round((BUDGET[kind] * soup.triangles) / Math.max(1, total)));
      soup.simplify(target, ERROR[kind], kind === 'inside');
      if (!soup.triangles) continue;
      if (!body.has(name)) body.set(name, new Soup());
      body.get(name).append(soup);
    }
  };

  for (const node of scene.listChildren()) {
    const name = node.getName();
    const isLed = name === LED;
    const { soups, materials: used } = gather(node, isLed);
    for (const soup of soups.values()) before += soup.triangles;
    if (matches(name, rules.drop)) {
      dropped.push(name);
      continue;
    }
    for (const [key, from] of used) materialFor(key, from);

    if (isLed) {
      // The lit face as it is; the panel's back and sides as something inside.
      const behind = new Map();
      for (const [key, soup] of soups) {
        const { face, rest } = litFace(soup);
        if (face.triangles) {
          if (!led.has(key)) led.set(key, new Soup());
          led.get(key).append(face);
        }
        if (rest.triangles) behind.set(key, rest);
      }
      keep(behind, 'inside');
      continue;
    }
    keep(soups, /^c[1-4]$/.test(name) ? 'knob' : matches(name, rules.inside) ? 'inside' : 'shell');
  }

  const outScene = out.createScene(id).setExtras({ box: { min: fmt(box.min), max: fmt(box.max) } });
  let kept = 0;
  const build = (name, soups) => {
    // The mesh has no name of its own: three's loader keeps names unique, and
    // a mesh called `l` would take the name before its node could.
    const mesh = out.createMesh();
    for (const [key, soup] of soups) {
      if (!soup.triangles) continue;
      kept += soup.triangles;
      mesh.addPrimitive(soup.primitive(out, buffer, materials.get(key)));
    }
    if (mesh.listPrimitives().length) outScene.addChild(out.createNode(name).setMesh(mesh));
  };
  build(LED, led);
  build('body', body);

  out.createExtension(KHRMeshQuantization).setRequired(true);
  out.createExtension(EXTMeshoptCompression).setRequired(true);
  await out.transform(
    prune(),
    dedup(),
    // 14 bits of position is 0.02 mm on these models. The panel's UVs are the
    // LED grid, 128 across: 12 bits puts a texel within 1/32 of an LED.
    quantize({ quantizePosition: 14, quantizeTexcoord: 12 }),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  );

  const file = path.join(CASES_DIR, id, 'light.glb');
  await io.write(file, out);
  const size = fs.statSync(file).size;
  const full = fs.statSync(path.join(CASES_DIR, id, 'model.glb')).size;
  console.log(
    `${id}: ${Math.round(before).toLocaleString('en')} → ${Math.round(kept).toLocaleString('en')} triangles, ` +
      `${(full / 1024).toFixed(0)} KB → ${(size / 1024).toFixed(1)} KB` +
      `, ${outScene.listChildren().map((n) => n.getName()).join(' + ')}` +
      `, left out: ${dropped.length} nodes`,
  );
}

const asked = process.argv.slice(2);
const ids = asked.length
  ? asked
  : fs.readdirSync(CASES_DIR).filter((name) => fs.existsSync(path.join(CASES_DIR, name, 'model.glb'))).sort();
for (const id of ids) await lighten(id);
