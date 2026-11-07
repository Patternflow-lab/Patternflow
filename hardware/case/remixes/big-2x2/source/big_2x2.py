# SPDX-License-Identifier: CC-BY-SA-4.0
"""Every cut file of the 2 x 2 case, from the numbers at the top of this file.

    python3 big_2x2.py            write parts/, sheets/, test_cuts/, preview/*.svg
    python3 big_2x2.py --check    read every DXF back and measure it
    python3 big_2x2.py --render   draw preview/sheets.png from the sheet DXFs (matplotlib)

Needs ezdxf (pip install ezdxf). Change a number, run it again, and every file
follows. The numbers that most often need changing are the first five: the
sheet thickness, and four measurements of your own panel.

Coordinates. The box is drawn from the front, upright, with the origin at the
centre of the display: X to the right, Y up, Z out of the display toward you,
so everything behind the panel face has a negative Z. A part's DXF is that part
laid flat. Walls are drawn with Y (or X) across and depth down the page.
"""

from __future__ import annotations

import math
import os
import sys
from dataclasses import dataclass, field

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

# --------------------------------------------------------------------------
# Measure these first
# --------------------------------------------------------------------------

T = 3.0                    # plywood thickness. Measure the sheet, not the label
PANEL_BODY = (159.8, 319.8)  # one panel's outline, portrait (simonepda drawing, page 6)
PANEL_DEPTH = 14.0         # front of the LEDs to the face the screws go into
PANEL_PITCH = (160.0, 320.0)  # 64 and 128 LEDs at 2.5 mm: where the panels sit
PANEL_SCREWS = [(sx * 68.5, sy * y) for y in (122.5, 31.5) for sx in (-1, 1) for sy in (-1, 1)]
PANEL_PINS = [(sx * 68.5, sy * 70.0) for sx in (-1, 1) for sy in (-1, 1)]  # 2 of these 4 are real

# --------------------------------------------------------------------------
# Derived and chosen
# --------------------------------------------------------------------------

BED = (480.0, 270.0)       # every part fits this bed (Glowforge class)
SHEET = (600.0, 300.0)     # what sheets/ nests onto
GAP = 4.0                  # between parts on a sheet

CLEAR = 0.35               # each side of the panels in the aperture
# Panel centres: (+-80, +-160). Outer body edge = half a pitch + half the body.
_body_edge_x = PANEL_PITCH[0] / 2 + PANEL_BODY[0] / 2
_body_edge_y = PANEL_PITCH[1] / 2 + PANEL_BODY[1] / 2
AP_X = round(_body_edge_x + CLEAR, 3)   # aperture half-width  (160.25)
AP_Y = round(_body_edge_y + CLEAR, 3)   # aperture half-height (320.25)

X_L, X_R = -174.0, 284.0   # outer edges of the bezel and the back cover
Y_B, Y_T = -334.0, 334.0
INSET = T                  # walls stand this far inside the outer edge

LEFT_WALL = (X_L + INSET, X_L + INSET + T)        # (-171, -168)
RIGHT_WALL = (X_R - INSET - T, X_R - INSET)       # (278, 281)
DIVIDER = (166.0, 166.0 + T)                      # between display and column
TOP_WALL = (Y_T - INSET - T, Y_T - INSET)         # (328, 331)
BOT_WALL = (Y_B + INSET, Y_B + INSET + T)         # (-331, -328)

# Depth, as distance behind the panel face (positive numbers).
D_BEZEL = 2 * T            # outer + inner bezel layer
D_WALL_BACK = 62.0         # back edge of the walls; the back cover is behind it
D_RAIL = (PANEL_DEPTH, PANEL_DEPTH + 2 * T)       # rails: two layers on the screw faces
D_STIFF = (42.0, D_WALL_BACK)                     # back stiffeners
BLOCK = 20.0               # screw block, 3 layers
BLOCK_LAYERS = 3

PANEL_CENTRES = [(-80.0, 160.0), (80.0, 160.0), (-80.0, -160.0), (80.0, -160.0)]
RAILS = {  # centre X, width
    "left": (-148.5, 30.0),
    "middle": (0.0, 50.0),
    "right": (148.5, 30.0),
}
RAIL_TAB = 16.0
RAIL_SPLITS = {"front": 100.0, "back": -100.0}    # staggered, so a rail is one piece once glued
WALL_SPLIT = 60.0          # the long walls and the divider are cut in two here

SCREW_SLOT = (5.0, 9.0)    # M4 clamp slot, long in Y
PIN_HOLE = 3.6             # for the panels' 3.48 mm pins
KNOB_BORE = 7.3            # EC11 bushing (M7)
M3_HOLE = 3.4

# Knobs: the v3 board's encoders, 31 x 30.5 mm apart (hardware/pcb/kicad).
KNOB_CENTRE = (225.0, 280.0)
KNOBS = {  # front view; K2 is top-left as in BUILD_GUIDE
    "K2": (KNOB_CENTRE[0] - 15.5, KNOB_CENTRE[1] + 15.25),
    "K1": (KNOB_CENTRE[0] + 15.5, KNOB_CENTRE[1] + 15.25),
    "K4": (KNOB_CENTRE[0] - 15.5, KNOB_CENTRE[1] - 15.25),
    "K3": (KNOB_CENTRE[0] + 15.5, KNOB_CENTRE[1] - 15.25),
}
KNOB_POCKET = 52.0         # square, in the inner bezel layer, so the bushings clamp one sheet
# Board outline in the front view: the encoders are fitted from the back of the
# PCB, so the front view is the KiCad view mirrored. 62 x 116.25 mm.
BOARD = (KNOB_CENTRE[0] - 38.75, KNOB_CENTRE[1] - 92.75, KNOB_CENTRE[0] + 23.25, KNOB_CENTRE[1] + 23.5)
J1_FRONT = (BOARD[0] + 62 - 53.96, BOARD[3] - 56.59)   # HUB75 header
J4_FRONT = (BOARD[0] + 62 - 6.13, BOARD[3] - 106.86)   # power in

# Supply (Mean Well LRS-150F-5, 159 x 97 x 30) on the power tray, terminals down.
PSU = (175.0, -255.0, 272.0, -96.0)
PSU_HOLES = [(x, PSU[1] + d) for d in (24.0, 102.0) for x in (PSU[0] + 32.0, PSU[2] - 32.0)]
# IEC C14 inlet with switch and fuse (AC-14-F16A): cut-out and flange screws as
# measured for patternflood.
IEC_CUT = (27.25, 46.75)
IEC_CENTRE = (225.0, -290.0)
IEC_SCREW_PITCH = 40.0
BUS = [(201.0, -52.5), (247.0, -52.5)]   # two 6-way barrier strips, +5 V and GND
BUS_SLOT_PITCH = 64.0

STIFF_Y = [111.333, -111.333]
DIV_WINDOWS = [(215.0, 275.0), (-70.0, -20.0)]   # HUB75 ribbon, panel power leads
WINDOW_DEPTH = (20.0, 50.0)

# --------------------------------------------------------------------------
# Geometry helpers
# --------------------------------------------------------------------------


@dataclass
class Shape:
    """A closed outline or hole in part coordinates."""
    kind: str                     # "poly" or "circle"
    pts: list = field(default_factory=list)
    centre: tuple = (0.0, 0.0)
    r: float = 0.0
    layer: str = "CUT"


def poly(pts, layer="CUT"):
    return Shape("poly", pts=[(round(x, 3), round(y, 3)) for x, y in pts], layer=layer)


def rect(x0, y0, x1, y1, layer="CUT"):
    return poly([(x0, y0), (x1, y0), (x1, y1), (x0, y1)], layer)


def circle(cx, cy, d, layer="CUT"):
    return Shape("circle", centre=(round(cx, 3), round(cy, 3)), r=d / 2, layer=layer)


def obround(cx, cy, w, h, n=8):
    """A slot w wide and h long, long axis along Y if h > w."""
    if h < w:
        pts = obround(cy, cx, h, w, n).pts
        return poly([(y, x) for x, y in pts][::-1])
    r = w / 2
    top, bot = cy + h / 2 - r, cy - h / 2 + r
    pts = []
    for i in range(n + 1):
        a = math.pi * i / n
        pts.append((cx + r * math.cos(a), top + r * math.sin(a)))
    for i in range(n + 1):
        a = math.pi + math.pi * i / n
        pts.append((cx + r * math.cos(a), bot + r * math.sin(a)))
    return poly(pts)


def tabbed(u0, v0, u1, v1, d=T, bottom=(), right=(), top=(), left=()):
    """Rectangle with tabs d long on any side. Tabs are (a, b) along that side."""
    p = [(u0, v0)]
    for a, b in sorted(bottom):
        p += [(a, v0), (a, v0 - d), (b, v0 - d), (b, v0)]
    p.append((u1, v0))
    for a, b in sorted(right):
        p += [(u1, a), (u1 + d, a), (u1 + d, b), (u1, b)]
    p.append((u1, v1))
    for a, b in sorted(top, reverse=True):
        p += [(b, v1), (b, v1 + d), (a, v1 + d), (a, v1)]
    p.append((u0, v1))
    for a, b in sorted(left, reverse=True):
        p += [(u0, b), (u0 - d, b), (u0 - d, a), (u0, a)]
    out = []
    for q in p:
        if not out or (abs(out[-1][0] - q[0]) > 1e-9 or abs(out[-1][1] - q[1]) > 1e-9):
            out.append(q)
    return poly(out)


def vent_row(u0, u1, v0, v1, pitch=12.0, w=4.0):
    """Slots w wide running v0..v1, every pitch along u0..u1."""
    out = []
    n = int((u1 - u0 - w) // pitch) + 1
    start = u0 + ((u1 - u0) - ((n - 1) * pitch + w)) / 2
    for i in range(n):
        x = start + i * pitch
        out.append(obround(x + w / 2, (v0 + v1) / 2, w, v1 - v0))
    return out


def vent_row_h(u0, u1, v0, v1, pitch=12.0, w=4.0):
    """The same, slots running along u, stacked in v."""
    out = []
    n = int((v1 - v0 - w) // pitch) + 1
    start = v0 + ((v1 - v0) - ((n - 1) * pitch + w)) / 2
    for i in range(n):
        y = start + i * pitch
        out.append(obround((u0 + u1) / 2, y + w / 2, u1 - u0, w))
    return out


@dataclass
class Part:
    name: str
    qty: int
    what: str
    shapes: list            # first shape is the outline

    def bbox(self):
        xs, ys = [], []
        for s in self.shapes:
            if s.kind == "poly":
                xs += [p[0] for p in s.pts]
                ys += [p[1] for p in s.pts]
            else:
                xs += [s.centre[0] - s.r, s.centre[0] + s.r]
                ys += [s.centre[1] - s.r, s.centre[1] + s.r]
        return min(xs), min(ys), max(xs), max(ys)

    def size(self):
        x0, y0, x1, y1 = self.bbox()
        return x1 - x0, y1 - y0


def overlaps(a0, a1, b0, b1):
    return a0 < b1 and b0 < a1


# --------------------------------------------------------------------------
# Joints shared by two parts
# --------------------------------------------------------------------------

# Front tabs of the walls go into the inner bezel layer. Positions along the wall.
SIDE_FRONT_TABS = [(-290, -270), (-210, -190), (-110, -90), (-10, 10), (80, 100), (200, 220), (280, 300)]
TOPBOT_FRONT_TABS = [(-140, -120), (-60, -40), (20, 40), (100, 120), (195, 215), (240, 260)]
# End tabs of the side walls and divider go through the top and bottom walls.
END_TABS_D = [(24.0, 32.0), (40.0, 52.0)]          # depth ranges
STIFF_TAB_D = (47.0, 57.0)


def side_wall_tabs_in(lo, hi):
    return [(a, b) for a, b in SIDE_FRONT_TABS if a >= lo and b <= hi]


# --------------------------------------------------------------------------
# Parts
# --------------------------------------------------------------------------


def bezel_parts():
    parts = []
    # Outer layer: the face you see. Its joints are at the corners of the
    # column and across the middle, where the panels have their own seam.
    outer = {
        "bezel-outer-top": (X_L, AP_Y, AP_X, Y_T),
        "bezel-outer-bottom": (X_L, Y_B, AP_X, -AP_Y),
        "bezel-outer-left-upper": (X_L, 0.0, -AP_X, AP_Y),
        "bezel-outer-left-lower": (X_L, -AP_Y, -AP_X, 0.0),
        "bezel-outer-column-upper": (AP_X, 0.0, X_R, Y_T),
        "bezel-outer-column-lower": (AP_X, Y_B, X_R, 0.0),
    }
    for name, (x0, y0, x1, y1) in outer.items():
        shapes = [rect(x0, y0, x1, y1)]
        if name == "bezel-outer-column-upper":
            shapes += [circle(x, y, KNOB_BORE) for x, y in KNOBS.values()]
        parts.append(Part(name, 1, "Bezel, outer layer (the face)", shapes))

    # Inner layer: glued behind the outer one, joints staggered, and the
    # mortises for every wall's front tabs. The outer layer hides them.
    inner = {
        "bezel-inner-top": (X_L, AP_Y, X_R, Y_T),
        "bezel-inner-bottom": (X_L, Y_B, X_R, -AP_Y),
        "bezel-inner-left-1": (X_L, 160.0, -AP_X, AP_Y),
        "bezel-inner-left-2": (X_L, -160.0, -AP_X, 160.0),
        "bezel-inner-left-3": (X_L, -AP_Y, -AP_X, -160.0),
        "bezel-inner-column-1": (AP_X, 160.0, X_R, AP_Y),
        "bezel-inner-column-2": (AP_X, -160.0, X_R, 160.0),
        "bezel-inner-column-3": (AP_X, -AP_Y, X_R, -160.0),
    }
    for name, (x0, y0, x1, y1) in inner.items():
        shapes = [rect(x0, y0, x1, y1)]
        if name in ("bezel-inner-top", "bezel-inner-bottom"):
            wy = TOP_WALL if name.endswith("top") else BOT_WALL
            for a, b in TOPBOT_FRONT_TABS:
                shapes.append(rect(a, wy[0], b, wy[1]))
        else:
            walls = [LEFT_WALL] if "left" in name else [DIVIDER, RIGHT_WALL]
            for wx in walls:
                for a, b in side_wall_tabs_in(y0, y1):
                    shapes.append(rect(wx[0], a, wx[1], b))
        if name == "bezel-inner-column-1":
            h = KNOB_POCKET / 2
            shapes.append(rect(KNOB_CENTRE[0] - h, KNOB_CENTRE[1] - h, KNOB_CENTRE[0] + h, KNOB_CENTRE[1] + h))
        parts.append(Part(name, 1, "Bezel, inner layer (mortises)", shapes))
    return parts


def topbot_wall(name, which):
    # u = X, v = depth behind the panel face. Front tabs on the v = D_BEZEL edge.
    v0, v1 = D_BEZEL, D_WALL_BACK
    shapes = [tabbed(X_L, v0, X_R, v1, bottom=TOPBOT_FRONT_TABS)]
    for wx in (LEFT_WALL, DIVIDER, RIGHT_WALL):
        for a, b in END_TABS_D:
            shapes.append(rect(wx[0], a, wx[1], b))
    for cx, w in RAILS.values():
        shapes.append(rect(cx - RAIL_TAB / 2, D_RAIL[0], cx + RAIL_TAB / 2, D_RAIL[1]))
    # Vents: a chimney through the display bay and the column.
    shapes += vent_row(-138.0, 138.0, 26.0, 50.0)
    shapes += vent_row(182.0, 266.0, 26.0, 50.0)
    return Part(name, 1, f"{which} wall", shapes)


def side_wall(name, wx, lo, hi, kind):
    """A wall in the YZ plane, cut at WALL_SPLIT. u = Y, v = depth."""
    v0, v1 = D_BEZEL, D_WALL_BACK
    body_lo = max(lo, BOT_WALL[1])
    body_hi = min(hi, TOP_WALL[0])
    right = list(END_TABS_D) if body_hi == TOP_WALL[0] else []
    left = list(END_TABS_D) if body_lo == BOT_WALL[1] else []
    shapes = [tabbed(body_lo, v0, body_hi, v1, bottom=side_wall_tabs_in(body_lo, body_hi), right=right, left=left)]
    if kind in ("left", "divider"):
        for y in STIFF_Y:
            if body_lo < y < body_hi:
                shapes.append(rect(y - T / 2, STIFF_TAB_D[0], y + T / 2, STIFF_TAB_D[1]))
    if kind in ("divider", "right"):
        if body_lo < 0 < body_hi:
            shapes.append(rect(-T / 2, STIFF_TAB_D[0], T / 2, STIFF_TAB_D[1]))
    if kind == "divider":
        for a, b in DIV_WINDOWS:
            if body_lo < a and b < body_hi:
                shapes.append(rect(a, WINDOW_DEPTH[0], b, WINDOW_DEPTH[1]))
    return Part(name, 1, {"left": "Left wall", "right": "Right wall", "divider": "Divider"}[kind], shapes)


def wall_parts():
    parts = [topbot_wall("wall-top", "Top"), topbot_wall("wall-bottom", "Bottom")]
    for kind, wx in (("left", LEFT_WALL), ("divider", DIVIDER), ("right", RIGHT_WALL)):
        parts.append(side_wall(f"{'wall-' if kind != 'divider' else ''}{kind}-lower", wx, BOT_WALL[1], WALL_SPLIT, kind))
        parts.append(side_wall(f"{'wall-' if kind != 'divider' else ''}{kind}-upper", wx, WALL_SPLIT, TOP_WALL[0], kind))
    parts.append(Part("splice", 3, "Splice plate, glued inside across each wall's cut", [rect(0, 0, 60, 40)]))
    # Stiffeners behind the display bay carry the back cover's joints.
    for i, y in enumerate(STIFF_Y):
        s = tabbed(LEFT_WALL[1], D_STIFF[0], DIVIDER[0], D_STIFF[1], left=[STIFF_TAB_D], right=[STIFF_TAB_D])
        parts.append(Part(f"stiffener-display-{i + 1}", 1, "Back stiffener, display bay", [s]))
    s = tabbed(DIVIDER[1], D_STIFF[0], RIGHT_WALL[0], D_STIFF[1], left=[STIFF_TAB_D], right=[STIFF_TAB_D])
    parts.append(Part("stiffener-column", 1, "Back stiffener, column", [s]))
    return parts


def rail_holes(cx):
    """Screw slots and pin holes a rail at centre X = cx carries."""
    shapes = []
    for px, py in PANEL_CENTRES:
        for sx, sy in PANEL_SCREWS:
            if abs(px + sx - cx) < 26:
                shapes.append(obround(px + sx, py + sy, *SCREW_SLOT))
        for sx, sy in PANEL_PINS:
            if abs(px + sx - cx) < 26:
                shapes.append(circle(px + sx, py + sy, PIN_HOLE))
    return shapes


def rail_parts():
    parts = []
    for rname, (cx, w) in RAILS.items():
        holes = rail_holes(cx)
        for layer, split in RAIL_SPLITS.items():
            for lo, hi in ((BOT_WALL[1], split), (split, TOP_WALL[0])):
                top = [(cx - RAIL_TAB / 2, cx + RAIL_TAB / 2)] if hi == TOP_WALL[0] else []
                bottom = [(cx - RAIL_TAB / 2, cx + RAIL_TAB / 2)] if lo == BOT_WALL[1] else []
                shapes = [tabbed(cx - w / 2, lo, cx + w / 2, hi, top=top, bottom=bottom)]
                for h in holes:
                    if h.kind == "circle":
                        inside = lo < h.centre[1] < hi
                    else:
                        ys = [p[1] for p in h.pts]
                        inside = lo < min(ys) and max(ys) < hi
                    if inside:
                        shapes.append(h)
                end = "upper" if hi == TOP_WALL[0] else "lower"
                parts.append(Part(f"rail-{rname}-{layer}-{end}", 1,
                                  f"Rail, {rname}, {layer} layer", shapes))
    return parts


def block_centres():
    """Where the screw blocks sit, in the front view. Each one is a screw."""
    lw, dv, cv, rw = LEFT_WALL[1] + BLOCK / 2, DIVIDER[0] - BLOCK / 2, DIVIDER[1] + BLOCK / 2, RIGHT_WALL[0] - BLOCK / 2
    top, bot = TOP_WALL[0] - BLOCK / 2, BOT_WALL[1] + BLOCK / 2
    mid = (lw + dv) / 2
    s_hi_up = STIFF_Y[0] + T / 2 + BLOCK / 2
    s_hi_dn = STIFF_Y[0] - T / 2 - BLOCK / 2
    s_lo_up = STIFF_Y[1] + T / 2 + BLOCK / 2
    s_lo_dn = STIFF_Y[1] - T / 2 - BLOCK / 2
    c_up, c_dn = T / 2 + BLOCK / 2, -T / 2 - BLOCK / 2
    return {
        "back-display-upper": [(lw, top), (mid, top), (dv, top), (lw, s_hi_up), (mid, s_hi_up), (dv, s_hi_up)],
        "back-display-middle": [(lw, s_hi_dn), (mid, s_hi_dn), (dv, s_hi_dn), (lw, 0.0), (dv, 0.0),
                                (lw, s_lo_up), (mid, s_lo_up), (dv, s_lo_up)],
        "back-display-lower": [(lw, s_lo_dn), (mid, s_lo_dn), (dv, s_lo_dn), (lw, bot), (mid, bot), (dv, bot)],
        "back-column-upper": [(cv, top), (rw, top), (cv, 165.0), (rw, 165.0), (cv, c_up), (rw, c_up)],
        "back-column-lower": [(cv, c_dn), (rw, c_dn), (cv, -80.0), (rw, -80.0), (cv, bot), (rw, bot)],
    }


def back_parts():
    blocks = block_centres()
    split = (DIVIDER[0] + DIVIDER[1]) / 2
    pieces = {
        "back-display-upper": (X_L, STIFF_Y[0], split, Y_T),
        "back-display-middle": (X_L, STIFF_Y[1], split, STIFF_Y[0]),
        "back-display-lower": (X_L, Y_B, split, STIFF_Y[1]),
        "back-column-upper": (split, 0.0, X_R, Y_T),
        "back-column-lower": (split, Y_B, X_R, 0.0),
    }
    parts = []
    for name, (x0, y0, x1, y1) in pieces.items():
        shapes = [rect(x0, y0, x1, y1)]
        shapes += [circle(x, y, M3_HOLE) for x, y in blocks[name]]
        if name == "back-display-upper":
            shapes += vent_row(-120.0, 120.0, 270.0, 310.0)
        if name == "back-display-lower":
            shapes += vent_row(-120.0, 120.0, -310.0, -270.0)
        if name == "back-column-upper":
            shapes += vent_row(195.0, 255.0, 290.0, 315.0)
            shapes += vent_row(195.0, 255.0, 30.0, 150.0)
        if name == "back-column-lower":
            cx, cy = IEC_CENTRE
            w, h = IEC_CUT
            shapes.append(rect(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2))
            shapes += [circle(cx, cy + s * IEC_SCREW_PITCH / 2, M3_HOLE) for s in (-1, 1)]
            shapes += [circle(x, y, M3_HOLE) for x, y in PSU_HOLES]
            for bx, by in BUS:
                shapes += [obround(bx, by + s * BUS_SLOT_PITCH / 2, 3.6, 10.0) for s in (-1, 1)]
            shapes += vent_row(190.0, 206.0, -318.0, -268.0, pitch=8.0)
            shapes += vent_row(244.0, 260.0, -318.0, -268.0, pitch=8.0)
        what = "Power tray: the inlet, the supply and the 5 V bus" if name == "back-column-lower" else "Back cover"
        parts.append(Part(name, 1, what, shapes))
    n = sum(len(v) for v in blocks.values())
    parts.append(Part("screw-block", n * BLOCK_LAYERS,
                      f"Screw block, {BLOCK_LAYERS} glued per block, {n} blocks", [rect(0, 0, BLOCK, BLOCK)]))
    return parts


def cradle_parts():
    depth = D_WALL_BACK + T + 0.5        # the box, front to back, plus a little
    f, base, lip_f, lip_b, back = 60.0, 15.0, 10.0, 25.0, 60.0
    n0, n1 = f, f + depth
    L = n1 + back
    pts = [(0, 0), (L, 0), (L, base), (n1 + 20, base + lip_b), (n1, base + lip_b), (n1, base),
           (n0, base), (n0, base + lip_f), (20, base + lip_f), (0, base - 5)]
    return [Part("cradle", 6, "Cradle profile, 3 glued per cradle, 2 cradles", [poly(pts)])]


def test_cut_parts():
    parts = []
    # Kerf comb: slots T-0.2 .. T+0.2, left to right. Try a strip of the same sheet.
    widths = [T - 0.2, T - 0.1, T, T + 0.1, T + 0.2]
    shapes = [rect(0, 0, 80, 30)]
    for i, w in enumerate(widths):
        x = 8 + i * 15
        shapes.append(rect(x, 15, x + w, 30))
    shapes.append(circle(6, 6, 1.5))      # marks the T-0.2 end
    parts.append(Part("test-01-kerf-comb", 1, "Slot widths T-0.2 to T+0.2, the small hole marks the narrow end", shapes))
    # The knob bores on the board's grid: push the real board through it.
    k = [(x - KNOB_CENTRE[0] + 30, y - KNOB_CENTRE[1] + 30) for x, y in KNOBS.values()]
    parts.append(Part("test-02-knob-bores", 1, "The four knob bores; press the board's encoders through",
                      [rect(0, 0, 60, 60)] + [circle(x, y, KNOB_BORE) for x, y in k]))
    # One panel's rail holes: screw it to a real panel before cutting rails.
    shapes = [rect(-15, -165, 15, 165)]
    for sx, sy in PANEL_SCREWS:
        if sx > 0:
            shapes.append(obround(0, sy, *SCREW_SLOT))
    for sx, sy in PANEL_PINS:
        if sx > 0:
            shapes.append(circle(0, sy, PIN_HOLE))
    parts.append(Part("test-03-panel-rail", 1, "One long side of a panel: screw slots and pin holes", shapes))
    # Inlet cut-out and flange screws.
    w, h = IEC_CUT
    shapes = [rect(-35, -40, 35, 40), rect(-w / 2, -h / 2, w / 2, h / 2)]
    shapes += [circle(0, s * IEC_SCREW_PITCH / 2, M3_HOLE) for s in (-1, 1)]
    parts.append(Part("test-04-inlet", 1, "IEC inlet cut-out and flange screws", shapes))
    return parts


def all_parts():
    return bezel_parts() + wall_parts() + rail_parts() + back_parts() + cradle_parts()


# --------------------------------------------------------------------------
# Output
# --------------------------------------------------------------------------


def to_origin(part):
    x0, y0, _, _ = part.bbox()
    out = []
    for s in part.shapes:
        if s.kind == "poly":
            out.append(Shape("poly", pts=[(round(x - x0, 3), round(y - y0, 3)) for x, y in s.pts], layer=s.layer))
        else:
            out.append(Shape("circle", centre=(round(s.centre[0] - x0, 3), round(s.centre[1] - y0, 3)), r=s.r, layer=s.layer))
    return out


def rotate90(shapes, h):
    """Rotate a part laid at the origin by 90 degrees, keeping it at the origin."""
    out = []
    for s in shapes:
        if s.kind == "poly":
            out.append(Shape("poly", pts=[(round(h - y, 3), round(x, 3)) for x, y in s.pts], layer=s.layer))
        else:
            out.append(Shape("circle", centre=(round(h - s.centre[1], 3), round(s.centre[0], 3)), r=s.r, layer=s.layer))
    return out


def write_dxf(path, placed):
    import ezdxf
    ezdxf.options.write_fixed_meta_data_for_testing = True   # same numbers, same bytes
    doc = ezdxf.new("R2000", setup=True)
    doc.units = ezdxf.units.MM
    doc.header["$INSUNITS"] = 4
    doc.header["$MEASUREMENT"] = 1
    if "CUT" not in doc.layers:
        doc.layers.add("CUT", color=1)
    msp = doc.modelspace()
    for shapes, dx, dy in placed:
        for s in shapes:
            if s.kind == "poly":
                msp.add_lwpolyline([(x + dx, y + dy) for x, y in s.pts], close=True, dxfattribs={"layer": s.layer})
            else:
                msp.add_circle((s.centre[0] + dx, s.centre[1] + dy), s.r, dxfattribs={"layer": s.layer})
    doc.saveas(path)


def svg_shapes(placed, stroke="#d0021b", sw=0.35, fill="none", flip_h=None):
    out = []
    for shapes, dx, dy in placed:
        for s in shapes:
            if s.kind == "poly":
                d = " ".join(f"{x + dx:.2f},{flip_h - (y + dy):.2f}" for x, y in s.pts)
                out.append(f'<polygon points="{d}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>')
            else:
                out.append(f'<circle cx="{s.centre[0] + dx:.2f}" cy="{flip_h - (s.centre[1] + dy):.2f}" '
                           f'r="{s.r:.2f}" fill="none" stroke="{stroke}" stroke-width="{sw}"/>')
    return out


def nest(parts, sheet=SHEET, gap=GAP):
    """Shelf packing, tallest first. Returns sheets of (part name, shapes, dx, dy)."""
    items = []
    for p in parts:
        base = to_origin(p)
        w, h = p.size()
        for i in range(p.qty):
            sh, sw_, hh = base, w, h
            # Lie long parts along the sheet's long side.
            if hh > sw_ and hh <= sheet[0] - 2 * gap and sw_ <= sheet[1] - 2 * gap:
                sh, sw_, hh = rotate90(base, h), h, w
            items.append((p.name, sh, sw_, hh))
    items.sort(key=lambda it: (-it[3], -it[2]))
    sheets = []
    for name, sh, w, h in items:
        placed = False
        for s in sheets:
            for shelf in s["shelves"]:
                if h <= shelf["h"] and shelf["x"] + w <= sheet[0] - gap:
                    s["items"].append((name, sh, shelf["x"], shelf["y"]))
                    shelf["x"] += w + gap
                    placed = True
                    break
            if placed:
                break
            if s["y"] + h <= sheet[1] - gap:
                shelf = {"y": s["y"], "h": h, "x": gap + w + gap}
                s["shelves"].append(shelf)
                s["items"].append((name, sh, gap, s["y"]))
                s["y"] += h + gap
                placed = True
                break
        if not placed:
            s = {"shelves": [{"y": gap, "h": h, "x": gap + w + gap}], "items": [(name, sh, gap, gap)], "y": gap + h + gap}
            sheets.append(s)
    return [s["items"] for s in sheets]


def write_all():
    try:
        import ezdxf
        del ezdxf
    except ImportError:
        sys.exit("big_2x2.py needs ezdxf: pip install ezdxf")
    parts = all_parts()
    tests = test_cut_parts()
    for sub in ("parts", "sheets", "test_cuts", "preview"):
        os.makedirs(os.path.join(ROOT, sub), exist_ok=True)
    for p in parts:
        write_dxf(os.path.join(ROOT, "parts", f"{p.name}.dxf"), [(to_origin(p), 0, 0)])
    for p in tests:
        write_dxf(os.path.join(ROOT, "test_cuts", f"{p.name}.dxf"), [(to_origin(p), 0, 0)])
    # Test cuts on one small sheet.
    tsheets = nest(tests, sheet=(400.0, 360.0))
    write_dxf(os.path.join(ROOT, "test_cuts", "all-test-cuts.dxf"), [(sh, dx, dy) for _, sh, dx, dy in tsheets[0]])
    sheets = nest(parts)
    for i, items in enumerate(sheets, 1):
        placed = [(sh, dx, dy) for _, sh, dx, dy in items]
        write_dxf(os.path.join(ROOT, "sheets", f"sheet-{i:02d}.dxf"), placed)
    write_sheets_svg(sheets)
    write_front_svg()
    write_wiring_svg()
    write_manifest(parts, tests, sheets)
    print(f"{len(parts)} parts ({sum(p.qty for p in parts)} pieces) on {len(sheets)} sheets of "
          f"{SHEET[0]:.0f} x {SHEET[1]:.0f} mm, {len(tests)} test cuts")


def write_sheets_svg(sheets):
    cols = 2
    sw, sh = SHEET
    pad = 24
    rows = (len(sheets) + cols - 1) // cols
    W = cols * (sw + pad) + pad
    H = rows * (sh + pad + 14) + pad
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W:.0f} {H:.0f}" width="{W * 2:.0f}" height="{H * 2:.0f}" '
           f'font-family="Helvetica, Arial, sans-serif">',
           f'<rect width="{W:.0f}" height="{H:.0f}" fill="#ffffff"/>']
    for i, items in enumerate(sheets):
        ox = pad + (i % cols) * (sw + pad)
        oy = pad + (i // cols) * (sh + pad + 14) + 14
        out.append(f'<text x="{ox:.0f}" y="{oy - 5:.0f}" font-size="10" fill="#333">sheet-{i + 1:02d}.dxf</text>')
        out.append(f'<g transform="translate({ox:.0f},{oy:.0f})">')
        out.append(f'<rect width="{sw}" height="{sh}" fill="#f4ead8" stroke="#b9a37e" stroke-width="0.6"/>')
        out += svg_shapes([(s, dx, dy) for _, s, dx, dy in items], flip_h=sh)
        out.append("</g>")
    out.append("</svg>")
    with open(os.path.join(ROOT, "preview", "sheets.svg"), "w") as f:
        f.write("\n".join(out))


def write_front_svg():
    """The assembled box from the front, drawn from the same numbers as the parts."""
    m = 40
    W = (X_R - X_L) + 2 * m + 230
    H = (Y_T - Y_B) + 2 * m
    def X(x): return x - X_L + m
    def Y(y): return Y_T - y + m
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W:.0f} {H:.0f}" width="{W * 1.6:.0f}" height="{H * 1.6:.0f}" '
         f'font-family="Helvetica, Arial, sans-serif">',
         f'<rect width="{W:.0f}" height="{H:.0f}" fill="#ffffff"/>',
         # bezel
         f'<rect x="{X(X_L)}" y="{Y(Y_T)}" width="{X_R - X_L}" height="{Y_T - Y_B}" fill="#e9d9bb" stroke="#8a6d3b" stroke-width="1"/>']
    # bezel joints, outer layer
    for x0, y0, x1, y1 in ((AP_X, AP_Y, AP_X, Y_T), (AP_X, Y_B, AP_X, -AP_Y), (X_L, 0, -AP_X, 0), (AP_X, 0, X_R, 0)):
        o.append(f'<line x1="{X(x0)}" y1="{Y(y0)}" x2="{X(x1)}" y2="{Y(y1)}" stroke="#8a6d3b" stroke-width="0.6"/>')
    # panels
    names = {(80.0, 160.0): ("P0", "in from the board", 0), (80.0, -160.0): ("P1", "", 0),
             (-80.0, -160.0): ("P2", "turned 180°", 180), (-80.0, 160.0): ("P3", "turned 180°", 180)}
    bw, bh = PANEL_BODY
    for (cx, cy), (label, note, rot) in names.items():
        o.append(f'<rect x="{X(cx - bw / 2):.2f}" y="{Y(cy + bh / 2):.2f}" width="{bw}" height="{bh}" fill="#16161d" stroke="#000" stroke-width="0.4"/>')
        # a few LED rows, to read as a panel
        for k in range(1, 16):
            yy = cy - bh / 2 + k * bh / 16
            o.append(f'<line x1="{X(cx - bw / 2 + 4):.1f}" y1="{Y(yy):.1f}" x2="{X(cx + bw / 2 - 4):.1f}" y2="{Y(yy):.1f}" stroke="#2a2a36" stroke-width="0.8"/>')
        tx = cx - 10 if cx > 0 else cx + 10
        o.append(f'<text x="{X(tx):.1f}" y="{Y(cy) - 4:.1f}" font-size="22" fill="#f2f2f2" text-anchor="middle">{label}</text>')
        if note:
            o.append(f'<text x="{X(tx):.1f}" y="{Y(cy) + 16:.1f}" font-size="10" fill="#c8c8c8" text-anchor="middle">{note}</text>')
    # chain arrows (data flow, seen from the front)
    chain = [(J1_FRONT[0], J1_FRONT[1]), (128, 236), (128, -236), (-128, -236), (-128, 236)]
    pts = " ".join(f"{X(x):.1f},{Y(y):.1f}" for x, y in chain)
    o.append(f'<polyline points="{pts}" fill="none" stroke="#f5a623" stroke-width="2.2" stroke-dasharray="7 4" marker-end="url(#ar)"/>')
    o.insert(1, '<defs><marker id="ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">'
                '<path d="M0,0 L10,5 L0,10 z" fill="#f5a623"/></marker></defs>')
    # rails, behind
    for cx, w in RAILS.values():
        o.append(f'<rect x="{X(cx - w / 2):.1f}" y="{Y(TOP_WALL[0]):.1f}" width="{w}" height="{TOP_WALL[0] - BOT_WALL[1]}" '
                 f'fill="none" stroke="#4a90e2" stroke-width="0.8" stroke-dasharray="4 3"/>')
    # column contents, behind the bezel
    bx0, by0, bx1, by1 = BOARD
    o.append(f'<rect x="{X(bx0):.1f}" y="{Y(by1):.1f}" width="{bx1 - bx0:.2f}" height="{by1 - by0:.2f}" fill="none" stroke="#417505" stroke-width="1" stroke-dasharray="4 3"/>')
    o.append(f'<text x="{X((bx0 + bx1) / 2):.1f}" y="{Y(by0 + 30):.1f}" font-size="9" fill="#417505" text-anchor="middle">v3 board</text>')
    px0, py0, px1, py1 = PSU
    o.append(f'<rect x="{X(px0):.1f}" y="{Y(py1):.1f}" width="{px1 - px0}" height="{py1 - py0}" fill="none" stroke="#9013fe" stroke-width="1" stroke-dasharray="4 3"/>')
    o.append(f'<text x="{X((px0 + px1) / 2):.1f}" y="{Y((py0 + py1) / 2):.1f}" font-size="9" fill="#9013fe" text-anchor="middle">LRS-150F-5</text>')
    cx, cy = IEC_CENTRE
    o.append(f'<rect x="{X(cx - IEC_CUT[0] / 2):.1f}" y="{Y(cy + IEC_CUT[1] / 2):.1f}" width="{IEC_CUT[0]}" height="{IEC_CUT[1]}" fill="none" stroke="#9013fe" stroke-width="1" stroke-dasharray="4 3"/>')
    o.append(f'<text x="{X(cx):.1f}" y="{Y(cy - IEC_CUT[1] / 2 - 6):.1f}" font-size="8" fill="#9013fe" text-anchor="middle">inlet (back)</text>')
    # knobs
    for name, (x, y) in KNOBS.items():
        o.append(f'<circle cx="{X(x):.1f}" cy="{Y(y):.1f}" r="10" fill="#1d1d1d"/>')
        o.append(f'<text x="{X(x):.1f}" y="{Y(y) + 3:.1f}" font-size="8" fill="#fff" text-anchor="middle">{name}</text>')
    # dimensions
    def hdim(x0, x1, y, text):
        o.append(f'<line x1="{X(x0)}" y1="{Y(y)}" x2="{X(x1)}" y2="{Y(y)}" stroke="#555" stroke-width="0.6"/>')
        for x in (x0, x1):
            o.append(f'<line x1="{X(x)}" y1="{Y(y) - 5}" x2="{X(x)}" y2="{Y(y) + 5}" stroke="#555" stroke-width="0.6"/>')
        o.append(f'<text x="{(X(x0) + X(x1)) / 2}" y="{Y(y) - 4}" font-size="11" fill="#333" text-anchor="middle">{text}</text>')
    def vdim(y0, y1, x, text):
        o.append(f'<line x1="{X(x)}" y1="{Y(y0)}" x2="{X(x)}" y2="{Y(y1)}" stroke="#555" stroke-width="0.6"/>')
        for y in (y0, y1):
            o.append(f'<line x1="{X(x) - 5}" y1="{Y(y)}" x2="{X(x) + 5}" y2="{Y(y)}" stroke="#555" stroke-width="0.6"/>')
        tx, ty = X(x) - 6, (Y(y0) + Y(y1)) / 2
        o.append(f'<text x="{tx}" y="{ty}" font-size="11" fill="#333" text-anchor="middle" transform="rotate(-90 {tx} {ty})">{text}</text>')
    hdim(X_L, X_R, Y_T + 18, f"{X_R - X_L:.0f}")
    hdim(-PANEL_PITCH[0], PANEL_PITCH[0], Y_B - 18, "display 320")
    vdim(Y_B, Y_T, X_L - 18, f"{Y_T - Y_B:.0f}")
    # legend
    lx = X(X_R) + 24
    leg = [("#16161d", "Four 320 × 160 panels, 128 × 64 each"), ("#f5a623", "HUB75 chain: board → P0 → P1 → P2 → P3"),
           ("#4a90e2", "Rails behind the panels (screws, pins)"), ("#417505", "Board, encoders through the face"),
           ("#9013fe", "Supply and inlet on the power tray"), ("#8a6d3b", "Joints in the face layer")]
    for i, (c, t) in enumerate(leg):
        y = Y(Y_T) + 10 + i * 22
        o.append(f'<rect x="{lx}" y="{y}" width="12" height="12" fill="{c}"/>')
        o.append(f'<text x="{lx + 18}" y="{y + 10}" font-size="10" fill="#333">{t}</text>')
    o.append(f'<text x="{lx}" y="{Y(Y_T) + 10 + len(leg) * 22 + 14}" font-size="10" fill="#333">'
             f'Depth {D_WALL_BACK + T:.0f} mm. Front view, upright.</text>')
    o.append("</svg>")
    with open(os.path.join(ROOT, "preview", "front.svg"), "w") as f:
        f.write("\n".join(o))


def write_wiring_svg():
    W, H = 900, 430
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W * 1.6:.0f}" height="{H * 1.6:.0f}" '
         f'font-family="Helvetica, Arial, sans-serif" font-size="12">',
         f'<rect width="{W}" height="{H}" fill="#ffffff"/>',
         '<defs><marker id="a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">'
         '<path d="M0,0 L10,5 L0,10 z" fill="#333"/></marker></defs>']
    def box(x, y, w, h, title, sub="", fill="#f6f6f6", stroke="#333"):
        o.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="6" fill="{fill}" stroke="{stroke}" stroke-width="1.2"/>')
        o.append(f'<text x="{x + w / 2}" y="{y + h / 2 - (5 if sub else -4)}" text-anchor="middle" font-weight="bold">{title}</text>')
        if sub:
            o.append(f'<text x="{x + w / 2}" y="{y + h / 2 + 12}" text-anchor="middle" font-size="10" fill="#555">{sub}</text>')
    def wire(pts, color, label="", lx=None, ly=None, w=2.5, dash=""):
        d = " ".join(f"{x},{y}" for x, y in pts)
        da = f' stroke-dasharray="{dash}"' if dash else ""
        o.append(f'<polyline points="{d}" fill="none" stroke="{color}" stroke-width="{w}"{da}/>')
        if label:
            o.append(f'<text x="{lx}" y="{ly}" font-size="10" fill="{color}">{label}</text>')
    box(20, 170, 110, 60, "Mains", "100–240 VAC")
    box(170, 160, 140, 80, "IEC C14 inlet", "switch, fuse T3.15A", fill="#fdeaea", stroke="#b00020")
    box(350, 160, 150, 80, "LRS-150F-5", "5 V 22 A, trim to 5.1 V", fill="#f1e6fd", stroke="#7b1fa2")
    box(545, 150, 100, 100, "5 V bus", "two 6-way strips", fill="#fff6e0", stroke="#c77700")
    for i, name in enumerate(["P0", "P1", "P2", "P3"]):
        box(730, 20 + i * 70, 140, 52, f"Panel {name}", "4-pin power plug")
    box(700, 330, 170, 70, "v3 board", "J4 in · J3 left empty", fill="#eaf5e0", stroke="#417505")
    wire([(130, 200), (170, 200)], "#b00020")
    o.append('<text x="22" y="252" font-size="10" fill="#b00020">L, N and earth: 18 AWG, 300 V</text>')
    wire([(310, 200), (350, 200)], "#b00020")
    wire([(500, 200), (545, 200)], "#c77700", "14 AWG", 505, 190, w=4)
    for i in range(4):
        y = 46 + i * 70
        wire([(645, 200), (690, 200), (690, y), (730, y)], "#c77700", "16 AWG" if i == 0 else "", 650, y - 6, w=3)
    wire([(645, 230), (670, 230), (670, 365), (700, 365)], "#c77700", "20 AWG", 610, 300, w=1.6)
    # HUB75 chain
    o.append('<text x="20" y="300" font-weight="bold">HUB75</text>')
    wire([(785, 330), (785, 312), (893, 312), (893, 36), (870, 36)], "#1565c0", "", w=2, dash="6 3")
    for i in range(3):
        y0, y1 = 58 + i * 70, 20 + (i + 1) * 70 + 8
        o.append(f'<polyline points="870,{y0} 882,{y0} 882,{y1} 870,{y1}" fill="none" stroke="#1565c0" '
                 f'stroke-width="2" stroke-dasharray="6 3" marker-end="url(#b)"/>')
    o.append('<defs><marker id="b" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto">'
             '<path d="M0,0 L10,5 L0,10 z" fill="#1565c0"/></marker></defs>')
    o.append('<text x="20" y="320" font-size="11" fill="#1565c0">J1 → P0 IN, P0 OUT → P1 IN, P1 OUT → P2 IN, P2 OUT → P3 IN.</text>')
    o.append('<text x="20" y="338" font-size="11" fill="#1565c0">Four 16-way ribbons, 30 cm. Grounds meet at the bus.</text>')
    o.append('<text x="20" y="380" font-size="11" fill="#333">Earth from the inlet goes to the supply\'s FG terminal.</text>')
    o.append('<text x="20" y="398" font-size="11" fill="#333">No panel current goes through the board.</text>')
    o.append("</svg>")
    with open(os.path.join(ROOT, "preview", "wiring.svg"), "w") as f:
        f.write("\n".join(o))


def write_manifest(parts, tests, sheets):
    lines = ["part,qty,width_mm,height_mm,what"]
    for p in parts + tests:
        w, h = p.size()
        lines.append(f"{p.name},{p.qty},{w:.1f},{h:.1f},\"{p.what}\"")
    with open(os.path.join(ROOT, "parts", "manifest.csv"), "w") as f:
        f.write("\n".join(lines) + "\n")
    on_sheets = {}
    for i, items in enumerate(sheets, 1):
        for name, *_ in items:
            on_sheets.setdefault(name, []).append(i)
    with open(os.path.join(ROOT, "sheets", "manifest.csv"), "w") as f:
        f.write("part,sheets\n")
        for name in sorted(on_sheets):
            f.write(f"{name},{' '.join(str(s) for s in on_sheets[name])}\n")


# --------------------------------------------------------------------------
# Check: read every DXF back and measure it against the panel and the board
# --------------------------------------------------------------------------


def check():
    import ezdxf
    from ezdxf import bbox as ebbox
    bad = []
    def ok(cond, msg):
        print(("ok    " if cond else "FAIL  ") + msg)
        if not cond:
            bad.append(msg)

    files = sorted(f for f in os.listdir(os.path.join(ROOT, "parts")) if f.endswith(".dxf"))
    for f in files:
        doc = ezdxf.readfile(os.path.join(ROOT, "parts", f))
        auditor = doc.audit()
        b = ebbox.extents(doc.modelspace())
        w, h = b.size.x, b.size.y
        fits = (w <= BED[0] and h <= BED[1]) or (h <= BED[0] and w <= BED[1])
        if auditor.has_errors or not fits:
            ok(False, f"{f}: {w:.1f} x {h:.1f} mm, audit errors {len(auditor.errors)}")
    ok(True, f"{len(files)} part DXFs open, pass ezdxf's audit and fit a {BED[0]:.0f} x {BED[1]:.0f} bed")

    sheets = sorted(f for f in os.listdir(os.path.join(ROOT, "sheets")) if f.endswith(".dxf"))
    for f in sheets:
        doc = ezdxf.readfile(os.path.join(ROOT, "sheets", f))
        b = ebbox.extents(doc.modelspace())
        ok(b.extmin.x >= 0 and b.extmin.y >= 0 and b.extmax.x <= SHEET[0] and b.extmax.y <= SHEET[1],
           f"{f}: parts inside {SHEET[0]:.0f} x {SHEET[1]:.0f} ({b.size.x:.1f} x {b.size.y:.1f})")

    def load(name):
        return ezdxf.readfile(os.path.join(ROOT, "parts", f"{name}.dxf")).modelspace()

    def ext(name):
        b = ebbox.extents(load(name))
        return b.size.x, b.size.y

    # The aperture is what the outer bezel leaves open between its strips.
    top_w, top_h = ext("bezel-outer-top")
    left_w, left_h = ext("bezel-outer-left-upper")
    col_w, col_h = ext("bezel-outer-column-upper")
    ap_w = (X_R - X_L) - left_w - col_w
    ap_h = (Y_T - Y_B) - 2 * top_h
    need_w = PANEL_PITCH[0] + PANEL_BODY[0]
    need_h = PANEL_PITCH[1] + PANEL_BODY[1]
    ok(abs(ap_w - (need_w + 2 * CLEAR)) < 0.01 and abs(ap_h - (need_h + 2 * CLEAR)) < 0.01,
       f"aperture {ap_w:.2f} x {ap_h:.2f} mm from the bezel DXFs; two panels across and down measure "
       f"{need_w:.1f} x {need_h:.1f}, so {CLEAR} mm clear each side")
    ok(abs(2 * left_h - 2 * AP_Y) < 0.01, f"left strips together {2 * left_h:.2f} mm = aperture height")

    # Knob bores against the board's encoder pitch.
    circles = sorted((round(e.dxf.center.x, 2), round(e.dxf.center.y, 2), round(2 * e.dxf.radius, 2))
                     for e in load("bezel-outer-column-upper").query("CIRCLE"))
    xs = sorted({c[0] for c in circles})
    ys = sorted({c[1] for c in circles})
    ok(len(circles) == 4 and abs(xs[1] - xs[0] - 31.0) < 0.01 and abs(ys[1] - ys[0] - 30.5) < 0.01,
       f"knob bores: {len(circles)} at {xs[1] - xs[0]:.2f} x {ys[1] - ys[0]:.2f} mm, the v3 board's "
       f"SW1-SW4 pitch is 31.00 x 30.50 (KiCad)")

    # Rails: glue the two layers back together and compare with the panel's holes.
    for rname, (cx, w) in RAILS.items():
        found_s, found_p = [], []
        for end in ("lower", "upper"):
            name = f"rail-{rname}-front-{end}"
            part = [p for p in rail_parts() if p.name == name][0]
            x0, y0, _, _ = part.bbox()
            msp = load(name)
            for e in msp.query("CIRCLE"):
                found_p.append((round(e.dxf.center.x + x0, 2), round(e.dxf.center.y + y0, 2)))
            for e in msp.query("LWPOLYLINE"):
                pts = [(p[0] + x0, p[1] + y0) for p in e.get_points("xy")]
                xs_ = [p[0] for p in pts]
                ys_ = [p[1] for p in pts]
                if max(xs_) - min(xs_) < 6 and max(ys_) - min(ys_) < 10:
                    found_s.append((round((max(xs_) + min(xs_)) / 2, 2), round((max(ys_) + min(ys_)) / 2, 2)))
        want_s = sorted((px + sx, py + sy) for px, py in PANEL_CENTRES for sx, sy in PANEL_SCREWS if abs(px + sx - cx) < 26)
        want_p = sorted((px + sx, py + sy) for px, py in PANEL_CENTRES for sx, sy in PANEL_PINS if abs(px + sx - cx) < 26)
        ok(sorted(found_s) == want_s and sorted(found_p) == want_p,
           f"rail {rname}: {len(found_s)} screw slots and {len(found_p)} pin holes where the panels have them")

    # Every wall tab has a mortise of the same size where it lands.
    lw = ext("wall-left-lower")[0] + ext("wall-left-upper")[0]
    ok(abs(lw - (TOP_WALL[0] - BOT_WALL[1] + 2 * T)) < 0.01,
       f"left wall halves {lw:.1f} mm long with end tabs, between the top and bottom walls")
    tabs = len(SIDE_FRONT_TABS)
    mort = sum(1 for n in ("bezel-inner-left-1", "bezel-inner-left-2", "bezel-inner-left-3")
               for e in load(n).query("LWPOLYLINE") if len(e) == 4) - 3
    ok(mort == tabs, f"left wall: {tabs} front tabs, {mort} mortises in the inner bezel")

    # The supply fits the column, between the divider and the right wall.
    ok(PSU[0] > DIVIDER[1] and PSU[2] < RIGHT_WALL[0], f"supply {PSU[2] - PSU[0]:.0f} mm wide in a "
       f"{RIGHT_WALL[0] - DIVIDER[1]:.0f} mm column")
    ok(BOARD[0] > DIVIDER[1] and BOARD[2] < RIGHT_WALL[0] and BOARD[3] < TOP_WALL[0],
       f"board outline {BOARD[2] - BOARD[0]:.2f} x {BOARD[3] - BOARD[1]:.2f} mm inside the column")
    print()
    print("all checks pass" if not bad else f"{len(bad)} check(s) failed")
    return not bad


def render():
    """preview/sheets.png, drawn from the sheet DXFs themselves (needs matplotlib)."""
    import ezdxf
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from ezdxf.addons.drawing import Frontend, RenderContext
    from ezdxf.addons.drawing.matplotlib import MatplotlibBackend
    from ezdxf.addons.drawing.config import Configuration, BackgroundPolicy, ColorPolicy
    files = sorted(f for f in os.listdir(os.path.join(ROOT, "sheets")) if f.endswith(".dxf"))
    cols = 2
    rows = (len(files) + cols - 1) // cols
    fig, axes = plt.subplots(rows, cols, figsize=(cols * 6.4, rows * 3.5))
    cfg = Configuration(background_policy=BackgroundPolicy.WHITE, color_policy=ColorPolicy.COLOR)
    for ax, f in zip(axes.flat, files):
        doc = ezdxf.readfile(os.path.join(ROOT, "sheets", f))
        ax.add_patch(plt.Rectangle((0, 0), SHEET[0], SHEET[1], facecolor="#f4ead8", edgecolor="#b9a37e", lw=0.8, zorder=0))
        Frontend(RenderContext(doc), MatplotlibBackend(ax), config=cfg).draw_layout(doc.modelspace(), finalize=False)
        ax.set_xlim(-5, SHEET[0] + 5)
        ax.set_ylim(-5, SHEET[1] + 5)
        ax.set_aspect("equal")
        ax.axis("off")
        ax.set_title(f"{f}  ({SHEET[0]:.0f} x {SHEET[1]:.0f} mm)", fontsize=9, loc="left")
    for ax in list(axes.flat)[len(files):]:
        ax.axis("off")
    fig.tight_layout()
    fig.savefig(os.path.join(ROOT, "preview", "sheets.png"), dpi=110, facecolor="white")
    print("preview/sheets.png from", len(files), "sheet DXFs")


if __name__ == "__main__":
    if "--render" in sys.argv:
        render()
        sys.exit(0)
    if "--check" in sys.argv:
        sys.exit(0 if check() else 1)
    write_all()
