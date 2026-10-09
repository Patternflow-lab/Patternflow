import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { BUILD_CASES } from '@/components/sections/build-cases-data';
import { CASE_MODELS, DEVKIT_NODE, KNOB_NODES, LED_NODE, PCB_NODE } from './caseModels';

// The case models against the files in public/: every case on the Build
// panel's switch has one, each has the parts the preview finds by name
// (caseModels.ts), what an entry names — the parts its exploded view moves,
// the materials its finishes recolour — is in the file, and the model the
// page loads first is no heavier than the one it replaced. Reads the GLB's
// JSON chunk only; the meshes are Draco-compressed and stay that way.

const PUBLIC = path.resolve(__dirname, '../../../public');

/** The landing page's first model, public/3dforweb.glb, which the page used to load first. */
const OLD_MODEL_BYTES = 1_154_992;
/** The official model loads with the page: well under the old one. */
const FIRST_LOAD_BUDGET = 450_000;
/** A remix's model loads when it is picked. */
const REMIX_BUDGET = 600_000;

interface GltfNode {
  name?: string;
  mesh?: number;
  rotation?: number[];
  children?: number[];
}

interface Gltf {
  scene?: number;
  scenes: { nodes: number[] }[];
  nodes: GltfNode[];
  meshes: { primitives: { attributes: Record<string, number>; material?: number }[] }[];
  materials?: { name?: string }[];
  extensionsRequired?: string[];
}

function readGlb(file: string): Gltf {
  const buf = fs.readFileSync(file);
  expect(buf.readUInt32LE(0), `${file} is not a GLB`).toBe(0x46546c67);
  const length = buf.readUInt32LE(12);
  expect(buf.readUInt32LE(16), `${file}: first chunk is not JSON`).toBe(0x4e4f534a);
  return JSON.parse(buf.subarray(20, 20 + length).toString('utf8')) as Gltf;
}

const models = BUILD_CASES.map((item) => ({ id: item.id, model: CASE_MODELS[item.id] }));

describe('case models', () => {
  it('has one for every case on the switch, and no other', () => {
    expect(Object.keys(CASE_MODELS).sort()).toEqual(BUILD_CASES.map((item) => item.id).sort());
    for (const { id, model } of models) expect(model.id).toBe(id);
  });

  describe.each(models)('$id', ({ id, model }) => {
    const file = path.join(PUBLIC, model.url);

    it('is a file in public/, inside the case’s own folder', () => {
      expect(model.url).toBe(`/cases/${id}/model.glb`);
      expect(fs.existsSync(file), `${model.url} is missing`).toBe(true);
    });

    it('has the parts the preview finds by name', () => {
      const gltf = readGlb(file);
      const top = gltf.scenes[gltf.scene ?? 0].nodes.map((i) => gltf.nodes[i]);
      const byName = new Map(top.map((node) => [node.name, node]));
      for (const name of [LED_NODE, ...KNOB_NODES, PCB_NODE, DEVKIT_NODE]) {
        expect(byName.has(name), `${id}: no top-level node "${name}"`).toBe(true);
      }
      // The pattern shaders draw with the panel's UVs.
      const led = byName.get(LED_NODE)!;
      for (const prim of gltf.meshes[led.mesh!].primitives) {
        expect(Object.keys(prim.attributes)).toContain('TEXCOORD_0');
      }
      // A knob turns about its own +z: no rotation on the node.
      for (const name of KNOB_NODES) {
        const knob = byName.get(name)!;
        expect(knob.mesh, `${id}: knob ${name} has no mesh`).toBeDefined();
        expect(knob.rotation ?? [0, 0, 0, 1], `${id}: knob ${name} is turned`).toEqual([0, 0, 0, 1]);
      }
      // The case itself: at least one part besides the device's own.
      const shared = new Set<string>([LED_NODE, ...KNOB_NODES, PCB_NODE, DEVKIT_NODE]);
      expect(top.filter((node) => !shared.has(node.name ?? '')).length).toBeGreaterThan(0);
    });

    it('moves only parts that are in the file', () => {
      const gltf = readGlb(file);
      const top = new Set(gltf.scenes[gltf.scene ?? 0].nodes.map((i) => gltf.nodes[i].name));
      for (const name of Object.keys(model.explode)) {
        expect(top.has(name), `${id}: explode names "${name}", which the file has no top-level node for`).toBe(true);
      }
    });

    it('recolours only materials that are in the file', () => {
      const materials = new Set((readGlb(file).materials ?? []).map((m) => m.name));
      for (const finish of model.finishes ?? []) {
        for (const name of Object.keys(finish.looks ?? {})) {
          expect(materials.has(name), `${id}: finish ${finish.id} recolours "${name}", not in the file`).toBe(true);
        }
      }
    });

    it('uses only the Draco compression the page already decodes', () => {
      for (const ext of readGlb(file).extensionsRequired ?? []) {
        expect(['KHR_draco_mesh_compression']).toContain(ext);
      }
    });

    it('stays within its download budget', () => {
      const bytes = fs.statSync(file).size;
      if (id === 'official') {
        expect(bytes).toBeLessThanOrEqual(FIRST_LOAD_BUDGET);
        expect(bytes).toBeLessThan(OLD_MODEL_BYTES);
      } else {
        expect(bytes).toBeLessThanOrEqual(REMIX_BUDGET);
      }
    });
  });
});
