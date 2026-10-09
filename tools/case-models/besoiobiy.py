#!/usr/bin/env python3
"""Besoiobiy's printed case, put together, as the shell of its preview model.

    python besoiobiy.py
    node assemble.mjs besoiobiy-printed build/besoiobiy-printed/shell.glb build/besoiobiy-printed/placement.json

MIT, like the rest of tools/. The model it makes is a drawing of Besoiobiy's
case and takes the case's license (CC BY-SA 4.0, README.md).

hardware/case/remixes/besoiobiy-printed/source/patternbox.stl is Besoiobiy's
whole Blender scene in one STL. The case lies in it face up, its front toward
the scene's +z, and every part faces the way it does assembled, but they are
pulled apart: the variant box halves are stacked above the main ones, the
covers lie below them, the knob cap stands above it all, and 45 modelling
helpers lie around them (README, "Files" and "The parts"). Each file in the
remix's stl/ folder is one connected piece of that scene, unchanged except for
its placement (turned to its print orientation, set on the bed, centred). So:

1. Split the scene into connected pieces and find the nine that are parts by
   matching each STL file against them on signatures a placement cannot
   change: triangle count, surface area, volume and the principal moments of
   inertia. The halves are the lettered ones with the bridge, box_top.stl and
   box_bottom.stl, as in Besoiobiy's photo; the variants and the helpers are
   left out.

2. Put them together. Since the scene already turns every part the way it
   faces assembled, the assembly is translations only, each one worked out
   from the faces that meet, not from the scene's spacing:
     - frame_top stays where it is: everything else is placed against it.
     - The bottom halves slide along y until their joint face meets the top
       half's. Each bottom half carries the 2 mm keys of that joint, which go
       into pockets in the top half.
     - The box halves slide along x until the box's side face meets the
       frame's outer side (the box carries those keys), with the box's joint
       in line with the frame's and the fronts flush.
     - Each cover keeps its half's x and y (the scene centres it over its
       opening, 0.2 mm short of every edge) and moves along z until its back
       is flush with the back of the case. That puts its front face on the
       2 mm ledge the half has for it, which is checked.
   Then the result is checked against the remix README: 267 × 329 × 30.85 mm
   overall, the 161 × 321 mm panel opening, the panel tabs 14.35 mm behind the
   front edge, the four 7.2 mm encoder holes 30.8 × 30.1 mm apart, and no two
   parts overlapping (boolean intersections, by manifold3d).

3. Move it into the model frame (tools/case-models/README.md): one unit is
   10 mm, the device faces +z with the knobs at the top and the panel on the
   left. In the scene the knob end of the case lies toward -y and the box,
   seen from the front, toward -x, so that is a half turn about z. The case's
   outline is centred where the official case's is, and its front face is set
   where the official's is, so the knobs stand at the same depth.

4. Write the shell, one node per part (frame_top, frame_bottom, box_top,
   box_bottom, cover_frame_top, cover_frame_bottom, cover_box_top,
   cover_box_bottom, in white PLA) and the four knob caps as c1..c4 (black
   PLA), with normals that keep a printed part's edges hard and its round
   surfaces smooth; and placement.json, which tells assemble.mjs where this
   case holds the board and the LED panel:
     board  added to the official board's placement, so that the encoders
            (the official knob axes plus this) are centred on the four holes
            and bear on the inside of the box's front, which is 4 mm thick
            where the official case's is 3 mm;
     led    the panel node's translation: centred in the frame's opening,
            its LED face flush with the frame's front edge, as a panel with
            Besoiobiy's 14.35 mm socket depth sits (README, "Check your
            panel first");
     knobs  "shell": the knobs are Besoiobiy's caps, not the official ones.

The board's encoders are 31 × 30.5 mm apart and the holes 30.8 × 30.1 mm, so
they cannot all be concentric: the board is centred on the holes, as the
README says the build relies on the play in both. The knob caps go on the
encoder shafts, so they follow the board, 0.8 mm off the front face like the
official knobs. The LED panel in the model is a simplified 17 mm slab, 2.6 mm
deeper than the real panel in front of its sockets, so its back passes
through the frame's tabs; the real panel's sockets stop on them.

Deterministic: the same input files give the same output bytes.
"""

from __future__ import annotations

import argparse
import itertools
import json
import re
import sys
from pathlib import Path

import numpy as np
import shapely
import trimesh
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
REMIX = REPO / "hardware/case/remixes/besoiobiy-printed"

# The case's parts, by the file in the remix's stl/ folder that is each of
# them, and the materials lib/looks.mjs gives the case and the knobs.
CASE_PARTS = {
    "frame_top": "frame_top.stl",
    "frame_bottom": "frame_bottom.stl",
    "box_top": "box_top.stl",
    "box_bottom": "box_bottom.stl",
    "cover_frame_top": "cover_frame_top.stl",
    "cover_frame_bottom": "cover_frame_bottom.stl",
    "cover_box_top": "cover_box_top.stl",
    "cover_box_bottom": "cover_box_bottom.stl",
}
KNOB_FILE = "knob_cap.stl"
CASE_MATERIAL = "pla_white"
KNOB_MATERIAL = "pla_black"

# The covers, by the half whose back each one closes.
COVER_OF = {
    "cover_frame_top": "frame_top",
    "cover_frame_bottom": "frame_bottom",
    "cover_box_top": "box_top",
    "cover_box_bottom": "box_bottom",
}

# What the remix README says the assembled case measures, in mm.
README_SIZE = (267.0, 329.0, 30.85)
README_OPENING = (161.0, 321.0)
README_SOCKET_DEPTH = 14.35
README_HOLE = 7.2
README_HOLE_PITCH = (30.8, 30.1)
COVER_THICKNESS = 2.0

# How deep the LED panel model is (lib/frame.mjs, LED_SIZE), for the report.
LED_DEPTH = 16.99

# Where the official case sits in the model frame, as `node assemble.mjs
# official` reports it: the centre of its outline (its "body" node, x
# -12.5184..12.155, y -0.0693..32.5584) and the inside of its front, 3 mm
# behind the front face (case-v39.glb), which its encoders bear on.
OFFICIAL_OUTLINE_CENTRE = (-0.1817, 16.2446)
OFFICIAL_INSIDE_FRONT_Z = 1.2628

# The rest of the official numbers come from lib/frame.mjs, so the two
# cannot drift apart: the knob bases (on the encoder axes) and the front face.
FRAME_MJS = HERE / "lib/frame.mjs"

# Model units per mm, and the half turn about z from the scene to the model
# frame: the scene's +z is already the front, its -y is up, its -x is right.
MM = 0.1
SCENE_TO_MODEL = np.diag([-1.0, -1.0, 1.0])

# Edges sharper than this stay hard in the shading; flatter ones are smoothed
# over, so the holes and the knob read round and every chamfer, lettering
# wall and corner stays crisp.
CREASE_DEG = 35.0

# Pieces closer than this (mm³) count as not overlapping: faces that touch
# exactly, as the glued joints do, give a sliver of rounding error.
OVERLAP_TOLERANCE = 1.0


def require(ok: bool, message: str) -> None:
    """Stops the build when the files are not what this script expects."""
    if not ok:
        sys.exit(f"besoiobiy.py: {message}")


def official_numbers() -> tuple[dict[str, np.ndarray], float]:
    """KNOB_BASES and OFFICIAL_FRONT_Z, read from lib/frame.mjs."""
    text = FRAME_MJS.read_text()
    bases = {
        f"c{n}": np.array([float(v) for v in vec.split(",")])
        for n, vec in re.findall(r"\bc([1-4]):\s*\[([^\]]+)\]", text)
    }
    front = re.search(r"OFFICIAL_FRONT_Z\s*=\s*([-\d.]+)", text)
    require(
        sorted(bases) == ["c1", "c2", "c3", "c4"] and front is not None,
        f"{FRAME_MJS}: no KNOB_BASES c1..c4 or OFFICIAL_FRONT_Z",
    )
    return bases, float(front.group(1))


def signature(mesh: trimesh.Trimesh) -> np.ndarray:
    """Numbers that do not change when a part is moved or turned."""
    return np.concatenate(
        [
            [len(mesh.faces), mesh.area, abs(mesh.volume)],
            np.sort(np.abs(mesh.principal_inertia_components)),
        ]
    )


def find_parts(scene: list[trimesh.Trimesh], stl_dir: Path) -> dict[str, trimesh.Trimesh]:
    """The scene piece each STL file is, by signature; exactly one each."""
    sigs = [signature(piece) for piece in scene]
    found = {}
    for name, file in {**CASE_PARTS, "knob": KNOB_FILE}.items():
        want = signature(trimesh.load_mesh(stl_dir / file))
        matches = [
            i
            for i, have in enumerate(sigs)
            if have[0] == want[0] and np.allclose(have[1:], want[1:], rtol=1e-4, atol=1e-3)
        ]
        require(len(matches) == 1, f"{file}: {len(matches)} pieces of the scene match it, expected one")
        found[name] = scene[matches[0]]
    return found


def planes(mesh: trimesh.Trimesh, axis: int, sign: int) -> list[tuple[float, float]]:
    """The flat faces facing along ±axis: (level, area) per level, mm."""
    normals, areas, centres = mesh.face_normals, mesh.area_faces, mesh.triangles_center
    facing = normals[:, axis] * sign > 0.9999
    levels = np.round(centres[facing, axis], 2)
    out = {}
    for level, area in zip(levels, areas[facing]):
        out[level] = out.get(level, 0.0) + area
    return sorted((float(k), float(v)) for k, v in out.items())


def outer_face(mesh: trimesh.Trimesh, axis: int, sign: int, within: float = 3.0) -> float:
    """
    The level of a part's outer face on one side: of the flat faces facing
    that way near the part's extreme, the largest. A joint's key is small and
    stands 2 mm proud of the face it belongs to; this skips it.
    """
    extreme = mesh.bounds[1 if sign > 0 else 0, axis]
    near = [(area, level) for level, area in planes(mesh, axis, sign) if abs(level - extreme) <= within]
    return max(near)[1]


def largest_plane(mesh: trimesh.Trimesh, axis: int, sign: int) -> float:
    return max((area, level) for level, area in planes(mesh, axis, sign))[1]


def assemble(parts: dict[str, trimesh.Trimesh]) -> dict[str, np.ndarray]:
    """Each case part's translation in the scene (mm) that puts it in place."""
    X, Y, Z = 0, 1, 2
    p = parts
    t = {"frame_top": np.zeros(3)}

    # The frame's joint: the bottom half's joint face onto the top half's.
    t["frame_bottom"] = np.array([0.0, outer_face(p["frame_top"], Y, +1) - outer_face(p["frame_bottom"], Y, -1), 0.0])
    # The box beside the frame: its side face onto the frame's outer side,
    # its joint in line with the frame's, the fronts flush.
    t["box_top"] = np.array(
        [
            outer_face(p["frame_top"], X, -1) - outer_face(p["box_top"], X, +1),
            outer_face(p["frame_top"], Y, +1) - outer_face(p["box_top"], Y, +1),
            p["frame_top"].bounds[1, Z] - p["box_top"].bounds[1, Z],
        ]
    )
    # The box's joint, the same way as the frame's.
    t["box_bottom"] = t["box_top"] + [
        0.0,
        outer_face(p["box_top"], Y, +1) - outer_face(p["box_bottom"], Y, -1),
        0.0,
    ]
    for top, bottom in (("frame_top", "frame_bottom"), ("box_top", "box_bottom")):
        sides = [p[half].bounds[0, X] + t[half][X] for half in (top, bottom)]
        require(abs(sides[0] - sides[1]) < 0.01, f"{bottom} is not in line with {top}")
    # Each cover: its half's x and y, its back flush with the case's back.
    back = p["frame_top"].bounds[0, Z]
    for cover, half in COVER_OF.items():
        t[cover] = np.array([t[half][X], t[half][Y], back - p[cover].bounds[0, Z]])
        ledges = [level + t[half][Z] for level, _ in planes(p[half], Z, -1)]
        front = p[cover].bounds[1, Z] + t[cover][Z]
        require(abs(p[cover].extents[Z] - COVER_THICKNESS) < 0.01, f"{cover} is not a 2 mm plate")
        require(min(abs(np.array(ledges) - front)) < 0.01, f"{half} has no ledge under {cover}")
    return t


def placed(parts: dict[str, trimesh.Trimesh], moves: dict[str, np.ndarray]) -> dict[str, trimesh.Trimesh]:
    return {name: parts[name].copy().apply_translation(moves[name]) for name in CASE_PARTS}


def material_at(mesh: trimesh.Trimesh, z: float) -> shapely.Geometry:
    """A slice through a part at depth z, as the area that is solid (mm)."""
    section = mesh.section(plane_origin=[0, 0, z], plane_normal=[0, 0, 1])
    solid = shapely.Polygon()
    for loop in section.discrete:
        solid = solid.symmetric_difference(shapely.Polygon(loop[:, :2]))
    return solid


def check(case: dict[str, trimesh.Trimesh]) -> dict[str, object]:
    """The assembled case against the README's measurements; returns what the model needs."""
    Z = 2
    every = trimesh.util.concatenate(list(case.values()))
    size = every.extents
    require(np.allclose(size, README_SIZE, atol=0.01), f"assembled size {size}, README says {README_SIZE}")

    # No two parts overlap (keys in their pockets, covers on their ledges).
    for a, b in itertools.combinations(case, 2):
        lo = np.maximum(case[a].bounds[0], case[b].bounds[0])
        hi = np.minimum(case[a].bounds[1], case[b].bounds[1])
        if np.any(hi - lo <= 0):
            continue
        overlap = trimesh.boolean.intersection([case[a], case[b]], engine="manifold")
        volume = overlap.volume if len(overlap.faces) else 0.0
        require(volume < OVERLAP_TOLERANCE, f"{a} and {b} overlap by {volume:.1f} mm³")

    # The panel's opening: the hole in a slice through the two frame halves
    # between their front edge and the tabs, where only the walls are.
    top, bottom = case["frame_top"], case["frame_bottom"]
    front = top.bounds[1, Z]
    tabs = largest_plane(top, Z, +1)
    require(abs(front - tabs - README_SOCKET_DEPTH) < 0.01, f"tabs {front - tabs:.2f} mm behind the front")
    # (Closing the hairline at the joint first: the halves touch there, and
    # their slices meet only to within rounding.)
    slices = [material_at(half, front - 5).buffer(0.05) for half in (top, bottom)]
    walls = shapely.unary_union(slices).buffer(-0.05)
    rings = [shapely.Polygon(ring) for g in getattr(walls, "geoms", [walls]) for ring in g.interiors]
    require(bool(rings), "no opening in the frame")
    x0, y0, x1, y1 = max(rings, key=lambda pg: pg.area).bounds
    opening = (x1 - x0, y1 - y0)
    require(np.allclose(opening, README_OPENING, atol=0.01), f"opening {opening}, README says {README_OPENING}")

    # The encoder holes, through the box's front, and the inside of that
    # front, which the encoders bear on.
    box = case["box_top"]
    inside = largest_plane(box, Z, -1)
    hole_area = np.pi * (README_HOLE / 2) ** 2
    section = box.section(plane_origin=[0, 0, (inside + front) / 2], plane_normal=[0, 0, 1])
    holes = [
        shapely.Polygon(loop[:, :2])
        for loop in section.discrete
        if abs(shapely.Polygon(loop[:, :2]).area - hole_area) < 0.1 * hole_area
    ]
    require(len(holes) == 4, f"{len(holes)} encoder holes, expected four")
    centres = np.array(sorted((h.centroid.x, h.centroid.y) for h in holes))
    pitch = (np.ptp(centres[:, 0]), np.ptp(centres[:, 1]))
    require(np.allclose(pitch, README_HOLE_PITCH, atol=0.06), f"holes {pitch} apart")
    width = np.mean([h.bounds[2] - h.bounds[0] for h in holes])
    require(abs(width - README_HOLE) < 0.01, f"holes {width:.2f} mm across")
    # Nothing behind the front where an encoder's 12.4 mm body stands.
    behind = material_at(box, inside - 0.3)
    for cx, cy in centres:
        body = shapely.box(cx - 6.2, cy - 6.2, cx + 6.2, cy + 6.2)
        require(behind.intersection(body).area < 0.5, "something behind the front where an encoder sits")

    return {
        "outline": every.bounds,
        "front": front,
        "inside_front": inside,
        "tabs": tabs,
        "opening_centre": np.array([(x0 + x1) / 2, (y0 + y1) / 2]),
        "hole_centroid": centres.mean(axis=0),
        "pitch": pitch,
        "overall": size,
    }


def knob_cap(knob: trimesh.Trimesh) -> trimesh.Trimesh:
    """
    The cap with its origin on its axis at its base, in model units. In the
    scene it already stands the way it goes on, its dished top toward the
    front (+z): checked by the bore's recess opening at the base.
    """
    base = knob.bounds[0, 2]
    loops = knob.section(plane_origin=[0, 0, base + 0.5], plane_normal=[0, 0, 1]).discrete
    rings = sorted((shapely.Polygon(loop[:, :2]) for loop in loops), key=lambda pg: pg.area)
    require(len(rings) == 2 and rings[0].area < rings[1].area / 2, "the knob's recess is not at its base")
    # The recess under the cap is round, centred on its axis.
    axis = np.array([rings[0].centroid.x, rings[0].centroid.y, base])
    cap = knob.copy()
    cap.apply_translation(-axis)
    return to_model_units(cap, np.zeros(3))


def to_model_units(mesh: trimesh.Trimesh, offset: np.ndarray) -> trimesh.Trimesh:
    """Scene mm → model frame: the half turn about z, 10 mm to the unit, then offset."""
    out = mesh.copy()
    matrix = np.eye(4)
    matrix[:3, :3] = SCENE_TO_MODEL * MM
    matrix[:3, 3] = offset
    out.apply_transform(matrix)
    return out


def crease_shaded(mesh: trimesh.Trimesh, crease_deg: float) -> trimesh.Trimesh:
    """
    The mesh with a vertex per smooth patch around each corner: a vertex is
    shared between the faces round it that meet at flatter than crease_deg
    and split where they meet sharper. Each copy's normal is its patch's,
    weighted by the corner angles, as CAD shading does it.
    """
    faces = mesh.faces
    corners = len(faces) * 3
    # Corners joined across every edge that is not a crease.
    smooth = mesh.face_adjacency_angles < np.radians(crease_deg)
    pairs = mesh.face_adjacency[smooth]
    edges = mesh.face_adjacency_edges[smooth]
    rows, cols = [], []
    for k in range(2):
        v = edges[:, k]
        ka = np.argmax(faces[pairs[:, 0]] == v[:, None], axis=1)
        kb = np.argmax(faces[pairs[:, 1]] == v[:, None], axis=1)
        rows.append(pairs[:, 0] * 3 + ka)
        cols.append(pairs[:, 1] * 3 + kb)
    rows, cols = np.concatenate(rows), np.concatenate(cols)
    graph = coo_matrix((np.ones(len(rows)), (rows, cols)), shape=(corners, corners))
    count, label = connected_components(graph, directed=False)
    # Number the new vertices in order of first use, so the output is stable.
    _, first = np.unique(label, return_index=True)
    order = np.argsort(np.argsort(first))
    vertex_of = order[label]
    face_normals = np.repeat(mesh.face_normals, 3, axis=0)
    normals = np.zeros((count, 3))
    np.add.at(normals, vertex_of, face_normals * mesh.face_angles.reshape(-1, 1))
    # A corner of a needle triangle can stand alone with a zero angle (a few
    # in the case's files): it takes its own face's normal, unweighted.
    lone = np.linalg.norm(normals, axis=1) < 1e-12
    if lone.any():
        fallback = np.zeros((count, 3))
        np.add.at(fallback, vertex_of, face_normals)
        normals[lone] = fallback[lone]
    lengths = np.linalg.norm(normals, axis=1, keepdims=True)
    normals = np.divide(normals, lengths, out=np.tile([0.0, 0.0, 1.0], (count, 1)), where=lengths > 0)
    positions = np.zeros((count, 3))
    positions[vertex_of] = mesh.vertices[faces.reshape(-1)]
    return trimesh.Trimesh(
        vertices=positions,
        faces=vertex_of.reshape(-1, 3),
        vertex_normals=normals,
        process=False,
    )


def with_material(mesh: trimesh.Trimesh, name: str) -> trimesh.Trimesh:
    mesh.visual = trimesh.visual.TextureVisuals(material=trimesh.visual.material.PBRMaterial(name=name))
    return mesh


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--scene", type=Path, default=REMIX / "source/patternbox.stl", help="Besoiobiy's scene STL")
    ap.add_argument("--parts", type=Path, default=REMIX / "stl", help="the remix's stl/ folder")
    ap.add_argument(
        "--out", type=Path, default=HERE / "build/besoiobiy-printed", help="where shell.glb and placement.json go"
    )
    args = ap.parse_args()

    knob_bases, official_front = official_numbers()

    scene = trimesh.load_mesh(args.scene).split(only_watertight=False)
    parts = find_parts(scene, args.parts)
    moves = assemble(parts)
    case = placed(parts, moves)
    found = check(case)

    # Into the model frame: the outline centred on the official case's, the
    # front face on the official's.
    lo, hi = found["outline"]
    centre = SCENE_TO_MODEL @ ((lo + hi) / 2) * MM
    offset = np.array(
        [
            OFFICIAL_OUTLINE_CENTRE[0] - centre[0],
            OFFICIAL_OUTLINE_CENTRE[1] - centre[1],
            official_front - found["front"] * MM,
        ]
    )

    def model_point(p) -> np.ndarray:
        return SCENE_TO_MODEL @ np.asarray(p, dtype=float) * MM + offset

    front = found["front"] * MM + offset[2]
    holes = model_point([*found["hole_centroid"], 0.0])
    knob_centroid = np.mean(list(knob_bases.values()), axis=0)
    board = np.array(
        [
            holes[0] - knob_centroid[0],
            holes[1] - knob_centroid[1],
            found["inside_front"] * MM + offset[2] - OFFICIAL_INSIDE_FRONT_Z,
        ]
    )
    led = model_point([*found["opening_centre"], found["front"]])
    knob_standoff = knob_bases["c1"][2] - official_front

    out = trimesh.Scene()
    for name, part in case.items():
        mesh = crease_shaded(to_model_units(part, offset), CREASE_DEG)
        out.add_geometry(with_material(mesh, CASE_MATERIAL), node_name=name, geom_name=name)
    cap = with_material(crease_shaded(knob_cap(parts["knob"]), CREASE_DEG), KNOB_MATERIAL)
    knobs = {}
    for name, base in sorted(knob_bases.items()):
        at = np.array([base[0] + board[0], base[1] + board[1], front + knob_standoff])
        knobs[name] = at
        out.add_geometry(
            cap, node_name=name, geom_name="knob_cap", transform=trimesh.transformations.translation_matrix(at)
        )

    args.out.mkdir(parents=True, exist_ok=True)
    (args.out / "shell.glb").write_bytes(out.export(file_type="glb", include_normals=True))
    placement = {
        "board": [round(float(v), 4) for v in board],
        "led": [round(float(v), 4) for v in led],
        "knobs": "shell",
    }
    (args.out / "placement.json").write_text(json.dumps(placement, indent=2) + "\n")

    # Report, in mm unless it says units.
    size = found["overall"]
    print(f"parts: {', '.join(CASE_PARTS)} and the knob cap, matched in {args.scene.name}")
    for name, move in moves.items():
        print(f"  {name:20s} moved {np.round(move, 2).tolist()}")
    print(f"assembled {size[0]:.2f} × {size[1]:.2f} × {size[2]:.2f}, no parts overlapping")
    print(
        f"holes {found['pitch'][0]:.2f} × {found['pitch'][1]:.2f} apart; front {found['front'] - found['inside_front']:.2f} thick"
    )
    into_tabs = found["tabs"] - (found["front"] - LED_DEPTH)
    print(
        f"panel tabs {found['front'] - found['tabs']:.2f} behind the front; the {LED_DEPTH} mm panel model passes {into_tabs:.2f} into them"
    )
    print(f"model units: board {placement['board']}, led {placement['led']}")
    for name, at in knobs.items():
        print(f"  {name} {np.round(at, 4).tolist()}")
    print(f"wrote {args.out / 'shell.glb'} and placement.json")


if __name__ == "__main__":
    main()
