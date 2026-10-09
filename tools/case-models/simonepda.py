#!/usr/bin/env python3
"""SimonePDA's laser-cut case as a 3D shell, made from its drawing.

    python simonepda.py                      # writes build/simonepda-lasercut/
    python simonepda.py --pdf <layout.pdf> --out <dir>

Then `node assemble.mjs simonepda-lasercut build/simonepda-lasercut/shell.glb
build/simonepda-lasercut/placement.json` puts the LED panel, the board, the
DevKit and the knobs in it (README.md). MIT, like the rest of tools/.

The case has no 3D file. What there is, is Simone Majocchi's drawing,
hardware/case/remixes/simonepda-lasercut/lasercut_layout.pdf: six A3 pages at
1:1, every cut a stroked vector path. This script reads those paths with
PyMuPDF (1 pt = 25.4/72 mm), so every size below comes from the drawing, and
the sheet's 256 x 340 mm is checked to make sure the scale survived:

  page 3  the plate: its outline (rounded corners), the panel's 14 screw holes
          (5 mm), the four knob holes (8 mm, on 30 x 30 mm), the four windows
          over the panel's connectors (60 x 40 mm) and the three slots that
          hold the box (2.7 mm wide)
  page 2  the same plate with the panel's outline drawn on it (160 x 320 mm):
          where the panel sits
  page 4  the same plate with the box's lid drawn where the box sits; the lid
          there is the very outline page 5 cuts, which the script checks
  page 1  the four border strips, 16 mm wide: two 322 mm long, two 162 mm
  page 5  the box (the lid and four walls, finger jointed, keys on three walls
          for the plate's three slots, notches for the cables) and the feet
          (an open cube of five 30 mm squares, finger jointed; three are made)

Every part is its outline as drawn, holes and fingers included, extruded by
the sheet's thickness and stood where it goes. The model frame is the one
every case model shares (README.md): one unit is 10 mm, the device stands
facing +z with +y up, the LED panel on the left and the knobs at the top
right. Page 3 is drawn as the plate is seen from the front: turning it onto
its side the way the MDF photo shows puts its slots exactly where the photo
has them, so the drawing maps onto the frame without a mirror.

What the drawing does not say, and what this script assumes instead:

  - The plate and the strips are 2.75 mm thick, the acrylic the README names.
    The box and the feet are 2.7 mm: their finger joints are drawn 2.7 deep
    (makercase's sheet), and at that thickness they close exactly as drawn.
  - The plate sits where the official case does: centred on x = 0, its middle
    at the height of the official LED panel's middle, and its front face at
    the official case's front face (z 1.5635). The board then needs no depth
    of its own to speak of, since the official case's 3 mm wall and this
    2.75 mm sheet both carry the encoders on their back face.
  - The strips stand on edge on the front face around the panel, each flush
    with one corner of the panel and running past the next one by the 2 mm
    the drawing gives them (162 = 160 + 2, 322 = 320 + 2), turning the same
    way round the panel, so each strip closes the end of the next. Which way
    round is not drawn; here the top strip runs past the panel's top-left
    corner, the left one past its bottom-left, and so on round.
  - The box's walls go where the plate's slots say: the keyed short walls at
    the top and the bottom, the keyed long wall on the right (its slot is on
    the right), the long wall without a key on the left, towards the panel.
    The drawing does not say which way each wall faces along its length; the
    photos do: the ribbon cable leaves through the left wall's notch a little
    below its middle (the notch is drawn 55 to 100 mm from one end; that end
    is the top), and the power cable through the bottom wall's notch near its
    right-hand end.
  - The board is centred under the four knob holes. They are 30 x 30 mm apart
    and the board's encoders 31 x 30.5, so it cannot sit on all four centres;
    the 8 mm holes are oversized for that (the remix README).
  - The feet are loose cubes the drawing does not place. The box is as deep
    as a cube is tall (30 mm), so laid flat the device stands on the box at
    the top right of its back and needs feet at the other three corners: one
    cube in each, 4 mm in from the plate's edges, open side against the
    plate, clear of the screw heads.
  - Page 1's title box (the edition's name) and page 2's construction boxes
    are not parts; page 6 is the panel maker's drawing.

Materials, named for lib/looks.mjs: the plate, the strips and the feet are
"sheet_face" on their two big faces and "sheet_edge" on their cut edges (the
same file shows as acrylic or as MDF: the finishes in
web/src/components/3d/cases/simonepda-lasercut.ts); the box is
"acrylic_face" / "acrylic_edge" in every build. One node per part, the two
materials as its two primitives, flat shaded: each face keeps its own normal.
The output is deterministic: run it twice, get the same bytes.
"""

from __future__ import annotations

import argparse
import json
import math
import struct
from pathlib import Path

import numpy as np
import pymupdf
import trimesh
from shapely.geometry import Polygon
from shapely.geometry.polygon import orient

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
DEFAULT_PDF = REPO / "hardware/case/remixes/simonepda-lasercut/lasercut_layout.pdf"
DEFAULT_OUT = HERE / "build/simonepda-lasercut"

PT = 25.4 / 72  # PDF points to millimetres; the drawing is 1:1.
MODEL = 0.1  # millimetres to model units (one unit is 10 mm)

# The plate and the strips: acrylic with its film off (the remix README). The
# box and the feet take their thickness from their own finger joints instead.
SHEET = 2.75

# The official device in the model frame, in model units, from lib/frame.mjs:
# its LED panel's middle, the case's front face and the face 3 mm behind it
# that the encoders bear on, the panel's depth, and the knobs' encoder axes.
# This case's plate takes the official front face's place.
OFFICIAL_LED_Y = 16.2677
OFFICIAL_FRONT_Z = 1.5635
OFFICIAL_INSIDE_Z = 1.2628
LED_DEPTH = 1.699
OFFICIAL_ENCODER_CENTRE = ((6.5265 + 9.6265) / 2, (29.6952 + 26.6452) / 2)
KNOB_LIFT = 0.08  # the knobs' base, 0.8 mm off the front face, as officially

# Where the feet go, as the drawing does not say: inset from the plate's edges.
FOOT_INSET = 4.0

# --------------------------------------------------------------------------
# Reading the drawing


def _pt(p) -> tuple[float, float]:
    return (p.x * PT, p.y * PT)


def _bezier(p0, p1, p2, p3, tol=0.8) -> list[tuple[float, float]]:
    """A cubic Bézier as points, about every `tol` mm along it (first point left out)."""
    hull = math.dist(p0, p1) + math.dist(p1, p2) + math.dist(p2, p3)
    n = max(4, math.ceil(hull / tol))
    out = []
    for i in range(1, n + 1):
        t = i / n
        a, b, c, d = (1 - t) ** 3, 3 * (1 - t) ** 2 * t, 3 * (1 - t) * t**2, t**3
        out.append((a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]))
    return out


class Shape:
    """One stroked path of the drawing: its outline in millimetres, page coordinates (y down)."""

    def __init__(self, drawing: dict):
        self.color = tuple(round(c, 2) for c in (drawing.get("color") or (0, 0, 0)))
        r = drawing["rect"]
        self.x0, self.y0, self.x1, self.y1 = r.x0 * PT, r.y0 * PT, r.x1 * PT, r.y1 * PT
        self.kinds = "".join(item[0] for item in drawing["items"])
        self.circle = self.kinds == "cccc" and abs(self.w - self.h) < 0.05
        pts: list[tuple[float, float]] = []
        for item in drawing["items"]:
            if item[0] == "re":
                q = item[1]
                seg = [(q.x0 * PT, q.y0 * PT), (q.x1 * PT, q.y0 * PT), (q.x1 * PT, q.y1 * PT), (q.x0 * PT, q.y1 * PT)]
            elif item[0] == "l":
                seg = [_pt(item[1]), _pt(item[2])]
            elif item[0] == "c":
                seg = [_pt(item[1])] + _bezier(*(_pt(p) for p in item[1:5]))
            else:
                raise ValueError(f"unexpected path item {item[0]!r}")
            for p in seg:
                if not pts or math.dist(p, pts[-1]) > 1e-6:
                    pts.append(p)
        if len(pts) > 1 and math.dist(pts[0], pts[-1]) < 1e-3:
            pts.pop()
        self.points = pts

    @property
    def w(self) -> float:
        return self.x1 - self.x0

    @property
    def h(self) -> float:
        return self.y1 - self.y0

    @property
    def centre(self) -> tuple[float, float]:
        return ((self.x0 + self.x1) / 2, (self.y0 + self.y1) / 2)

    @property
    def diameter(self) -> float:
        return (self.w + self.h) / 2

    def size_is(self, w: float, h: float, tol=0.2) -> bool:
        return abs(self.w - w) < tol and abs(self.h - h) < tol

    def ring(self) -> list[tuple[float, float]]:
        """The outline as a closed ring; a circle as a regular polygon, about 1 mm a side."""
        if self.circle:
            cx, cy = self.centre
            rad = self.diameter / 2
            n = 4 * max(4, math.ceil(math.pi * self.diameter / 4))
            return [(cx + rad * math.cos(2 * math.pi * i / n), cy + rad * math.sin(2 * math.pi * i / n)) for i in range(n)]
        return self.points

    def local(self) -> list[tuple[float, float]]:
        """The outline with its bounding box's top-left corner at the origin, as a part is laid out."""
        return [(x - self.x0, y - self.y0) for x, y in self.points]


def read_pages(pdf: Path) -> list[list[Shape]]:
    doc = pymupdf.open(pdf)
    if len(doc) < 5:
        raise SystemExit(f"{pdf}: expected the six-page layout, found {len(doc)} pages")
    return [[Shape(d) for d in page.get_drawings()] for page in doc]


def one(shapes: list[Shape], what: str, test) -> Shape:
    found = [s for s in shapes if test(s)]
    if len(found) != 1:
        raise SystemExit(f"expected one {what} in the drawing, found {len(found)}")
    return found[0]


def recover(pages: list[list[Shape]]) -> dict:
    """Every dimension the model needs, from the drawing."""
    p1, p2, p3, p4, p5 = pages[:5]

    # Page 3: the plate. Its outline is the biggest path; everything inside it is a hole.
    outline = max(p3, key=lambda s: s.w * s.h)
    if not outline.size_is(256, 340, tol=0.1):
        raise SystemExit(f"the sheet reads {outline.w:.2f} x {outline.h:.2f} mm, not 256 x 340: the scale is off")
    inner = [s for s in p3 if s is not outline]
    screw = [s for s in inner if s.circle and abs(s.diameter - 5) < 0.2]
    knob = [s for s in inner if s.circle and abs(s.diameter - 8) < 0.2]
    windows = [s for s in inner if not s.circle and s.size_is(60, 40)]
    slots = [s for s in inner if not s.circle and min(s.w, s.h) < 3]
    if len(screw) + len(knob) + len(windows) + len(slots) != len(inner):
        raise SystemExit("page 3 has a path this script does not know")
    if len(knob) != 4 or len(slots) != 3 or len(windows) != 4:
        raise SystemExit("page 3: expected four knob holes, four windows and three slots")
    # The rounded corners: how far the first straight edge starts from the corner.
    xs = sorted({round(x, 3) for x, y in outline.points if abs(y - outline.y0) < 1e-3})
    corner_r = xs[0] - outline.x0

    # Page 2: the panel's outline on the plate (the only rectangle about 160 x 320).
    panel = one(p2, "panel outline", lambda s: s.kinds == "re" and s.size_is(160, 320))

    # Page 4: the box's lid, drawn in red where the box sits.
    red = [s for s in p4 if s.color[0] > 0.5 and s.color[2] < 0.5]
    lid_placed = one(red, "box outline on page 4", lambda s: s.size_is(70, 130))

    # Page 1: the strips, 16 mm wide.
    strips = [s for s in p1 if s.kinds == "re" and abs(min(s.w, s.h) - 16) < 0.2]
    long_strips = [s for s in strips if max(s.w, s.h) > 300]
    short_strips = [s for s in strips if max(s.w, s.h) < 200]
    if len(long_strips) != 2 or len(short_strips) != 2:
        raise SystemExit("page 1: expected two long and two short strips")

    # Page 5: the box and a foot, told apart by size and shape.
    parts = [s for s in p5 if s.color[0] > 0.5]
    lid = one(parts, "lid", lambda s: s.size_is(70, 130))
    if sorted(map(_rounded, lid.local())) != sorted(map(_rounded, lid_placed.local())):
        raise SystemExit("the lid on page 5 is not the outline page 4 places")
    long_walls = [s for s in parts if s.size_is(130, s.h) and s.h < 40]
    short_walls = [s for s in parts if s.size_is(70, s.h) and s.h < 40]
    squares = [s for s in parts if s.size_is(30, 30)]
    if len(long_walls) != 2 or len(short_walls) != 2 or len(squares) != 5:
        raise SystemExit("page 5: expected a lid, two long walls, two short walls and five squares")
    # The joints' depth: how far the lid's edge steps in between its fingers.
    joint = min(x for x, y in lid.local() if x > 0.1)
    depth = min(s.h for s in long_walls)  # the long wall with no key is the box's depth
    keyed_long = one(long_walls, "keyed long wall", lambda s: s.h > depth + 1)
    plain_long = one(long_walls, "long wall without a key", lambda s: s.h < depth + 1)
    # Of the two short walls, the one with a cable notch has a corner well inside its outline.
    def notched(s: Shape) -> bool:
        return any(5 < x < s.w - 5 and 5 < y < s.h - 5 for x, y in s.local())

    bottom_wall = one(short_walls, "short wall with a notch", notched)
    top_wall = one(short_walls, "short wall without a notch", lambda s: not notched(s))
    # The base has fingers on all four sides, so no straight run of its outline
    # is longer than a finger; a side's open edge is straight. The sides whose
    # outline reaches both lower corners of their box carry the cube's corners,
    # the other two sit between them.
    def longest_run(s: Shape) -> float:
        pts = s.local()
        return max(math.dist(pts[i - 1], pts[i]) for i in range(len(pts)))

    def reaches(s: Shape, x: float, y: float) -> bool:
        return any(abs(px - x) < 1e-3 and abs(py - y) < 1e-3 for px, py in s.local())

    base = one(squares, "foot base", lambda s: longest_run(s) < s.w / 3)
    corner_sides = [s for s in squares if s is not base and reaches(s, 0, s.h) and reaches(s, s.w, s.h)]
    between_sides = [s for s in squares if s is not base and s not in corner_sides]
    if len(corner_sides) != 2 or len(between_sides) != 2:
        raise SystemExit("page 5: could not tell the foot's sides apart")

    return {
        "outline": outline, "corner_r": corner_r, "screw": screw, "knob": knob, "windows": windows, "slots": slots,
        "panel": panel, "lid_placed": lid_placed, "long_strips": long_strips, "short_strips": short_strips,
        "lid": lid, "joint": joint, "depth": depth, "keyed_long": keyed_long, "plain_long": plain_long,
        "top_wall": top_wall, "bottom_wall": bottom_wall, "base": base, "corner_sides": corner_sides,
        "between_sides": between_sides,
    }


def _rounded(p):
    return (round(p[0], 2), round(p[1], 2))


# --------------------------------------------------------------------------
# Building the parts


class Frame:
    """Page coordinates (mm, y down, the plate seen from the front) and depth behind the plate, to the model frame (mm)."""

    def __init__(self, plate: Shape):
        self.xc, self.yc = plate.centre
        self.y_mid = OFFICIAL_LED_Y / MODEL
        self.front = OFFICIAL_FRONT_Z / MODEL
        self.back = self.front - SHEET

    def at(self, x: float, y: float, depth: float = 0.0) -> np.ndarray:
        """A page point `depth` mm behind the plate's back face (negative: in front of it)."""
        return np.array([x - self.xc, self.y_mid - (y - self.yc), self.back - depth])

    # Page directions as model directions.
    RIGHT = np.array([1.0, 0, 0])  # page +x
    DOWN = np.array([0, -1.0, 0])  # page +y
    BACK = np.array([0, 0, -1.0])  # away from the viewer, behind the plate
    FRONT = -BACK


def part(ring, thickness: float, origin, eu, ev, ew, holes=()) -> tuple[trimesh.Trimesh, np.ndarray]:
    """A flat part: its outline (u, v), extruded `thickness` along w, placed by origin + u*eu + v*ev + w*ew (mm)."""
    poly = orient(Polygon(ring, holes), sign=1.0)
    if not poly.is_valid:
        raise SystemExit("a part's outline is not a valid polygon")
    mesh = trimesh.creation.extrude_polygon(poly, thickness, engine="earcut")
    m = np.eye(4)
    m[:3, 0], m[:3, 1], m[:3, 2], m[:3, 3] = eu, ev, ew, origin
    mesh.apply_transform(m)
    return mesh, np.asarray(ew, dtype=float)


def build(dims: dict) -> tuple[dict, dict]:
    """Every part of the shell, by node name: [(mesh, its thickness axis)], plus the placement."""
    F = Frame(dims["outline"])
    R, D, B, Fr = Frame.RIGHT, Frame.DOWN, Frame.BACK, Frame.FRONT
    nodes: dict[str, list] = {}
    joint, depth = dims["joint"], dims["depth"]

    # The plate: as drawn, front face toward the viewer.
    holes = [s.ring() for s in dims["screw"] + dims["knob"] + dims["windows"] + dims["slots"]]
    nodes["plate"] = [part(dims["outline"].points, SHEET, F.at(0, 0, -SHEET), R, D, B, holes)]

    # The strips, on edge on the front face. Each starts flush with one corner
    # of the panel and runs past the next, the top one to the left, the left
    # one down, and so on round (anticlockwise, seen from the front).
    p = dims["panel"]
    long_len = max(dims["long_strips"][0].w, dims["long_strips"][0].h)
    short_len = max(dims["short_strips"][0].w, dims["short_strips"][0].h)
    strip_h = min(dims["long_strips"][0].w, dims["long_strips"][0].h)
    on_face = -SHEET  # depth of the plate's front face
    strips = {
        # name: (start corner on the page, along, thickness direction, length)
        "strip_left": ((p.x0 - SHEET, p.y0), D, R, long_len),
        "strip_top": ((p.x1, p.y0 - SHEET), -R, D, short_len),
        "strip_right": ((p.x1, p.y1), -D, R, long_len),
        "strip_bottom": ((p.x0, p.y1), R, D, short_len),
    }
    for name, ((x, y), along, thick, length) in strips.items():
        # u is the strip's width, standing up off the face; v runs its length.
        ring = [(0, 0), (strip_h, 0), (strip_h, length), (0, length)]
        nodes[name] = [part(ring, SHEET, F.at(x, y, on_face), Fr, along, thick)]

    # The box, behind the plate where page 4 draws its lid. Each wall's lid
    # edge (the one with the most fingers, at the bottom of page 5) lies on
    # the lid's outer face, `depth` behind the plate; its key, if it has one,
    # is in the plate's slot.
    lp = dims["lid_placed"]
    bx0, by0, bx1, by1 = lp.x0, lp.y0, lp.x1, lp.y1

    def wall(shape: Shape, start, along, inward):
        top = depth - shape.h  # depth of the drawing's top edge: negative with a key, inside the slot
        return [part(shape.local(), joint, F.at(*start, top), along, B, inward)]

    nodes["box_wall_top"] = wall(dims["top_wall"], (bx0, by0), R, D)
    nodes["box_wall_bottom"] = wall(dims["bottom_wall"], (bx1, by1), -R, -D)
    nodes["box_wall_left"] = wall(dims["plain_long"], (bx0, by0), D, R)
    nodes["box_wall_right"] = wall(dims["keyed_long"], (bx1, by0), D, -R)
    nodes["box_lid"] = [part(lp.local(), joint, F.at(bx0, by0, depth - joint), R, D, B)]

    # The feet: open cubes in the plate's three corners the box does not hold.
    side = dims["base"].w
    ox0, oy0 = dims["outline"].x0 + FOOT_INSET, dims["outline"].y0 + FOOT_INSET
    ox1, oy1 = dims["outline"].x1 - FOOT_INSET - side, dims["outline"].y1 - FOOT_INSET - side
    corners = [(ox0, oy0), (ox0, oy1), (ox1, oy1)]  # top left, bottom left, bottom right
    a, b = dims["between_sides"], dims["corner_sides"]
    for i, (fx, fy) in enumerate(corners, start=1):
        nodes[f"foot_{i}"] = [
            part(dims["base"].local(), joint, F.at(fx, fy, side - joint), R, D, B),
            # The two sides between the corners: on the cube's left and right.
            part(a[0].local(), joint, F.at(fx, fy, 0), D, B, R),
            part(a[1].local(), joint, F.at(fx + side, fy, 0), D, B, -R),
            # The two that carry the corners: top and bottom.
            part(b[0].local(), joint, F.at(fx, fy, 0), R, B, D),
            part(b[1].local(), joint, F.at(fx, fy + side, 0), R, B, -D),
        ]

    # Where assemble.mjs puts the rest, in model units.
    kx = sum(s.centre[0] for s in dims["knob"]) / 4
    ky = sum(s.centre[1] for s in dims["knob"]) / 4
    knob_centre = F.at(kx, ky) * MODEL
    led = F.at(*p.centre, -SHEET) * MODEL
    placement = {
        "board": [
            round(knob_centre[0] - OFFICIAL_ENCODER_CENTRE[0], 4),
            round(knob_centre[1] - OFFICIAL_ENCODER_CENTRE[1], 4),
            round(F.back * MODEL - OFFICIAL_INSIDE_Z, 4),
        ],
        "led": [round(led[0], 4), round(led[1], 4), round(led[2] + LED_DEPTH, 4)],
        "knobs": "official",
        "knobBaseZ": round(F.front * MODEL + KNOB_LIFT, 4),
    }
    return nodes, placement


# --------------------------------------------------------------------------
# Writing the shell


def primitives(pieces, face_material: str, edge_material: str) -> list[tuple[str, np.ndarray, np.ndarray, np.ndarray]]:
    """A part's triangles as two flat-shaded primitives: its sheet faces and its cut edges."""
    groups: dict[str, list] = {face_material: [], edge_material: []}
    for mesh, axis in pieces:
        normals = mesh.face_normals
        is_face = np.abs(normals @ axis) > 0.999
        tris = mesh.vertices[mesh.faces] * MODEL
        for mat, mask in ((face_material, is_face), (edge_material, ~is_face)):
            groups[mat].append((tris[mask], normals[mask]))
    out = []
    for mat, chunks in groups.items():
        tris = np.concatenate([t for t, _ in chunks])
        norms = np.concatenate([n for _, n in chunks])
        corner_pos = tris.reshape(-1, 3)
        corner_nrm = np.repeat(norms, 3, axis=0)
        # One vertex per position and normal: shared within a flat face, split between faces.
        key = np.round(np.hstack([corner_pos, corner_nrm]), 6)
        _, first, inverse = np.unique(key, axis=0, return_index=True, return_inverse=True)
        pos = corner_pos[first].astype(np.float32)
        nrm = corner_nrm[first].astype(np.float32)
        idx = inverse.reshape(-1).astype(np.uint32)
        out.append((mat, pos, nrm, idx))
    return out


def write_glb(path: Path, nodes: dict[str, list[tuple[str, np.ndarray, np.ndarray, np.ndarray]]]) -> None:
    """A plain glTF 2.0 binary: one node per part, one mesh each, a primitive per material."""
    blob = bytearray()
    views, accessors, meshes, gl_nodes = [], [], [], []
    materials: list[str] = []

    def add_view(data: bytes, target: int) -> int:
        while len(blob) % 4:
            blob.append(0)
        views.append({"buffer": 0, "byteOffset": len(blob), "byteLength": len(data), "target": target})
        blob.extend(data)
        return len(views) - 1

    def add_accessor(array: np.ndarray, kind: str, component: int, target: int, bounds=False) -> int:
        acc = {"bufferView": add_view(array.tobytes(), target), "componentType": component, "count": len(array), "type": kind}
        if bounds:
            acc["min"] = [float(v) for v in array.min(axis=0)]
            acc["max"] = [float(v) for v in array.max(axis=0)]
        accessors.append(acc)
        return len(accessors) - 1

    for name, prims in nodes.items():
        gl_prims = []
        for mat, pos, nrm, idx in prims:
            if not len(idx):
                continue
            if mat not in materials:
                materials.append(mat)
            small = len(pos) < 65536
            gl_prims.append({
                "attributes": {
                    "POSITION": add_accessor(pos, "VEC3", 5126, 34962, bounds=True),
                    "NORMAL": add_accessor(nrm, "VEC3", 5126, 34962),
                },
                "indices": add_accessor(idx.astype(np.uint16 if small else np.uint32), "SCALAR", 5123 if small else 5125, 34963),
                "material": materials.index(mat),
                "mode": 4,
            })
        meshes.append({"name": name, "primitives": gl_prims})
        gl_nodes.append({"name": name, "mesh": len(meshes) - 1})

    while len(blob) % 4:
        blob.append(0)
    gltf = {
        "asset": {"version": "2.0", "generator": "patternflow tools/case-models/simonepda.py"},
        "scene": 0,
        "scenes": [{"name": "Scene", "nodes": list(range(len(gl_nodes)))}],
        "nodes": gl_nodes,
        "meshes": meshes,
        # The looks are set by name in lib/looks.mjs; these are placeholders.
        "materials": [{"name": m, "pbrMetallicRoughness": {"baseColorFactor": [1, 1, 1, 1], "metallicFactor": 0, "roughnessFactor": 0.5}} for m in materials],
        "accessors": accessors,
        "bufferViews": views,
        "buffers": [{"byteLength": len(blob)}],
    }
    text = json.dumps(gltf, separators=(",", ":")).encode()
    text += b" " * (-len(text) % 4)
    total = 12 + 8 + len(text) + 8 + len(blob)
    with open(path, "wb") as f:
        f.write(struct.pack("<4sII", b"glTF", 2, total))
        f.write(struct.pack("<I4s", len(text), b"JSON") + text)
        f.write(struct.pack("<I4s", len(blob), b"BIN\0") + bytes(blob))


def report(dims: dict) -> None:
    o, p, lp = dims["outline"], dims["panel"], dims["lid_placed"]
    slots = sorted(dims["slots"], key=lambda s: (s.y0, s.x0))
    kx = sorted({round(s.centre[0], 2) for s in dims["knob"]})
    ky = sorted({round(s.centre[1], 2) for s in dims["knob"]})
    print(f"sheet         {o.w:.2f} x {o.h:.2f} mm, corners r {dims['corner_r']:.2f}")
    print(f"panel         {p.w:.2f} x {p.h:.2f} mm, {p.x0 - o.x0:.2f} mm from the left edge, {p.y0 - o.y0:.2f} from the top")
    print(f"screw holes   {len(dims['screw'])} x d {np.mean([s.diameter for s in dims['screw']]):.2f} mm")
    print(f"knob holes    {len(dims['knob'])} x d {np.mean([s.diameter for s in dims['knob']]):.2f} mm on {kx[1] - kx[0]:.2f} x {ky[1] - ky[0]:.2f} mm")
    print(f"windows       {len(dims['windows'])} x {dims['windows'][0].w:.2f} x {dims['windows'][0].h:.2f} mm")
    print("slots         " + ", ".join(f"{min(s.w, s.h):.2f} x {max(s.w, s.h):.2f}" for s in slots) + " mm")
    print("strips        " + ", ".join(f"{min(s.w, s.h):.2f} x {max(s.w, s.h):.2f}" for s in dims["long_strips"] + dims["short_strips"]) + " mm")
    print(f"box           {lp.w:.2f} x {lp.h:.2f} x {dims['depth']:.2f} mm, joints {dims['joint']:.2f} deep, at ({lp.x0 - o.x0:.2f}, {lp.y0 - o.y0:.2f}) on the sheet")
    print(f"box walls     keyed {dims['keyed_long'].w:.2f} x {dims['keyed_long'].h:.2f}, plain {dims['plain_long'].w:.2f} x {dims['plain_long'].h:.2f}, "
          f"short {dims['top_wall'].w:.2f} x {dims['top_wall'].h:.2f} and {dims['bottom_wall'].w:.2f} x {dims['bottom_wall'].h:.2f} (notched) mm")
    print(f"feet          3 x open cube {dims['base'].w:.2f} mm (five squares)")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--pdf", type=Path, default=DEFAULT_PDF, help="the drawing (default: the remix folder's lasercut_layout.pdf)")
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT, help="where shell.glb and placement.json go (default: build/simonepda-lasercut)")
    args = ap.parse_args()

    dims = recover(read_pages(args.pdf))
    report(dims)
    parts, placement = build(dims)

    sheet = ("sheet_face", "sheet_edge")
    acrylic = ("acrylic_face", "acrylic_edge")
    nodes = {name: primitives(pieces, *(acrylic if name.startswith("box_") else sheet)) for name, pieces in parts.items()}

    args.out.mkdir(parents=True, exist_ok=True)
    write_glb(args.out / "shell.glb", nodes)
    (args.out / "placement.json").write_text(json.dumps(placement, indent=2) + "\n")
    tris = sum(len(idx) // 3 for prims in nodes.values() for _, _, _, idx in prims)
    print(f"wrote {args.out / 'shell.glb'} ({len(nodes)} parts, {tris} triangles) and placement.json: {json.dumps(placement)}")


if __name__ == "__main__":
    main()
