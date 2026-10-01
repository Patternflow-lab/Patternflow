import * as THREE from "three";

// Cables that move: a round tube (the USB lead, the panel's power wires) and
// a flat ribbon (the HUB75 lead), each a fixed buffer rewritten from a curve
// whenever an end moves — the board carrying J4 into its bay, a plug going
// into the power bank — and drawn only up to a fraction of its length while
// it is being laid. Frames along the curve are parallel-transported, so a
// tube never twists and a ribbon keeps its width square to a hint.

const tmp = {
  p: new THREE.Vector3(),
  t: new THREE.Vector3(),
  n: new THREE.Vector3(),
  b: new THREE.Vector3(),
  prevT: new THREE.Vector3(),
  hint: new THREE.Vector3(),
};

/** A path through points: CatmullRom (centripetal), sampled evenly by arc length. */
export class Path {
  readonly curve: THREE.CatmullRomCurve3;
  constructor(points: number) {
    this.curve = new THREE.CatmullRomCurve3(
      Array.from({ length: points }, () => new THREE.Vector3()),
      false,
      "centripetal",
    );
  }
  get points() {
    return this.curve.points;
  }
  /** Mark the points as changed (the curve caches its arc lengths). */
  touch() {
    this.curve.updateArcLengths();
  }
}

export class Tube {
  readonly mesh: THREE.Mesh;
  readonly geometry: THREE.BufferGeometry;
  private readonly segs: number;
  private readonly radial: number;
  private radius: number;

  constructor(segs: number, radial: number, radius: number, material: THREE.Material) {
    this.segs = segs;
    this.radial = radial;
    this.radius = radius;
    const verts = (segs + 1) * (radial + 1);
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(verts * 3), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(verts * 3), 3).setUsage(THREE.DynamicDrawUsage));
    const idx: number[] = [];
    for (let i = 0; i < segs; i++) {
      for (let j = 0; j < radial; j++) {
        const a = i * (radial + 1) + j;
        const b = (i + 1) * (radial + 1) + j;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    g.setIndex(idx);
    this.geometry = g;
    this.mesh = new THREE.Mesh(g, material);
    this.mesh.frustumCulled = false;
  }

  /** Rebuild from a path; `from`…`to` is the share of the length drawn (0…1). */
  update(path: Path, to = 1, from = 0) {
    const { segs, radial, radius } = this;
    const pos = this.geometry.getAttribute("position") as THREE.BufferAttribute;
    const nor = this.geometry.getAttribute("normal") as THREE.BufferAttribute;
    const curve = path.curve;
    for (let i = 0; i <= segs; i++) {
      const u = i / segs;
      curve.getPointAt(u, tmp.p);
      curve.getTangentAt(u, tmp.t).normalize();
      if (i === 0) {
        // Any perpendicular to start with.
        tmp.n.set(0, 1, 0);
        if (Math.abs(tmp.t.y) > 0.9) tmp.n.set(1, 0, 0);
        tmp.n.sub(tmp.b.copy(tmp.t).multiplyScalar(tmp.n.dot(tmp.t))).normalize();
      } else {
        // Carried along: drop the part along the new tangent.
        tmp.n.sub(tmp.b.copy(tmp.t).multiplyScalar(tmp.n.dot(tmp.t))).normalize();
      }
      tmp.b.crossVectors(tmp.t, tmp.n);
      for (let j = 0; j <= radial; j++) {
        const a = (j / radial) * Math.PI * 2;
        const c = Math.cos(a);
        const s = Math.sin(a);
        const k = i * (radial + 1) + j;
        const nx = tmp.n.x * c + tmp.b.x * s;
        const ny = tmp.n.y * c + tmp.b.y * s;
        const nz = tmp.n.z * c + tmp.b.z * s;
        nor.setXYZ(k, nx, ny, nz);
        pos.setXYZ(k, tmp.p.x + nx * radius, tmp.p.y + ny * radius, tmp.p.z + nz * radius);
      }
    }
    pos.needsUpdate = true;
    nor.needsUpdate = true;
    const a = Math.max(0, Math.min(segs, Math.round(from * segs)));
    const b = Math.max(a, Math.min(segs, Math.round(to * segs)));
    this.geometry.setDrawRange(a * radial * 6, (b - a) * radial * 6);
    this.mesh.visible = b > a;
  }

  setRadius(r: number) {
    this.radius = r;
  }
}

/**
 * A flat strip: `width` across, square to the tangent and as close to `hint`
 * as the curve allows (the HUB75 ribbon's width runs along y wherever it can).
 */
export class Ribbon {
  readonly mesh: THREE.Mesh;
  readonly geometry: THREE.BufferGeometry;
  private readonly segs: number;
  private readonly width: number;
  private readonly thick: number;

  constructor(segs: number, width: number, thick: number, material: THREE.Material) {
    this.segs = segs;
    this.width = width;
    this.thick = thick;
    // Four long edges (a flat box swept along the curve).
    const verts = (segs + 1) * 8;
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(verts * 3), 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute("normal", new THREE.BufferAttribute(new Float32Array(verts * 3), 3).setUsage(THREE.DynamicDrawUsage));
    const idx: number[] = [];
    for (let i = 0; i < segs; i++) {
      for (let f = 0; f < 4; f++) {
        const a = i * 8 + f * 2;
        const b = (i + 1) * 8 + f * 2;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    g.setIndex(idx);
    this.geometry = g;
    this.mesh = new THREE.Mesh(g, material);
    this.mesh.frustumCulled = false;
  }

  update(path: Path, hint: THREE.Vector3, to = 1) {
    const { segs, width, thick } = this;
    const pos = this.geometry.getAttribute("position") as THREE.BufferAttribute;
    const nor = this.geometry.getAttribute("normal") as THREE.BufferAttribute;
    const hw = width / 2;
    const ht = thick / 2;
    for (let i = 0; i <= segs; i++) {
      const u = i / segs;
      path.curve.getPointAt(u, tmp.p);
      path.curve.getTangentAt(u, tmp.t).normalize();
      // Width along the hint, square to the tangent; carried on from the last
      // sample where the tangent runs along the hint.
      tmp.hint.copy(hint).sub(tmp.b.copy(tmp.t).multiplyScalar(hint.dot(tmp.t)));
      if (tmp.hint.lengthSq() < 1e-4 && i > 0) tmp.hint.copy(tmp.n);
      tmp.n.copy(tmp.hint).normalize(); // across the width
      tmp.b.crossVectors(tmp.t, tmp.n).normalize(); // through the thickness
      const k = i * 8;
      // faces: +b (top), +n (edge), −b (bottom), −n (edge); two verts each
      const corners: [number, number, THREE.Vector3, number][] = [
        [-hw, ht, tmp.b, 1],
        [hw, ht, tmp.b, 1],
        [hw, ht, tmp.n, 1],
        [hw, -ht, tmp.n, 1],
        [hw, -ht, tmp.b, -1],
        [-hw, -ht, tmp.b, -1],
        [-hw, -ht, tmp.n, -1],
        [-hw, ht, tmp.n, -1],
      ];
      corners.forEach(([w, h, nrm, sign], c) => {
        pos.setXYZ(
          k + c,
          tmp.p.x + tmp.n.x * w + tmp.b.x * h,
          tmp.p.y + tmp.n.y * w + tmp.b.y * h,
          tmp.p.z + tmp.n.z * w + tmp.b.z * h,
        );
        nor.setXYZ(k + c, nrm.x * sign, nrm.y * sign, nrm.z * sign);
      });
    }
    pos.needsUpdate = true;
    nor.needsUpdate = true;
    const b = Math.max(0, Math.min(segs, Math.round(to * segs)));
    this.geometry.setDrawRange(0, b * 4 * 6);
    this.mesh.visible = b > 0;
  }
}
