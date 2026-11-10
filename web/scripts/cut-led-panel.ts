/**
 * Cuts the LED panel out of the official case model for the guide:
 * public/cases/official/model.glb → public/guide/led-panel.glb.
 *
 *   npx tsx scripts/cut-led-panel.ts      (inside web/)
 *
 * The guide's stage takes one mesh of that file, the LED panel "l" (its case,
 * board and DevKit are files of the guide's own, stage/parts.ts). The file is
 * 317 KB and the panel is 10 KB of it, so a phone opening the Build guide on
 * a slow connection spent a second and a half on a board and a DevKit it
 * never drew. The cut keeps the node as the file has it, its place, its mesh
 * and its material, byte for byte, and nothing else.
 *
 * Run it again whenever tools/case-models writes model.glb anew.
 * stage/ledPanel.test.ts cuts the file in memory and fails while the copy in
 * public/guide is not what this writes.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const WEB = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const SOURCE = path.join(WEB, "public/cases/official/model.glb");
export const TARGET = path.join(WEB, "public/guide/led-panel.glb");
export const NODE = "l";

type Json = Record<string, unknown> & {
  nodes: { name?: string; mesh?: number; children?: number[] }[];
  meshes: { primitives: Primitive[] }[];
  accessors: { bufferView?: number }[];
  bufferViews: { buffer: number; byteOffset?: number; byteLength: number }[];
  materials?: Record<string, unknown>[];
};
type Primitive = {
  attributes: Record<string, number>;
  indices?: number;
  material?: number;
  extensions?: { KHR_draco_mesh_compression?: { bufferView: number } };
};

const pad4 = (n: number) => (n + 3) & ~3;

function chunks(glb: Uint8Array): { json: Json; bin: Uint8Array } {
  const view = new DataView(glb.buffer, glb.byteOffset, glb.byteLength);
  if (view.getUint32(0, true) !== 0x46546c67) throw new Error("not a GLB");
  const jsonLength = view.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(glb.subarray(20, 20 + jsonLength))) as Json;
  const binAt = 20 + jsonLength;
  const binLength = view.getUint32(binAt, true);
  return { json, bin: glb.subarray(binAt + 8, binAt + 8 + binLength) };
}

/** The GLB holding one root node of `glb`, by name: its mesh, accessors, material and the bytes they use. */
export function cutNode(glb: Uint8Array, name: string, generator: string): Uint8Array {
  const { json, bin } = chunks(glb);
  const node = json.nodes.find((n) => n.name === name);
  if (!node || node.mesh === undefined) throw new Error(`no mesh node "${name}"`);
  if (node.children?.length) throw new Error(`"${name}" has children; this cuts a single mesh`);

  const views: number[] = [];
  const view = (i: number) => (views.includes(i) ? views.indexOf(i) : views.push(i) - 1);
  const accessors: Json["accessors"] = [];
  const accessor = (i: number) => {
    const a = { ...json.accessors[i] };
    if (a.bufferView !== undefined) a.bufferView = view(a.bufferView);
    return accessors.push(a) - 1;
  };
  const materials: Record<string, unknown>[] = [];
  const material = (i: number) => {
    const m = json.materials![i];
    if (JSON.stringify(m).includes('"index"')) throw new Error(`material ${i} has textures; this cuts none`);
    return materials.push(m) - 1;
  };
  const mesh = {
    ...json.meshes[node.mesh],
    primitives: json.meshes[node.mesh].primitives.map((p) => {
      const out: Primitive = { ...p, attributes: Object.fromEntries(Object.entries(p.attributes).map(([k, a]) => [k, accessor(a)])) };
      if (p.indices !== undefined) out.indices = accessor(p.indices);
      if (p.material !== undefined) out.material = material(p.material);
      const draco = p.extensions?.KHR_draco_mesh_compression;
      if (draco) out.extensions = { ...p.extensions, KHR_draco_mesh_compression: { ...draco, bufferView: view(draco.bufferView) } };
      return out;
    }),
  };

  // The bytes: each view that is kept, in the order first used, on a 4-byte boundary.
  const bufferViews: Json["bufferViews"] = [];
  let length = 0;
  for (const i of views) {
    const v = json.bufferViews[i];
    bufferViews.push({ ...v, buffer: 0, byteOffset: length });
    length = pad4(length + v.byteLength);
  }
  const outBin = new Uint8Array(length);
  views.forEach((i, k) => {
    const v = json.bufferViews[i];
    const at = v.byteOffset ?? 0;
    outBin.set(bin.subarray(at, at + v.byteLength), bufferViews[k].byteOffset);
  });

  const out: Record<string, unknown> = {
    asset: { ...(json.asset as object), generator },
    ...(json.extensionsUsed ? { extensionsUsed: json.extensionsUsed } : {}),
    ...(json.extensionsRequired ? { extensionsRequired: json.extensionsRequired } : {}),
    scene: 0,
    scenes: [{ name: "Scene", nodes: [0] }],
    nodes: [{ ...node, mesh: 0 }],
    meshes: [mesh],
    accessors,
    ...(materials.length ? { materials } : {}),
    bufferViews,
    buffers: [{ byteLength: length }],
  };
  const text = new TextEncoder().encode(JSON.stringify(out));
  const jsonLength = pad4(text.length);
  const total = 12 + 8 + jsonLength + 8 + length;
  const glbOut = new Uint8Array(total);
  const dv = new DataView(glbOut.buffer);
  dv.setUint32(0, 0x46546c67, true);
  dv.setUint32(4, 2, true);
  dv.setUint32(8, total, true);
  dv.setUint32(12, jsonLength, true);
  dv.setUint32(16, 0x4e4f534a, true);
  glbOut.fill(0x20, 20, 20 + jsonLength);
  glbOut.set(text, 20);
  dv.setUint32(20 + jsonLength, length, true);
  dv.setUint32(24 + jsonLength, 0x004e4942, true);
  glbOut.set(outBin, 28 + jsonLength);
  return glbOut;
}

/** What this script writes, from the model on disk. */
export function render(): Uint8Array {
  return cutNode(new Uint8Array(fs.readFileSync(SOURCE)), NODE, "patternflow web/scripts/cut-led-panel.ts, node \"l\" of public/cases/official/model.glb");
}

if (path.resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  const out = render();
  fs.writeFileSync(TARGET, out);
  console.log(`wrote ${path.relative(WEB, TARGET)} (${out.length} bytes, from ${fs.statSync(SOURCE).size})`);
}
