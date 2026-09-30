"use client";

/* eslint-disable react-hooks/immutability --
   Three.js objects are imperative; per-frame mutation is their API. */

import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { useGuideStore } from "../store";
import { stepOf } from "../scenes";
import { KIT } from "./parts";

// What happens on and around the ESP32 DevKit in chapter one: the USB-C
// cable going into the left port, the ports and buttons named, BOOT and RST
// pressed in order, data running up the cable while it flashes, and Wi-Fi
// leaving the antenna. Mounted inside the DevKit's own group, so everything
// here is in its canonical frame (parts.ts): metres, +Y antenna, +Z toward
// the reader, USB-C ports at the −Y end.

const LED = new THREE.Color("#ff6a3d");

function glowRing(radius: number) {
  const mat = new THREE.MeshBasicMaterial({ color: LED, transparent: true, opacity: 0, toneMapped: false, depthWrite: false });
  return new THREE.Mesh(new THREE.RingGeometry(radius * 0.78, radius, 48), mat);
}

type Props = {
  boot: THREE.Object3D | null;
  rst: THREE.Object3D | null;
};

export default function KitFx({ boot, rst }: Props) {
  const cable = useMemo(() => {
    const g = new THREE.Group();
    const p = KIT.usb;
    // A USB-C plug: a soft rubber overmould and the steel shell that goes in.
    const plug = new THREE.Mesh(
      new RoundedBoxGeometry(0.0112, 0.019, 0.0058, 4, 0.0026),
      new THREE.MeshStandardMaterial({ color: "#d9d4ca", roughness: 0.7 }),
    );
    plug.position.set(p.x, p.y - 0.0101, p.z);
    const tip = new THREE.Mesh(
      new RoundedBoxGeometry(0.0084, 0.0068, 0.0026, 3, 0.0012),
      new THREE.MeshStandardMaterial({ color: "#c9ccd2", metalness: 0.9, roughness: 0.25 }),
    );
    tip.position.set(p.x, p.y + 0.0034, p.z);
    // Out of the bottom of the board, then down and away toward the reader.
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(p.x, p.y - 0.0195, p.z),
      new THREE.Vector3(p.x, p.y - 0.06, p.z),
      new THREE.Vector3(p.x - 0.004, p.y - 0.11, p.z + 0.02),
      new THREE.Vector3(p.x - 0.02, p.y - 0.16, p.z + 0.08),
      new THREE.Vector3(p.x - 0.05, p.y - 0.2, p.z + 0.2),
    ]);
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 80, 0.0021, 12, false),
      new THREE.MeshStandardMaterial({ color: "#e9e4da", roughness: 0.6 }),
    );
    g.add(plug, tip, tube);
    return { group: g, curve };
  }, []);

  const packets = useMemo(() => {
    const n = 28;
    const mesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.0011, 8, 8),
      new THREE.MeshBasicMaterial({ color: LED, toneMapped: false }),
      n,
    );
    mesh.frustumCulled = false;
    return { mesh, n };
  }, []);

  const rings = useMemo(
    () => ({
      usb: glowRing(0.0072),
      boot: glowRing(0.0034),
      rst: glowRing(0.0034),
      module: glowRing(0.012),
    }),
    [],
  );

  // Wi-Fi leaving the antenna: arcs opening upward (+Y) in the board's plane.
  const waves = useMemo(
    () =>
      [0, 1, 2].map(() => {
        const mat = new THREE.MeshBasicMaterial({ color: LED, transparent: true, opacity: 0, toneMapped: false, depthWrite: false, side: THREE.DoubleSide });
        const arc = Math.PI * 0.5;
        const m = new THREE.Mesh(new THREE.TorusGeometry(0.0055, 0.0004, 6, 40, arc), mat);
        m.rotation.z = Math.PI / 2 - arc / 2;
        m.position.copy(KIT.antenna);
        return m;
      }),
    [],
  );

  const homes = useMemo(
    () => ({ boot: boot?.position.clone() ?? null, rst: rst?.position.clone() ?? null }),
    [boot, rst],
  );

  const tags = useRef<Record<string, HTMLDivElement | null>>({});
  const shown = useRef({ cable: 0 });
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), v: new THREE.Vector3() }), []);

  useFrame((state, dt) => {
    const { scene, step } = useGuideStore.getState();
    const s = stepOf(scene, step);
    const t = state.clock.elapsedTime;
    const now = performance.now();

    const cableTarget = s.cable ?? 0;
    shown.current.cable += (cableTarget - shown.current.cable) * Math.min(1, dt * 3.2);
    const c = shown.current.cable;
    cable.group.visible = c > 0.02;
    cable.group.position.y = -(1 - c) * 0.07;

    const flashing = Boolean(s.flashing) && c > 0.9;
    packets.mesh.visible = flashing;
    if (flashing) {
      for (let i = 0; i < packets.n; i++) {
        const u = 1 - ((((t * 0.55 + i / packets.n) % 1) + 1) % 1);
        cable.curve.getPointAt(Math.min(0.999, u), tmp.v);
        tmp.m.makeTranslation(tmp.v.x, tmp.v.y, tmp.v.z + 0.0026);
        packets.mesh.setMatrixAt(i, tmp.m);
      }
      packets.mesh.instanceMatrix.needsUpdate = true;
    }

    const tagsOn = new Set(s.espTags ?? []);
    const fade = (ring: THREE.Mesh, target: number) => {
      const mat = ring.material as THREE.MeshBasicMaterial;
      mat.opacity += (target - mat.opacity) * Math.min(1, dt * 8);
      ring.visible = mat.opacity > 0.01;
    };
    const pulse = 0.55 + 0.35 * Math.sin(t * 5);
    fade(rings.usb, tagsOn.has("usb") ? pulse : 0);

    // BOOT held, RST tapped, BOOT released — on the same 2.8 s clock as the card.
    let bootDown = false;
    let rstDown = false;
    if (s.bootSeq) {
      const k = now % 2800;
      bootDown = k < 1100;
      rstDown = k >= 550 && k < 850;
    } else if (s.rstPulse) {
      const k = now % 2200;
      rstDown = k >= 600 && k < 900;
    }
    fade(rings.boot, bootDown ? 1 : tagsOn.has("boot") ? 0.25 : 0);
    fade(rings.rst, rstDown ? 1 : tagsOn.has("rst") ? 0.25 : 0);
    if (boot && homes.boot) boot.position.z = homes.boot.z - (bootDown ? KIT.press : 0);
    if (rst && homes.rst) rst.position.z = homes.rst.z - (rstDown ? KIT.press : 0);

    fade(rings.module, flashing ? 0.35 + 0.3 * Math.sin(t * 7) : 0);

    waves.forEach((w, i) => {
      const phase = (((t * 0.7 + i / 3) % 1) + 1) % 1;
      w.scale.setScalar(1 + phase * 1.9);
      const mat = w.material as THREE.MeshBasicMaterial;
      const target = s.wifi === "esp" ? (1 - phase) * 0.9 : 0;
      mat.opacity += (target - mat.opacity) * Math.min(1, dt * 6);
      w.visible = mat.opacity > 0.01;
    });

    const setTag = (key: string, on: boolean, active = false) => {
      const el = tags.current[key];
      if (!el) return;
      el.dataset.on = on ? "1" : "0";
      el.dataset.active = active ? "1" : "0";
    };
    setTag("usb", tagsOn.has("usb"), true);
    setTag("uart", tagsOn.has("uart"));
    setTag("boot", tagsOn.has("boot"), bootDown);
    setTag("rst", tagsOn.has("rst"), rstDown);
  });

  const tag = (key: string, label: string, at: THREE.Vector3, dx: number, dy: number) => (
    <Html position={[at.x + dx, at.y + dy, at.z + 0.004]} center zIndexRange={[20, 0]}>
      <div
        ref={(el) => {
          tags.current[key] = el;
        }}
        className="guide-knob-tag"
        data-on="0"
      >
        {label}
      </div>
    </Html>
  );

  return (
    <group>
      <primitive object={cable.group} />
      <primitive object={packets.mesh} />
      {(Object.keys(rings) as (keyof typeof rings)[]).map((key) => {
        const at = KIT[key];
        return <primitive key={key} object={rings[key]} position={[at.x, at.y + (key === "usb" ? 0.0036 : 0), at.z + 0.0018]} />;
      })}
      {waves.map((w, i) => (
        <primitive key={i} object={w} />
      ))}
      {tag("usb", "USB · LEFT", KIT.usb, -0.004, -0.016)}
      {tag("uart", "UART", KIT.uart, 0.006, -0.016)}
      {tag("boot", "BOOT", KIT.boot, 0.016, 0)}
      {tag("rst", "RST", KIT.rst, 0.016, 0)}
    </group>
  );
}
