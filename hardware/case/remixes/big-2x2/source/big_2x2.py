# SPDX-License-Identifier: CC-BY-SA-4.0
"""Every cut file of the 2 x 2 case, from the numbers at the top of this file.

    python3 big_2x2.py            write parts/, sheets/, test_cuts/, preview/*.svg
    python3 big_2x2.py --check    read every DXF back and measure it
    python3 big_2x2.py --render   draw preview/cuts.png from the sheet DXFs (matplotlib)

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
BLOCK = 14.0               # screw block, 3 layers
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
M2_5_HOLE = 2.8

# Controller: a Raspberry Pi 5 renders, and a Colorlight 5A-75B card running
# receiver75 drives the panels, one panel to a HUB75 output (as patternflood).
# The card sits on the middle back piece, behind the centre of the display, so
# the four ribbons are the same short length. Component side faces the panels.
CARD = (91.76, 143.67)
CARD_CENTRE = (0.0, -15.0)
_card0 = (CARD_CENTRE[0] - CARD[0] / 2, CARD_CENTRE[1] - CARD[1] / 2)
# Measured by patternflood from scans, component side up, RJ45 edge at the top.
CARD_HOLES = [(_card0[0] + x, _card0[1] + y) for x, y in
              ((5.11, 139.08), (86.51, 139.35), (16.07, 3.81), (76.44, 3.96))]
CARD_HUB75 = [(_card0[0] + x, _card0[1] + y) for y in (98.6, 71.8, 44.4, 17.1) for x in (11.9, 80.3)]
CARD_RJ45 = (_card0[0] + 29.5, _card0[0] + 63.5)      # X span of the jack, on the top edge
CARD_TALL = 14.8           # the tallest part above its PCB (terminal block)
RING = (9.0, 6.0)          # spacer ring outer diameter, card and Pi
RING_LAYERS = 2            # 6 mm between a board and the back cover

# The Pi stands on end in the column, ports up, on the column's upper back piece.
PI = (56.0, 85.0)
PI_ORIGIN = (195.5, 120.0)
PI_HOLES = [(PI_ORIGIN[0] + x, PI_ORIGIN[1] + y) for x, y in ((3.5, 3.5), (52.5, 3.5), (3.5, 61.5), (52.5, 61.5))]
PI_TALL = 16.0             # USB and Ethernet stack

# Knobs: four EC11 encoders on Adafruit 4991 I2C breakouts, 45 mm apart as in
# patternflood, which clears the breakouts' outline. k0..k3 are I2C 0x37..0x3A.
KNOB_PITCH = 45.0
KNOB_CENTRE = (223.0, 270.0)
KNOBS = {
    "k0": (KNOB_CENTRE[0] - KNOB_PITCH / 2, KNOB_CENTRE[1] + KNOB_PITCH / 2),
    "k1": (KNOB_CENTRE[0] + KNOB_PITCH / 2, KNOB_CENTRE[1] + KNOB_PITCH / 2),
    "k2": (KNOB_CENTRE[0] - KNOB_PITCH / 2, KNOB_CENTRE[1] - KNOB_PITCH / 2),
    "k3": (KNOB_CENTRE[0] + KNOB_PITCH / 2, KNOB_CENTRE[1] - KNOB_PITCH / 2),
}
KNOB_POCKET = 35.0         # square, in the inner bezel layer: the bushing clamps the outer sheet alone
# Buttons for patternflood's menu, left to right: previous, select, next, sleep.
# 12 mm thread with two flats 11 mm apart, through both bezel layers.
BUTTON_Y = 205.0
BUTTONS = {"previous": 187.0, "select": 211.0, "next": 235.0, "sleep": 259.0}
BUTTON_HOLE = 12.2
BUTTON_FLATS = 11.1

# Supplies on the power tray, terminals down, bases on the tray.
# Panels: Mean Well LRS-150F-5, 159 x 97 x 30, 22 A.
PSU = (175.0, -255.0, 272.0, -96.0)
PSU_HOLES = [(x, PSU[1] + d) for d in (24.0, 102.0) for x in (PSU[0] + 32.0, PSU[2] - 32.0)]
# Pi and card: Mean Well LRS-50-5, 99 x 82 x 30, 10 A. Its two base holes are
# 40.5 mm from one long side of 82, so either way round lands within 1 mm: slots.
PSU_PI = (182.5, -80.0, 264.5, 19.0)
PSU_PI_HOLES = [((PSU_PI[0] + PSU_PI[2]) / 2, PSU_PI[1] + d) for d in (20.5, 75.5)]
# IEC C14 inlet with switch and fuse (AC-14-F16A): cut-out and flange screws as
# measured for patternflood.
IEC_CUT = (27.25, 46.75)
IEC_CENTRE = (225.0, -290.0)
IEC_SCREW_PITCH = 40.0

STIFF_Y = [111.333, -111.333]
COL_SPLIT = 100.0          # the column's back: Pi piece above, power tray below
DIV_WINDOWS = [(215.0, 275.0), (-70.0, -20.0), (-250.0, -190.0)]   # Ethernet, card power, panel power
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


def fname(name):
    """Filenames are lowercase with underscores (AGENTS.md)."""
    return name.replace("-", "_")


@dataclass
class Part:
    name: str
    qty: int
    what: str
    shapes: list            # first shape is the outline

    def __post_init__(self):
        self.name = fname(self.name)

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


def keyed(cx, cy, d=BUTTON_HOLE, flats=BUTTON_FLATS, n=12):
    """A round hole with two vertical flats, for a keyed panel-mount button."""
    r, f = d / 2, flats / 2
    a0 = math.acos(f / r)
    pts = []
    for side in (0, 1):
        start = a0 + side * math.pi
        end = math.pi - a0 + side * math.pi
        for i in range(n + 1):
            a = start + (end - start) * i / n
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return poly(pts)


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
            shapes += [keyed(x, BUTTON_Y) for x in BUTTONS.values()]
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
            shapes += [rect(x - h, y - h, x + h, y + h) for x, y in KNOBS.values()]
            shapes += [circle(x, BUTTON_Y, BUTTON_HOLE + 0.6) for x in BUTTONS.values()]
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
        if body_lo < COL_SPLIT < body_hi:
            shapes.append(rect(COL_SPLIT - T / 2, STIFF_TAB_D[0], COL_SPLIT + T / 2, STIFF_TAB_D[1]))
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
    h = BLOCK / 2
    lw, dv, cv, rw = LEFT_WALL[1] + h, DIVIDER[0] - h, DIVIDER[1] + h, RIGHT_WALL[0] - h
    top, bot = TOP_WALL[0] - h, BOT_WALL[1] + h
    mid = (lw + dv) / 2
    s_hi_up = STIFF_Y[0] + T / 2 + h
    s_hi_dn = STIFF_Y[0] - T / 2 - h
    s_lo_up = STIFF_Y[1] + T / 2 + h
    s_lo_dn = STIFF_Y[1] - T / 2 - h
    c_up, c_dn = COL_SPLIT + T / 2 + h, COL_SPLIT - T / 2 - h
    gap = (PSU[3] + PSU_PI[1]) / 2        # between the two supplies
    return {
        "back-display-upper": [(lw, top), (mid, top), (dv, top), (lw, s_hi_up), (mid, s_hi_up), (dv, s_hi_up)],
        "back-display-middle": [(lw, s_hi_dn), (mid, s_hi_dn), (dv, s_hi_dn), (lw, 0.0), (dv, 0.0),
                                (lw, s_lo_up), (mid, s_lo_up), (dv, s_lo_up)],
        "back-display-lower": [(lw, s_lo_dn), (mid, s_lo_dn), (dv, s_lo_dn), (lw, bot), (mid, bot), (dv, bot)],
        "back-column-upper": [(cv, top), (rw, top), (cv, 215.0), (rw, 215.0), (cv, c_up), (rw, c_up)],
        "back-column-lower": [(cv, c_dn), (rw, c_dn), (cv, gap), (rw, gap), (cv, bot), (rw, bot)],
    }


def back_parts():
    blocks = block_centres()
    split = (DIVIDER[0] + DIVIDER[1]) / 2
    pieces = {
        "back-display-upper": (X_L, STIFF_Y[0], split, Y_T),
        "back-display-middle": (X_L, STIFF_Y[1], split, STIFF_Y[0]),
        "back-display-lower": (X_L, Y_B, split, STIFF_Y[1]),
        "back-column-upper": (split, COL_SPLIT, X_R, Y_T),
        "back-column-lower": (split, Y_B, X_R, COL_SPLIT),
    }
    what = {
        "back-display-middle": "Back cover, middle: the Colorlight card on its inside",
        "back-column-upper": "Back cover, column: the Pi on its inside",
        "back-column-lower": "Power tray: the inlet and both supplies",
    }
    parts = []
    for name, (x0, y0, x1, y1) in pieces.items():
        shapes = [rect(x0, y0, x1, y1)]
        shapes += [circle(x, y, M3_HOLE) for x, y in blocks[name]]
        if name == "back-display-upper":
            shapes += vent_row(-120.0, 120.0, 270.0, 310.0)
        if name == "back-display-middle":
            shapes += [circle(x, y, M3_HOLE) for x, y in CARD_HOLES]
            cx0, cx1 = CARD_CENTRE[0] - CARD[0] / 2, CARD_CENTRE[0] + CARD[0] / 2
            shapes += vent_row(cx0 - 90.0, cx0 - 12.0, -60.0, 40.0)
            shapes += vent_row(cx1 + 12.0, cx1 + 90.0, -60.0, 40.0)
        if name == "back-display-lower":
            shapes += vent_row(-120.0, 120.0, -310.0, -270.0)
        if name == "back-column-upper":
            shapes += [circle(x, y, M2_5_HOLE) for x, y in PI_HOLES]
            shapes += vent_row(195.0, 255.0, 240.0, 315.0)
            shapes += vent_row(203.0, 245.0, 130.0, 170.0)
        if name == "back-column-lower":
            cx, cy = IEC_CENTRE
            w, h = IEC_CUT
            shapes.append(rect(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2))
            shapes += [circle(cx, cy + s * IEC_SCREW_PITCH / 2, M3_HOLE) for s in (-1, 1)]
            shapes += [circle(x, y, M3_HOLE) for x, y in PSU_HOLES]
            shapes += [obround(x, y, 4.4, M3_HOLE) for x, y in PSU_PI_HOLES]
            shapes += vent_row(190.0, 206.0, -318.0, -268.0, pitch=8.0)
            shapes += vent_row(244.0, 260.0, -318.0, -268.0, pitch=8.0)
            shapes += vent_row(192.0, 256.0, 30.0, 78.0)
        parts.append(Part(name, 1, what.get(name, "Back cover"), shapes))
    n = sum(len(v) for v in blocks.values())
    parts.append(Part("screw-block", n * BLOCK_LAYERS,
                      f"Screw block, {BLOCK_LAYERS} glued per block, {n} blocks", [rect(0, 0, BLOCK, BLOCK)]))
    parts.append(Part("ring-card", len(CARD_HOLES) * RING_LAYERS, "Spacer ring under the card, M3",
                      [circle(0, 0, RING[0]), circle(0, 0, M3_HOLE)]))
    parts.append(Part("ring-pi", len(PI_HOLES) * RING_LAYERS, "Spacer ring under the Pi, M2.5",
                      [circle(0, 0, RING[1]), circle(0, 0, M2_5_HOLE)]))
    return parts


def cradle_parts():
    depth = D_WALL_BACK + T + 0.5        # the box, front to back, plus a little
    f, base, lip_f, lip_b, back = 60.0, 15.0, 10.0, 15.0, 60.0   # lips low: clear of the pixels and the inlet
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
    # One knob bore and one keyed button hole.
    parts.append(Part("test-02-knob-and-button", 1, "A knob bore and a keyed button hole",
                      [rect(0, 0, 60, 30), circle(15, 15, KNOB_BORE), keyed(42, 15)]))
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
    doc = ezdxf.new("R2000", setup=False)
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


def write_svg(path, placed, w, h):
    """The same cut at 1:1, in millimetres, for cutters that take SVG and not DXF."""
    body = svg_shapes(placed, stroke="#ff0000", sw=0.1, flip_h=h)
    with open(path, "w") as f:
        f.write(f'<svg xmlns="http://www.w3.org/2000/svg" width="{w:.3f}mm" height="{h:.3f}mm" '
                f'viewBox="0 0 {w:.3f} {h:.3f}">\n' + "\n".join(body) + "\n</svg>\n")


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
    for sub, group in (("parts", parts), ("test_cuts", tests)):
        for p in group:
            w, h = p.size()
            write_dxf(os.path.join(ROOT, sub, f"{p.name}.dxf"), [(to_origin(p), 0, 0)])
            write_svg(os.path.join(ROOT, sub, f"{p.name}.svg"), [(to_origin(p), 0, 0)], w, h)
    # Test cuts on one small sheet.
    tsize = (400.0, 360.0)
    tsheets = nest(tests, sheet=tsize)
    placed = [(sh, dx, dy) for _, sh, dx, dy in tsheets[0]]
    write_dxf(os.path.join(ROOT, "test_cuts", "all_test_cuts.dxf"), placed)
    write_svg(os.path.join(ROOT, "test_cuts", "all_test_cuts.svg"), placed, *tsize)
    sheets = nest(parts)
    for i, items in enumerate(sheets, 1):
        placed = [(sh, dx, dy) for _, sh, dx, dy in items]
        write_dxf(os.path.join(ROOT, "sheets", f"sheet_{i:02d}.dxf"), placed)
        write_svg(os.path.join(ROOT, "sheets", f"sheet_{i:02d}.svg"), placed, *SHEET)
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
        out.append(f'<text x="{ox:.0f}" y="{oy - 5:.0f}" font-size="10" fill="#333">sheet_{i + 1:02d}.dxf</text>')
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
    W = (X_R - X_L) + 2 * m + 250
    H = (Y_T - Y_B) + 2 * m
    def X(x): return x - X_L + m
    def Y(y): return Y_T - y + m
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W:.0f} {H:.0f}" width="{W * 1.6:.0f}" height="{H * 1.6:.0f}" '
         f'font-family="Helvetica, Arial, sans-serif">',
         '<defs><marker id="ar" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">'
         '<path d="M0,0 L10,5 L0,10 z" fill="#f5a623"/></marker></defs>',
         f'<rect width="{W:.0f}" height="{H:.0f}" fill="#ffffff"/>',
         f'<rect x="{X(X_L)}" y="{Y(Y_T)}" width="{X_R - X_L}" height="{Y_T - Y_B}" fill="#e9d9bb" stroke="#8a6d3b" stroke-width="1"/>']
    for x0, y0, x1, y1 in ((AP_X, AP_Y, AP_X, Y_T), (AP_X, Y_B, AP_X, -AP_Y), (X_L, 0, -AP_X, 0), (AP_X, 0, X_R, 0)):
        o.append(f'<line x1="{X(x0)}" y1="{Y(y0)}" x2="{X(x1)}" y2="{Y(y1)}" stroke="#8a6d3b" stroke-width="0.6"/>')
    bw, bh = PANEL_BODY
    names = {(80.0, 160.0): "P0", (80.0, -160.0): "P1", (-80.0, -160.0): "P2", (-80.0, 160.0): "P3"}
    for (cx, cy), label in names.items():
        o.append(f'<rect x="{X(cx - bw / 2):.2f}" y="{Y(cy + bh / 2):.2f}" width="{bw}" height="{bh}" fill="#16161d" stroke="#000" stroke-width="0.4"/>')
        for k in range(1, 16):
            yy = cy - bh / 2 + k * bh / 16
            o.append(f'<line x1="{X(cx - bw / 2 + 4):.1f}" y1="{Y(yy):.1f}" x2="{X(cx + bw / 2 - 4):.1f}" y2="{Y(yy):.1f}" stroke="#2a2a36" stroke-width="0.8"/>')
        ty = cy + 70 if cy > 0 else cy - 70
        o.append(f'<text x="{X(cx):.1f}" y="{Y(ty) + 8:.1f}" font-size="22" fill="#f2f2f2" text-anchor="middle">{label}</text>')
    for cx, w in RAILS.values():
        o.append(f'<rect x="{X(cx - w / 2):.1f}" y="{Y(TOP_WALL[0]):.1f}" width="{w}" height="{TOP_WALL[0] - BOT_WALL[1]}" '
                 f'fill="none" stroke="#4a90e2" stroke-width="0.8" stroke-dasharray="4 3"/>')
    # The card, behind the centre, and a ribbon from it to each panel.
    c0x, c0y = CARD_CENTRE[0] - CARD[0] / 2, CARD_CENTRE[1] - CARD[1] / 2
    o.append(f'<rect x="{X(c0x):.1f}" y="{Y(c0y + CARD[1]):.1f}" width="{CARD[0]}" height="{CARD[1]}" fill="#0b3d2e" fill-opacity="0.85" stroke="#2ecc71" stroke-width="1.2"/>')
    o.append(f'<text x="{X(CARD_CENTRE[0]):.1f}" y="{Y(CARD_CENTRE[1]) - 4:.1f}" font-size="10" fill="#c8f7dc" text-anchor="middle">Colorlight</text>')
    o.append(f'<text x="{X(CARD_CENTRE[0]):.1f}" y="{Y(CARD_CENTRE[1]) + 9:.1f}" font-size="10" fill="#c8f7dc" text-anchor="middle">5A-75B</text>')
    hdr = sorted(CARD_HUB75, key=lambda p: (-p[1], p[0]))
    ends = {"P3": (hdr[0], (-80.0, 130.0)), "P0": (hdr[1], (80.0, 130.0)),
            "P2": (hdr[6], (-80.0, -130.0)), "P1": (hdr[7], (80.0, -130.0))}
    for (hx, hy), (px, py) in ends.values():
        o.append(f'<line x1="{X(hx):.1f}" y1="{Y(hy):.1f}" x2="{X(px):.1f}" y2="{Y(py):.1f}" stroke="#f5a623" stroke-width="2.2" stroke-dasharray="7 4" marker-end="url(#ar)"/>')
    # Column: knobs, buttons, the Pi behind them, the supplies and the inlet.
    o.append(f'<rect x="{X(PI_ORIGIN[0]):.1f}" y="{Y(PI_ORIGIN[1] + PI[1]):.1f}" width="{PI[0]}" height="{PI[1]}" fill="none" stroke="#c2185b" stroke-width="1" stroke-dasharray="4 3"/>')
    o.append(f'<text x="{X(PI_ORIGIN[0] + PI[0] / 2):.1f}" y="{Y(PI_ORIGIN[1] + 30):.1f}" font-size="9" fill="#c2185b" text-anchor="middle">Pi 5</text>')
    for box, label in ((PSU, "LRS-150F-5"), (PSU_PI, "LRS-50-5")):
        x0, y0, x1, y1 = box
        o.append(f'<rect x="{X(x0):.1f}" y="{Y(y1):.1f}" width="{x1 - x0}" height="{y1 - y0}" fill="none" stroke="#9013fe" stroke-width="1" stroke-dasharray="4 3"/>')
        o.append(f'<text x="{X((x0 + x1) / 2):.1f}" y="{Y((y0 + y1) / 2):.1f}" font-size="9" fill="#9013fe" text-anchor="middle">{label}</text>')
    cx, cy = IEC_CENTRE
    o.append(f'<rect x="{X(cx - IEC_CUT[0] / 2):.1f}" y="{Y(cy + IEC_CUT[1] / 2):.1f}" width="{IEC_CUT[0]}" height="{IEC_CUT[1]}" fill="none" stroke="#9013fe" stroke-width="1" stroke-dasharray="4 3"/>')
    o.append(f'<text x="{X(cx):.1f}" y="{Y(cy - IEC_CUT[1] / 2 - 6):.1f}" font-size="8" fill="#9013fe" text-anchor="middle">inlet (back)</text>')
    for name, (x, y) in KNOBS.items():
        o.append(f'<circle cx="{X(x):.1f}" cy="{Y(y):.1f}" r="10" fill="#1d1d1d"/>')
        o.append(f'<text x="{X(x):.1f}" y="{Y(y) + 3:.1f}" font-size="8" fill="#fff" text-anchor="middle">{name}</text>')
    for name, x in BUTTONS.items():
        o.append(f'<circle cx="{X(x):.1f}" cy="{Y(BUTTON_Y):.1f}" r="6" fill="#555"/>')
    o.append(f'<text x="{X(KNOB_CENTRE[0]):.1f}" y="{Y(BUTTON_Y) + 18:.1f}" font-size="7" fill="#333" text-anchor="middle">prev · select · next · sleep</text>')
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
    lx = X(X_R) + 24
    leg = [("#16161d", "Four 320 × 160 panels, 128 × 64 each"),
           ("#2ecc71", "Colorlight 5A-75B, behind the centre"),
           ("#f5a623", "One HUB75 ribbon per panel, 30 cm"),
           ("#c2185b", "Raspberry Pi 5, behind the knobs"),
           ("#4a90e2", "Rails behind the panels (screws, pins)"),
           ("#9013fe", "Two supplies and the inlet, power tray"),
           ("#8a6d3b", "Joints in the face layer")]
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
    W, H = 940, 470
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W * 1.6:.0f}" height="{H * 1.6:.0f}" '
         f'font-family="Helvetica, Arial, sans-serif" font-size="12">',
         f'<rect width="{W}" height="{H}" fill="#ffffff"/>']
    def box(x, y, w, h, title, sub="", fill="#f6f6f6", stroke="#333"):
        o.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="6" fill="{fill}" stroke="{stroke}" stroke-width="1.2"/>')
        o.append(f'<text x="{x + w / 2}" y="{y + h / 2 - (5 if sub else -4)}" text-anchor="middle" font-weight="bold">{title}</text>')
        if sub:
            o.append(f'<text x="{x + w / 2}" y="{y + h / 2 + 12}" text-anchor="middle" font-size="10" fill="#555">{sub}</text>')
    def wire(pts, color, w=2.5, dash=""):
        d = " ".join(f"{x},{y}" for x, y in pts)
        da = f' stroke-dasharray="{dash}"' if dash else ""
        o.append(f'<polyline points="{d}" fill="none" stroke="{color}" stroke-width="{w}"{da}/>')
    def label(x, y, t, color="#333", size=10):
        o.append(f'<text x="{x}" y="{y}" font-size="{size}" fill="{color}">{t}</text>')
    box(20, 190, 100, 56, "Mains", "100–240 VAC")
    box(150, 180, 130, 76, "IEC C14 inlet", "switch, fuse T4A", fill="#fdeaea", stroke="#b00020")
    box(330, 70, 150, 70, "LRS-150F-5", "5 V 22 A: panels", fill="#f1e6fd", stroke="#7b1fa2")
    box(330, 300, 150, 70, "LRS-50-5", "5 V 10 A: Pi and card", fill="#f1e6fd", stroke="#7b1fa2")
    box(560, 290, 150, 90, "Colorlight 5A-75B", "receiver75, 192.168.75.39", fill="#e3f7ec", stroke="#1e8449")
    box(560, 400, 150, 56, "Raspberry Pi 5", "192.168.75.1 on eth0", fill="#fde7f0", stroke="#c2185b")
    for i, name in enumerate(["P0", "P1", "P2", "P3"]):
        box(780, 20 + i * 68, 140, 50, f"Panel {name}", "")
    box(780, 330, 140, 56, "Knobs k0–k3", "4991s on I²C, 3V3")
    box(780, 400, 140, 56, "Buttons", "GPIO 17 27 22 23")
    wire([(120, 218), (150, 218)], "#b00020")
    wire([(280, 205), (305, 205), (305, 105), (330, 105)], "#b00020")
    wire([(280, 232), (305, 232), (305, 335), (330, 335)], "#b00020")
    label(22, 275, "L, N and earth: 18 AWG, 300 V", "#b00020")
    for i in range(4):
        y = 45 + i * 68
        wire([(480, 105), (520, 105), (520, y), (780, y)], "#c77700", w=3)
    label(525, 98, "16 AWG to each panel, two forks a screw", "#c77700")
    wire([(480, 335), (560, 335)], "#c77700", w=2.2)
    label(486, 328, "18 AWG, 4-pin", "#c77700")
    wire([(600, 380), (600, 400)], "#c77700", w=1.6)
    label(606, 395, "USB-C pigtail", "#c77700", 9)
    wire([(690, 380), (690, 400)], "#1565c0", w=2, dash="4 2")
    label(696, 395, "Ethernet", "#1565c0", 9)
    for i in range(4):
        y = 52 + i * 68
        wire([(710, 300 + i * 18), (745, 300 + i * 18), (745, y), (780, y)], "#1565c0", w=2, dash="6 3")
    label(560, 285, "HUB75, one output per panel", "#1565c0")
    wire([(710, 428), (780, 358)], "#2e7d32", w=1.6)
    wire([(710, 440), (780, 428)], "#2e7d32", w=1.6)
    label(22, 400, "Pi ⇄ card: gigabit Ethernet, a 50 cm patch. The card will not link at 100 Mbit.", "#1565c0", 11)
    label(22, 420, "Each supply's earth goes to its FG terminal. No panel current reaches the Pi's supply.", "#333", 11)
    label(22, 440, "Grounds meet through the ribbons; each panel returns its current on its own lead.", "#333", 11)
    o.append("</svg>")
    with open(os.path.join(ROOT, "preview", "wires.svg"), "w") as f:
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
# Check: read every DXF back and measure it against the panel, the card and the Pi
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
        return ezdxf.readfile(os.path.join(ROOT, "parts", f"{fname(name)}.dxf")).modelspace()

    def ext(name):
        b = ebbox.extents(load(name))
        return b.size.x, b.size.y

    def placed_circles(name):
        """Circle centres of a part's DXF, back in front-view coordinates."""
        part = [p for p in all_parts() if p.name == fname(name)][0]
        x0, y0, _, _ = part.bbox()
        return sorted((round(e.dxf.center.x + x0, 2), round(e.dxf.center.y + y0, 2), round(2 * e.dxf.radius, 2))
                      for e in load(name).query("CIRCLE"))

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

    # Knob bores: four, on the 45 mm pitch.
    knobs = [c for c in placed_circles("bezel-outer-column-upper") if abs(c[2] - KNOB_BORE) < 0.01]
    xs = sorted({c[0] for c in knobs})
    ys = sorted({c[1] for c in knobs})
    ok(len(knobs) == 4 and abs(xs[1] - xs[0] - KNOB_PITCH) < 0.01 and abs(ys[1] - ys[0] - KNOB_PITCH) < 0.01,
       f"knob bores: {len(knobs)} at {xs[1] - xs[0]:.2f} x {ys[1] - ys[0]:.2f} mm, the 4991 breakouts need 45")
    btn = [e for e in load("bezel-outer-column-upper").query("LWPOLYLINE") if len(e) > 8]
    ok(len(btn) == len(BUTTONS), f"{len(btn)} keyed button holes")

    # The card and the Pi land on the holes their makers drilled.
    card = [c for c in placed_circles("back-display-middle") if abs(c[2] - M3_HOLE) < 0.01 and
            any(abs(c[0] - x) < 0.01 and abs(c[1] - y) < 0.01 for x, y in CARD_HOLES)]
    ok(len(card) == 4, f"card: 4 holes on back_display_middle where the 5A-75B has them (top pair "
       f"{CARD_HOLES[1][0] - CARD_HOLES[0][0]:.2f} mm apart, bottom pair {CARD_HOLES[3][0] - CARD_HOLES[2][0]:.2f}, "
       f"rows {CARD_HOLES[0][1] - CARD_HOLES[2][1]:.2f})")
    pi = [c for c in placed_circles("back-column-upper") if abs(c[2] - M2_5_HOLE) < 0.01]
    pxs = sorted({c[0] for c in pi})
    pys = sorted({c[1] for c in pi})
    ok(len(pi) == 4 and abs(pxs[1] - pxs[0] - 49.0) < 0.01 and abs(pys[1] - pys[0] - 58.0) < 0.01,
       f"Pi: 4 holes {pxs[1] - pxs[0]:.1f} x {pys[1] - pys[0]:.1f} mm, the Pi 5's 49 x 58 on end")

    # Rails: glue the two layers back together and compare with the panel's holes.
    for rname, (cx, w) in RAILS.items():
        found_s, found_p = [], []
        for end in ("lower", "upper"):
            name = fname(f"rail-{rname}-front-{end}")
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

    lw = ext("wall-left-lower")[0] + ext("wall-left-upper")[0]
    ok(abs(lw - (TOP_WALL[0] - BOT_WALL[1] + 2 * T)) < 0.01,
       f"left wall halves {lw:.1f} mm long with end tabs, between the top and bottom walls")
    tabs = len(SIDE_FRONT_TABS)
    mort = sum(1 for n in ("bezel-inner-left-1", "bezel-inner-left-2", "bezel-inner-left-3")
               for e in load(n).query("LWPOLYLINE") if len(e) == 4) - 3
    ok(mort == tabs, f"left wall: {tabs} front tabs, {mort} mortises in the inner bezel")

    # Nothing inside the box sits where something else is. Bodies only, no tabs,
    # as boxes (x0, y0, v0, x1, y1, v1); v is depth behind the panel face.
    board_face = D_WALL_BACK - RING_LAYERS * T          # a board's back, on its rings
    boxes = {}
    for i, (cx, cy) in enumerate(PANEL_CENTRES):
        boxes[f"panel {i}"] = (cx - PANEL_BODY[0] / 2, cy - PANEL_BODY[1] / 2, 0, cx + PANEL_BODY[0] / 2, cy + PANEL_BODY[1] / 2, PANEL_DEPTH)
        # its IN, OUT and power plugs with their cables, somewhere near its middle
        boxes[f"panel {i} plugs"] = (cx - 50, cy - 45, PANEL_DEPTH, cx + 50, cy + 45, PANEL_DEPTH + 20)
    for rname, (cx, w) in RAILS.items():
        boxes[f"rail {rname}"] = (cx - w / 2, BOT_WALL[1], D_RAIL[0], cx + w / 2, TOP_WALL[0], D_RAIL[1])
    boxes["top wall"] = (X_L, TOP_WALL[0], D_BEZEL, X_R, TOP_WALL[1], D_WALL_BACK)
    boxes["bottom wall"] = (X_L, BOT_WALL[0], D_BEZEL, X_R, BOT_WALL[1], D_WALL_BACK)
    for n, wx in (("left wall", LEFT_WALL), ("divider", DIVIDER), ("right wall", RIGHT_WALL)):
        boxes[n] = (wx[0], BOT_WALL[1], D_BEZEL, wx[1], TOP_WALL[0], D_WALL_BACK)
    for i, y in enumerate(STIFF_Y):
        boxes[f"stiffener {i}"] = (LEFT_WALL[1], y - T / 2, D_STIFF[0], DIVIDER[0], y + T / 2, D_STIFF[1])
    boxes["stiffener column"] = (DIVIDER[1], COL_SPLIT - T / 2, D_STIFF[0], RIGHT_WALL[0], COL_SPLIT + T / 2, D_STIFF[1])
    for piece, pts in block_centres().items():
        for j, (x, y) in enumerate(pts):
            boxes[f"block {piece} {j}"] = (x - BLOCK / 2, y - BLOCK / 2, D_WALL_BACK - BLOCK_LAYERS * T, x + BLOCK / 2, y + BLOCK / 2, D_WALL_BACK)
    c0x, c0y = CARD_CENTRE[0] - CARD[0] / 2, CARD_CENTRE[1] - CARD[1] / 2
    boxes["card"] = (c0x, c0y, board_face - 1.7 - CARD_TALL, c0x + CARD[0], c0y + CARD[1], board_face)
    boxes["card's Ethernet plug"] = (CARD_RJ45[0], c0y + CARD[1], board_face - 1.7 - 13.8, CARD_RJ45[1], c0y + CARD[1] + 30, board_face - 1.7)
    boxes["Pi"] = (PI_ORIGIN[0], PI_ORIGIN[1], board_face - 1.6 - PI_TALL, PI_ORIGIN[0] + PI[0], PI_ORIGIN[1] + PI[1], board_face)
    boxes["Pi's Ethernet plug"] = (PI_ORIGIN[0], PI_ORIGIN[1] + PI[1], board_face - 1.6 - PI_TALL, PI_ORIGIN[0] + PI[0], PI_ORIGIN[1] + PI[1] + 30, board_face - 1.6)
    for name, (x, y) in KNOBS.items():
        # encoder body, 4991 board and its STEMMA QT plugs and cables
        boxes[f"knob {name}"] = (x - 13, y - 13, T, x + 13, y + 13, T + 30)
    for name, x in BUTTONS.items():
        boxes[f"button {name}"] = (x - 8, BUTTON_Y - 8, T, x + 8, BUTTON_Y + 8, T + 25)
    boxes["supply, panels"] = (PSU[0], PSU[1], D_WALL_BACK - 30.0, PSU[2], PSU[3], D_WALL_BACK)
    boxes["supply, Pi and card"] = (PSU_PI[0], PSU_PI[1], D_WALL_BACK - 30.0, PSU_PI[2], PSU_PI[3], D_WALL_BACK)
    cx, cy = IEC_CENTRE
    boxes["inlet"] = (cx - IEC_CUT[0] / 2, cy - IEC_CUT[1] / 2, D_WALL_BACK - 35.0, cx + IEC_CUT[0] / 2, cy + IEC_CUT[1] / 2, D_WALL_BACK)
    boxes["splice left"] = (LEFT_WALL[1], WALL_SPLIT - 30, 10, LEFT_WALL[1] + T, WALL_SPLIT + 30, 50)
    boxes["splice divider"] = (DIVIDER[1], WALL_SPLIT - 30, 10, DIVIDER[1] + T, WALL_SPLIT + 30, 50)
    boxes["splice right"] = (RIGHT_WALL[0] - T, WALL_SPLIT - 30, 10, RIGHT_WALL[0], WALL_SPLIT + 30, 50)
    names = list(boxes)
    hits = []
    for i in range(len(names)):
        for j in range(i + 1, len(names)):
            a, b = boxes[names[i]], boxes[names[j]]
            if all(overlaps(a[k], a[k + 3], b[k], b[k + 3]) for k in range(3)):
                hits.append(f"{names[i]} / {names[j]}")
    ok(not hits, f"{len(names)} bodies inside the box, no two in the same place" + (": " + ", ".join(hits) if hits else ""))
    print()
    print("all checks pass" if not bad else f"{len(bad)} check(s) failed")
    return not bad


def render():
    """preview/cuts.png, drawn from the sheet DXFs themselves (needs matplotlib)."""
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
    fig.savefig(os.path.join(ROOT, "preview", "cuts.png"), dpi=110, facecolor="white")
    print("preview/cuts.png from", len(files), "sheet DXFs")


if __name__ == "__main__":
    if "--render" in sys.argv:
        render()
        sys.exit(0)
    if "--check" in sys.argv:
        sys.exit(0 if check() else 1)
    write_all()
