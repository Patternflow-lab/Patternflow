# SPDX-License-Identifier: CC-BY-SA-4.0
"""Every cut file of the 2 x 2 case, from the numbers at the top of this file.

    python3 big_2x2.py            write parts/, sheets/, test_cuts/, preview/*.svg
    python3 big_2x2.py --check    read every DXF back and measure it
    python3 big_2x2.py --check --parts    and print what each part was measured against
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
PILOT = 2.5                # for an M3 self-tapping screw in birch ply: it keeps the layers lined up and the screw straight
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


def _pi(u, v):
    """A point on the Pi 5's drawing (u along its 85, ports at u = 85; v along its
    56, header at v = 56), where it lands with the Pi on end and its parts facing
    the front."""
    return (PI_ORIGIN[0] + PI[0] - v, PI_ORIGIN[1] + u)


PI_USB_C = _pi(11.2, 0.0)          # its power socket, pointing at the right wall
PI_PIN1 = _pi(8.37, 51.23)         # header pin 1; 3, 5 and 9 follow on up the board

# Knobs: four EC11 encoders on Adafruit 4991 I2C breakouts, 45 mm apart as in
# patternflood, which clears the breakouts' 25.4 mm boards. k0..k3 are I2C
# 0x37..0x3A, and patternflood's renderer hands k0..k3 to a pattern as its
# parameters 0..3. A Patternflow has parameter 0 on K1, top right, 1 on K2, top
# left, 2 on K4, bottom left, and 3 on K3, bottom right (docs/rest-api.md, Knob
# ordering), so the knobs sit the same way here.
KNOB_PITCH = 45.0
KNOB_CENTRE = (223.0, 270.0)
KNOBS = {
    "k0": (KNOB_CENTRE[0] + KNOB_PITCH / 2, KNOB_CENTRE[1] + KNOB_PITCH / 2),
    "k1": (KNOB_CENTRE[0] - KNOB_PITCH / 2, KNOB_CENTRE[1] + KNOB_PITCH / 2),
    "k2": (KNOB_CENTRE[0] - KNOB_PITCH / 2, KNOB_CENTRE[1] - KNOB_PITCH / 2),
    "k3": (KNOB_CENTRE[0] + KNOB_PITCH / 2, KNOB_CENTRE[1] - KNOB_PITCH / 2),
}
KNOB_LEAD = 250.0          # the 4991s' lead to the Pi's header: 150 mm Adafruit 4397 and 100 mm jumpers
KNOB_POCKET = 35.0         # square, in the inner bezel layer: the bushing clamps the outer sheet alone
# A touch screen under the knobs: the Raspberry Pi Touch Display 2, 5-inch, on
# the Pi's DSI port. Its outline, viewing area and standoffs are from Raspberry
# Pi's product brief (approximate there, so test-fit before cutting the face).
DISPLAY = (91.46, 143.4)               # outline, portrait
DISPLAY_VIEW = (63.1, 111.4)           # the window in the face, centred on the outline
DISPLAY_CENTRE = (223.0, 154.3)        # its top edge 4 mm under the knob pockets
DISPLAY_DEPTH = 14.92                  # glass front to the standoffs' faces
DISPLAY_CLEAR = 0.2                    # each side, in the inner layer's pocket
_dx, _dy = DISPLAY_CENTRE
_dbot = _dy - DISPLAY[1] / 2
DISPLAY_STANDOFFS = [(_dx + sx * 24.5, _dbot + y) for y in (33.91, 91.91) for sx in (-1, 1)]   # M2.5, on its back
DISPLAY_FFC = (_dx, _dbot + 36.0)      # ribbon connector on its back, between the lower standoffs
DISPLAY_J1 = (_dx + 21.7, _dbot + 50.0)  # its power lead's socket
# A bracket screws to the standoffs and to two posts glued into the column's
# corners, and holds the glass against the face.
POST_LAYERS = 4                        # 12 mm: the inner layer's back to the standoffs' faces
POSTS = [(DIVIDER[1], DIVIDER[1] + 8.0), (RIGHT_WALL[0] - 8.0, RIGHT_WALL[0])]
POST_Y = (_dy - 40.0, _dy + 25.0)
# The bracket comes within 0.5 mm of the divider and the right wall, which
# leaves 1.8 mm of wood between its edge and the screws on the posts' centres.
BRACKET = (DIVIDER[1] + 0.5, _dy - 47.0, RIGHT_WALL[0] - 0.5, _dy + 28.0)
BRACKET_SCREWS = [((a + b) / 2, _dy + d) for a, b in POSTS for d in (-30.0, 15.0)]

# Supplies on the power tray, terminals down, bases on the tray. Their screw
# terminals sit in a step in the cover and the wires leave along the supply's
# length, so each needs room past its terminal end for the forks and the bend.
WIRE_ROOM = 20.0
# Panels: Mean Well LRS-150F-5, 159 x 97 x 30, 22 A.
PSU = (175.0, -255.0, 272.0, -96.0)
PSU_HOLES = [(x, PSU[1] + d) for d in (24.0, 102.0) for x in (PSU[0] + 32.0, PSU[2] - 32.0)]
# Pi and card: Mean Well LRS-50-5, 99 x 82 x 30, 10 A. Its two base holes are
# 20.5 and 75.5 mm from the terminal end and 40.5 mm from one long side of 82
# (Mean Well's STEP, which patternflood keeps), so either way round lands
# within 1 mm: slots. Its five terminals span the middle 60 mm of the 82.
PSU_PI = (182.5, -76.0, 264.5, 23.0)
PSU_PI_HOLES = [((PSU_PI[0] + PSU_PI[2]) / 2, PSU_PI[1] + d) for d in (20.5, 75.5)]
PSU_PI_TERMINALS = (PSU_PI[0] + 11.0, PSU_PI[2] - 11.0)
# IEC C14 inlet with switch and fuse (AC-14-F16A), as patternflood measured it:
# a 27.25 x 46.75 cut-out, and the two flange screws 40 mm apart ACROSS the short
# 27.25 side, in the flange's lobes. The flange runs 6.25 mm past the cut-out's
# short ends and its lobes 10.75 mm past the long sides; the body is 37.45 deep.
IEC_CUT = (27.25, 46.75)
IEC_CENTRE = (225.0, -302.0)
IEC_SCREW_PITCH = 40.0
IEC_FLANGE = (IEC_CUT[0] + 2 * 10.75, IEC_CUT[1] + 2 * 6.25)
IEC_DEPTH = 37.45
IEC_SCREWS = [(IEC_CENTRE[0] + s * IEC_SCREW_PITCH / 2, IEC_CENTRE[1]) for s in (-1, 1)]

STIFF_Y = [111.333, -111.333]
COL_SPLIT = 100.0          # the column's back: Pi piece above, power tray below
COL_INNER_SPLIT = 75.0     # the column's inner face layer is cut here, under the display's pocket
# Ethernet; the card's power, level with the small supply's terminals; the
# panels' power, level with the big supply's.
DIV_WINDOWS = [(215.0, 275.0), (-100.0, -50.0), (-280.0, -220.0)]
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
            vw, vh = DISPLAY_VIEW
            shapes.append(rect(_dx - vw / 2, _dy - vh / 2, _dx + vw / 2, _dy + vh / 2))
        parts.append(Part(name, 1, "Bezel, outer layer (the face)", shapes))

    # Inner layer: glued behind the outer one, joints staggered, and the
    # mortises for every wall's front tabs. The outer layer hides them.
    inner = {
        "bezel-inner-top": (X_L, AP_Y, X_R, Y_T),
        "bezel-inner-bottom": (X_L, Y_B, X_R, -AP_Y),
        "bezel-inner-left-1": (X_L, 160.0, -AP_X, AP_Y),
        "bezel-inner-left-2": (X_L, -160.0, -AP_X, 160.0),
        "bezel-inner-left-3": (X_L, -AP_Y, -AP_X, -160.0),
        "bezel-inner-column-1": (AP_X, COL_INNER_SPLIT, X_R, AP_Y),
        "bezel-inner-column-2": (AP_X, -160.0, X_R, COL_INNER_SPLIT),
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
            c = DISPLAY_CLEAR
            shapes.append(rect(_dx - DISPLAY[0] / 2 - c, _dy - DISPLAY[1] / 2 - c, _dx + DISPLAY[0] / 2 + c, _dy + DISPLAY[1] / 2 + c))
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
            shapes += [circle(x, y, M3_HOLE) for x, y in IEC_SCREWS]
            shapes += [circle(x, y, M3_HOLE) for x, y in PSU_HOLES]
            shapes += [obround(x, y, 4.4, M3_HOLE) for x, y in PSU_PI_HOLES]
            # either side of the inlet's flange, clear of the bottom screw blocks
            shapes += vent_row(184.0, 198.0, -310.0, -270.0, pitch=8.0)
            shapes += vent_row(252.0, 266.0, -310.0, -270.0, pitch=8.0)
            shapes += vent_row(192.0, 256.0, 30.0, 78.0)
        parts.append(Part(name, 1, what.get(name, "Back cover"), shapes))
    n = sum(len(v) for v in blocks.values())
    parts.append(Part("screw-block", n * BLOCK_LAYERS,
                      f"Screw block, {BLOCK_LAYERS} glued per block, {n} blocks",
                      [rect(0, 0, BLOCK, BLOCK), circle(BLOCK / 2, BLOCK / 2, PILOT)]))
    parts.append(Part("ring-card", len(CARD_HOLES) * RING_LAYERS, "Spacer ring under the card, M3",
                      [circle(0, 0, RING[0]), circle(0, 0, M3_HOLE)]))
    parts.append(Part("ring-pi", len(PI_HOLES) * RING_LAYERS, "Spacer ring under the Pi, M2.5",
                      [circle(0, 0, RING[1]), circle(0, 0, M2_5_HOLE)]))
    return parts


def display_parts():
    x0, y0, x1, y1 = BRACKET
    lo, hi = _dy - 30.0, _dy + 12.0          # where the power socket and the ribbon need room
    # A notch from the bottom edge clears the ribbon connector and J1, between the standoffs.
    outline = poly([(x0, y0), (204.0, y0), (204.0, hi), (251.0, hi), (251.0, lo), (242.0, lo), (242.0, y0),
                    (x1, y0), (x1, y1), (x0, y1)])
    shapes = [outline] + [circle(x, y, M2_5_HOLE) for x, y in DISPLAY_STANDOFFS]
    shapes += [circle(x, y, M3_HOLE) for x, y in BRACKET_SCREWS]
    parts = [Part("display-bracket", 1, "Holds the touch screen against the face: its standoffs and two posts", shapes)]
    w = POSTS[0][1] - POSTS[0][0]
    pilots = [circle(w / 2, y - POST_Y[0], PILOT) for _, y in BRACKET_SCREWS[:2]]
    parts.append(Part("display-post", POST_LAYERS * len(POSTS),
                      f"Display post, {POST_LAYERS} glued per post, {len(POSTS)} posts",
                      [rect(0, 0, w, POST_Y[1] - POST_Y[0])] + pilots))
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
    # One knob bore, and the display's four standoffs as the bracket has them.
    sx0, sy0 = min(x for x, _ in DISPLAY_STANDOFFS), min(y for _, y in DISPLAY_STANDOFFS)
    shapes = [rect(0, 0, 80, 80), circle(10, 70, KNOB_BORE)]
    shapes += [circle(x - sx0 + 15, y - sy0 + 11, M2_5_HOLE) for x, y in DISPLAY_STANDOFFS]
    parts.append(Part("test-02-knob-and-display", 1, "A knob bore, and the display's standoff holes", shapes))
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
    shapes += [circle(x - IEC_CENTRE[0], y - IEC_CENTRE[1], M3_HOLE) for x, y in IEC_SCREWS]
    parts.append(Part("test-04-inlet", 1, "IEC inlet cut-out and flange screws", shapes))
    return parts


def all_parts():
    return bezel_parts() + wall_parts() + rail_parts() + back_parts() + display_parts() + cradle_parts()


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
    """MaxRects packing, longest part first, each part on the earliest sheet with
    room, turned if that fits better. Every part keeps gap to the next and to the
    sheet's edge. Returns sheets of (part name, shapes, dx, dy)."""
    items = []
    for p in parts:
        base = to_origin(p)
        w, h = p.size()
        items += [(p.name, base, w, h)] * p.qty
    items.sort(key=lambda it: (-max(it[2], it[3]), -it[2] * it[3], it[0]))
    sheets = []                      # each: {"free": [(x, y, w, h)], "items": [...]}

    def fits(free, w, h):
        best = None
        for fx, fy, fw, fh in free:
            if w <= fw + 1e-9 and h <= fh + 1e-9:
                score = (min(fw - w, fh - h), max(fw - w, fh - h), fy, fx)
                if best is None or score < best[0]:
                    best = (score, fx, fy)
        return best

    def place(free, x, y, w, h):
        out = []
        for fx, fy, fw, fh in free:
            if x >= fx + fw or x + w <= fx or y >= fy + fh or y + h <= fy:
                out.append((fx, fy, fw, fh))
                continue
            if x > fx:
                out.append((fx, fy, x - fx, fh))
            if x + w < fx + fw:
                out.append((x + w, fy, fx + fw - x - w, fh))
            if y > fy:
                out.append((fx, fy, fw, y - fy))
            if y + h < fy + fh:
                out.append((fx, y + h, fw, fy + fh - y - h))
        out = [r for r in out if r[2] > 1e-9 and r[3] > 1e-9]
        keep = []
        for i, a in enumerate(out):
            inside = any(j != i and b[0] <= a[0] and b[1] <= a[1] and a[0] + a[2] <= b[0] + b[2] and
                         a[1] + a[3] <= b[1] + b[3] and (b != a or j < i) for j, b in enumerate(out))
            if not inside:
                keep.append(a)
        return keep

    for name, base, w, h in items:
        for s in sheets + [None]:
            if s is None:
                s = {"free": [(gap, gap, sheet[0] - gap, sheet[1] - gap)], "items": []}
                sheets.append(s)
            options = []
            for turned, (ww, hh) in ((False, (w, h)), (True, (h, w))):
                f = fits(s["free"], ww + gap, hh + gap)
                if f:
                    options.append((f[0], turned, f[1], f[2], ww, hh))
            if options:
                _, turned, x, y, ww, hh = min(options)
                sh = rotate90(base, h) if turned else base
                s["items"].append((name, sh, round(x, 3), round(y, 3)))
                s["free"] = place(s["free"], x, y, ww + gap, hh + gap)
                break
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
    assert len(tsheets) == 1, "the test cuts no longer fit one sheet"
    placed = [(sh, dx, dy) for _, sh, dx, dy in tsheets[0]]
    write_dxf(os.path.join(ROOT, "test_cuts", "all_test_cuts.dxf"), placed)
    write_svg(os.path.join(ROOT, "test_cuts", "all_test_cuts.svg"), placed, *tsize)
    sheets = nest(parts)
    for f in os.listdir(os.path.join(ROOT, "sheets")):
        if f.startswith("sheet_"):
            os.remove(os.path.join(ROOT, "sheets", f))
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
    # Column: knobs, the screen, the Pi behind it, the supplies and the inlet.
    for box, label in ((PSU, "LRS-150F-5"), (PSU_PI, "LRS-50-5")):
        x0, y0, x1, y1 = box
        o.append(f'<rect x="{X(x0):.1f}" y="{Y(y1):.1f}" width="{x1 - x0}" height="{y1 - y0}" fill="none" stroke="#9013fe" stroke-width="1" stroke-dasharray="4 3"/>')
        o.append(f'<text x="{X((x0 + x1) / 2):.1f}" y="{Y((y0 + y1) / 2):.1f}" font-size="9" fill="#9013fe" text-anchor="middle">{label}</text>')
    cx, cy = IEC_CENTRE
    o.append(f'<rect x="{X(cx - IEC_CUT[0] / 2):.1f}" y="{Y(cy + IEC_CUT[1] / 2):.1f}" width="{IEC_CUT[0]}" height="{IEC_CUT[1]}" fill="none" stroke="#9013fe" stroke-width="1" stroke-dasharray="4 3"/>')
    # its flange on the outside of the back, lobed across the short side where the screws are
    hw_, hh_ = IEC_CUT[0] / 2, IEC_FLANGE[1] / 2
    fl = [(-hw_, -hh_), (-IEC_FLANGE[0] / 2, 0), (-hw_, hh_), (hw_, hh_), (IEC_FLANGE[0] / 2, 0), (hw_, -hh_)]
    pts = " ".join(f"{X(cx + u):.1f},{Y(cy + v):.1f}" for u, v in fl)
    o.append(f'<polygon points="{pts}" fill="none" stroke="#9013fe" stroke-width="0.6"/>')
    for x, y in IEC_SCREWS:
        o.append(f'<circle cx="{X(x):.1f}" cy="{Y(y):.1f}" r="1.7" fill="#9013fe"/>')
    o.append(f'<text x="{X(cx):.1f}" y="{Y(cy + IEC_FLANGE[1] / 2) - 3:.1f}" font-size="8" fill="#9013fe" text-anchor="middle">inlet (back)</text>')
    for name, (x, y) in KNOBS.items():
        o.append(f'<circle cx="{X(x):.1f}" cy="{Y(y):.1f}" r="10" fill="#1d1d1d"/>')
        o.append(f'<text x="{X(x):.1f}" y="{Y(y) + 3:.1f}" font-size="8" fill="#fff" text-anchor="middle">{name}</text>')
    vw, vh = DISPLAY_VIEW
    o.append(f'<rect x="{X(_dx - vw / 2):.1f}" y="{Y(_dy + vh / 2):.1f}" width="{vw}" height="{vh}" rx="2" fill="#10203a" stroke="#000" stroke-width="0.6"/>')
    for k, t in enumerate(("shelves", "pattern", "brightness", "sleep")):
        yy = _dy + vh / 2 - 14 - k * 22
        o.append(f'<rect x="{X(_dx - vw / 2 + 6):.1f}" y="{Y(yy):.1f}" width="{vw - 12}" height="15" rx="3" fill="#24406b"/>')
        o.append(f'<text x="{X(_dx):.1f}" y="{Y(yy) + 10.5:.1f}" font-size="8" fill="#dfe8f5" text-anchor="middle">{t}</text>')
    o.append(f'<text x="{X(_dx):.1f}" y="{Y(_dy - vh / 2) + 12:.1f}" font-size="7" fill="#333" text-anchor="middle">5-inch touch screen</text>')
    # the Pi behind the screen, dashed over it
    o.append(f'<rect x="{X(PI_ORIGIN[0]):.1f}" y="{Y(PI_ORIGIN[1] + PI[1]):.1f}" width="{PI[0]}" height="{PI[1]}" fill="none" stroke="#e05a8a" stroke-width="1" stroke-dasharray="4 3"/>')
    o.append(f'<text x="{X(PI_ORIGIN[0] + PI[0] - 3):.1f}" y="{Y(PI_ORIGIN[1]) - 4:.1f}" font-size="8" fill="#e05a8a" text-anchor="end">Pi 5</text>')
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
           ("#c2185b", "Raspberry Pi 5, behind the screen"),
           ("#10203a", "Touch screen, 5-inch, under the knobs"),
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
    box(780, 400, 140, 56, "Touch Display 2", "5-inch, DSI and pin 2")
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
    label(718, 452, "DSI ribbon", "#2e7d32", 9)
    label(22, 400, "Pi ⇄ card: gigabit Ethernet, a 50 cm patch. The card will not link at 100 Mbit.", "#1565c0", 11)
    label(22, 420, "Each supply's earth goes to its FG terminal. No panel current reaches the Pi's supply.", "#333", 11)
    label(22, 440, "Grounds meet through the ribbons. Four panel leads of one length keep panel current off them.", "#333", 11)
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


# --------------------------------------------------------------------------
# Reading DXFs back: outlines, holes, webs, joints
# --------------------------------------------------------------------------

MIN_WEB = 1.5              # thinnest wood the checks accept between two cuts
PART_GEOMETRY = {}         # part name -> {"holes": n, "web": thinnest web}, filled by geometry_checks


def read_part(path, dx=0.0, dy=0.0):
    """A DXF's cuts as (polygons, circles, open polylines), shifted by dx, dy."""
    import ezdxf
    msp = ezdxf.readfile(path).modelspace()
    polys, circles, open_ = [], [], 0
    for e in msp.query("LWPOLYLINE"):
        pts = [(q[0] + dx, q[1] + dy) for q in e.get_points("xy")]
        polys.append(pts)
        if not e.closed:
            open_ += 1
    for e in msp.query("CIRCLE"):
        circles.append((e.dxf.center.x + dx, e.dxf.center.y + dy, e.dxf.radius))
    return polys, circles, open_


def _segs(pts):
    return [(pts[i], pts[(i + 1) % len(pts)]) for i in range(len(pts))]


def _pt_seg(p, a, b):
    ax, ay = a
    bx, by = b
    dx, dy = bx - ax, by - ay
    L = dx * dx + dy * dy
    t = 0.0 if L == 0 else max(0.0, min(1.0, ((p[0] - ax) * dx + (p[1] - ay) * dy) / L))
    return math.hypot(p[0] - ax - t * dx, p[1] - ay - t * dy)


def _cross(o, a, b):
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])


def _seg_seg(a, b, c, d):
    d1, d2, d3, d4 = _cross(c, d, a), _cross(c, d, b), _cross(a, b, c), _cross(a, b, d)
    if ((d1 > 0) != (d2 > 0)) and ((d3 > 0) != (d4 > 0)) and 0 not in (d1, d2, d3, d4):
        return 0.0
    return min(_pt_seg(a, c, d), _pt_seg(b, c, d), _pt_seg(c, a, b), _pt_seg(d, a, b))


def _inside(p, pts):
    x, y = p
    n, c = len(pts), False
    for i in range(n):
        (x0, y0), (x1, y1) = pts[i], pts[(i + 1) % n]
        if (y0 > y) != (y1 > y) and x < x0 + (y - y0) * (x1 - x0) / (y1 - y0):
            c = not c
    return c


def _bbox(sh):
    if sh[0] == "c":
        _, x, y, r = sh
        return x - r, y - r, x + r, y + r
    xs = [p[0] for p in sh[1]]
    ys = [p[1] for p in sh[1]]
    return min(xs), min(ys), max(xs), max(ys)


def _gap(a, b, limit):
    """Distance between the edges of two cuts (0 where they cross), or limit if
    their boxes are further apart than that."""
    ax0, ay0, ax1, ay1 = _bbox(a)
    bx0, by0, bx1, by1 = _bbox(b)
    if ax0 - bx1 > limit or bx0 - ax1 > limit or ay0 - by1 > limit or by0 - ay1 > limit:
        return limit
    if a[0] == "c" and b[0] == "c":
        return math.hypot(a[1] - b[1], a[2] - b[2]) - a[3] - b[3]
    if a[0] == "c":
        a, b = b, a
    if b[0] == "c":
        _, x, y, r = b
        return min(_pt_seg((x, y), p, q) for p, q in _segs(a[1])) - r
    return min(_seg_seg(p, q, u, v) for p, q in _segs(a[1]) for u, v in _segs(b[1]))


def _rep(sh):
    return (sh[1], sh[2]) if sh[0] == "c" else sh[1][0]


def _simple(pts):
    segs = _segs(pts)
    n = len(segs)
    for i in range(n):
        for j in range(i + 2, n):
            if i == 0 and j == n - 1:
                continue
            if _seg_seg(*segs[i], *segs[j]) == 0.0:
                return False
    return True


def geometry_checks(ok, covered):
    """Every part: closed outlines that do not cross themselves, every hole inside
    the outline, and no two cuts closer than MIN_WEB. Every sheet: no two parts
    touching."""
    bad = []
    for p in all_parts():
        polys, circles, open_ = read_part(os.path.join(ROOT, "parts", f"{p.name}.dxf"))
        cuts = [("p", q) for q in polys] + [("c",) + c for c in circles]
        area = lambda c: (_bbox(c)[2] - _bbox(c)[0]) * (_bbox(c)[3] - _bbox(c)[1])
        outline = max(cuts, key=area)
        holes = [c for c in cuts if c is not outline]
        web = 99.0
        why = []
        if open_:
            why.append(f"{open_} open polyline(s)")
        if outline[0] == "p" and not _simple(outline[1]):
            why.append("outline crosses itself")
        for i, h in enumerate(holes):
            r = _rep(h)
            inside = (_inside(r, outline[1]) if outline[0] == "p"
                      else math.hypot(r[0] - outline[1], r[1] - outline[2]) < outline[3])
            if not inside:
                why.append("a hole outside the outline")
            web = min(web, _gap(outline, h, 99.0) if outline[0] == "p" or h[0] == "p"
                      else outline[3] - math.hypot(h[1] - outline[1], h[2] - outline[2]) - h[3])
            for g in holes[i + 1:]:
                if (g[0] == "p" and _inside(_rep(h), g[1])) or (h[0] == "p" and _inside(_rep(g), h[1])):
                    why.append("a hole inside another")
                web = min(web, _gap(h, g, 99.0))
        if web < MIN_WEB:
            why.append(f"web {web:.2f} mm")
        PART_GEOMETRY[p.name] = {"holes": len(holes), "web": web if holes else float("nan")}
        covered[p.name].append("closed cuts, holes inside, webs")
        if why:
            bad.append(f"{p.name}: {', '.join(dict.fromkeys(why))}")
    webs = [(g["web"], n) for n, g in PART_GEOMETRY.items() if g["holes"]]
    thin = min(webs)
    ok(not bad, f"every part: closed cuts, outline does not cross itself, every hole inside it, no two cuts "
       f"closer than {MIN_WEB} mm (thinnest {thin[0]:.2f} mm, {thin[1]})" + (": " + "; ".join(bad) if bad else ""))

    bad = []
    pieces = 0
    for f in sorted(x for x in os.listdir(os.path.join(ROOT, "sheets")) if x.endswith(".dxf")):
        polys, circles, open_ = read_part(os.path.join(ROOT, "sheets", f))
        boxes = [_bbox(("p", q)) for q in polys]
        # a part's outline is a polygon not inside any other polygon
        outlines = [q for i, q in enumerate(polys)
                    if not any(j != i and boxes[j][0] <= boxes[i][0] and boxes[j][1] <= boxes[i][1] and
                               boxes[j][2] >= boxes[i][2] and boxes[j][3] >= boxes[i][3] and _inside(q[0], polys[j])
                               for j in range(len(polys)))]
        loose = [c for c in circles
                 if not any(_inside((c[0], c[1]), q) for q in polys)
                 and not any(d[2] > c[2] and math.hypot(c[0] - d[0], c[1] - d[1]) < d[2] for d in circles)]
        pieces += len(outlines) + len(loose)
        cuts_ = [("p", q) for q in outlines] + [("c",) + c for c in loose]
        for i in range(len(cuts_)):
            for j in range(i + 1, len(cuts_)):
                if _gap(cuts_[i], cuts_[j], GAP) < GAP - 0.5:
                    bad.append(f)
        if open_:
            bad.append(f + " (open polylines)")
    want = sum(p.qty for p in all_parts())
    ok(not bad and pieces == want, f"sheets: all {pieces} of the {want} pieces, none closer than {GAP - 0.5:.1f} mm to the next"
       + (": " + ", ".join(sorted(set(bad))) if bad else ""))


def _placed(name):
    """A part's cuts read back from its DXF, in the box's own coordinates."""
    part = [p for p in all_parts() if p.name == fname(name)][0]
    x0, y0, _, _ = part.bbox()
    return read_part(os.path.join(ROOT, "parts", f"{part.name}.dxf"), x0, y0)


def _tabs(outline, axis, at):
    """Spans of an outline's tabs whose tips lie on the line axis = at (axis 0: x,
    1: y), as sorted (lo, hi) along the other axis."""
    other = 1 - axis
    out = []
    for p, q in _segs(outline):
        if abs(p[axis] - at) < 0.01 and abs(q[axis] - at) < 0.01:
            out.append(tuple(sorted((round(p[other], 2), round(q[other], 2)))))
    return sorted(out)


def _rects(polys, xr=None, yr=None):
    """Four-sided holes, optionally only those whose x (or y) span is xr (or yr)."""
    out = []
    for q in polys:
        if len(q) != 4:
            continue
        xs = (round(min(p[0] for p in q), 2), round(max(p[0] for p in q), 2))
        ys = (round(min(p[1] for p in q), 2), round(max(p[1] for p in q), 2))
        if xr and (abs(xs[0] - xr[0]) > 0.01 or abs(xs[1] - xr[1]) > 0.01):
            continue
        if yr and (abs(ys[0] - yr[0]) > 0.01 or abs(ys[1] - yr[1]) > 0.01):
            continue
        out.append((xs, ys))
    return out


def joint_checks(ok, covered):
    """Each tab against the hole it goes into, both read back from the DXFs."""
    tip = D_BEZEL - T
    inner = {n: _placed(n)[0] for n in ("bezel-inner-top", "bezel-inner-bottom", "bezel-inner-left-1", "bezel-inner-left-2",
                                        "bezel-inner-left-3", "bezel-inner-column-1", "bezel-inner-column-2", "bezel-inner-column-3")}
    # Top and bottom walls' front tabs into the inner face layer.
    for wall, strip, wy in (("wall-top", "bezel-inner-top", TOP_WALL), ("wall-bottom", "bezel-inner-bottom", BOT_WALL)):
        polys, _, _ = _placed(wall)
        tabs = _tabs(polys[0], 1, tip)
        morts = sorted(xs for xs, _ in _rects(inner[strip], yr=wy))
        ok(tabs == morts, f"{fname(wall)}: {len(tabs)} front tabs, each on a mortise in {fname(strip)}")
        covered[fname(wall)].append("front tabs into the face")
        covered[fname(strip)].append("mortises under the wall tabs")
    # Side walls and the divider: both halves' front tabs into the inner layer's strips.
    for kind, wx, strips in (("wall-left", LEFT_WALL, ("left-1", "left-2", "left-3")),
                             ("divider", DIVIDER, ("column-1", "column-2", "column-3")),
                             ("wall-right", RIGHT_WALL, ("column-1", "column-2", "column-3"))):
        tabs = []
        for half in ("lower", "upper"):
            n = f"{kind}-{half}"
            part = [p for p in all_parts() if p.name == fname(n)][0]
            x0, y0, _, _ = part.bbox()
            polys, _, _ = read_part(os.path.join(ROOT, "parts", f"{part.name}.dxf"), x0, y0)
            tabs += _tabs(polys[0], 1, tip)
            covered[part.name].append("front tabs into the face")
        morts = sorted(ys for s_ in strips for _, ys in _rects(inner[f"bezel-inner-{s_}"], xr=wx))
        ok(sorted(tabs) == morts, f"{fname(kind)}: {len(tabs)} front tabs, each on a mortise in the face's inner layer")
        for s_ in strips:
            covered[fname(f"bezel-inner-{s_}")].append("mortises under the wall tabs")
    # End tabs of the side walls and divider through the top and bottom walls,
    # and the rails' end tabs too.
    for wall, end, at in (("wall-top", "upper", TOP_WALL[0] + T), ("wall-bottom", "lower", BOT_WALL[1] - T)):
        polys, _, _ = _placed(wall)
        missing = []
        for kind, wx in (("wall-left", LEFT_WALL), ("divider", DIVIDER), ("wall-right", RIGHT_WALL)):
            tp, _, _ = _placed(f"{kind}-{end}")
            tabs = _tabs(tp[0], 0, at)
            morts = sorted(ds for _, ds in _rects(polys, xr=wx))
            if tabs != morts or not tabs:
                missing.append(kind)
        for rname, (cx, w) in RAILS.items():
            for layer in RAIL_SPLITS:
                tp, _, _ = _placed(f"rail-{rname}-{layer}-{end}")
                tabs = _tabs(tp[0], 1, at)
                morts = sorted(xs for xs, ds in _rects(polys, xr=(cx - RAIL_TAB / 2, cx + RAIL_TAB / 2)))
                if tabs != morts or not tabs:
                    missing.append(f"rail {rname} {layer}")
                covered[fname(f"rail-{rname}-{layer}-{end}")].append(f"end tab through {fname(wall)}")
        rail_d = sorted(ds for cx, w in RAILS.values() for _, ds in _rects(polys, xr=(cx - RAIL_TAB / 2, cx + RAIL_TAB / 2)))
        ok(not missing and all(d == (D_RAIL[0], D_RAIL[1]) for d in rail_d),
           f"{fname(wall)}: a mortise for each end tab of the left wall, divider and right wall, and one "
           f"{RAIL_TAB:.0f} x {2 * T:.0f} for both layers of each rail" + (": " + ", ".join(missing) if missing else ""))
        covered[fname(wall)].append("mortises for the walls' and rails' end tabs")
        for kind in ("wall-left", "divider", "wall-right"):
            covered[fname(f"{kind}-{end}")].append(f"end tabs through {fname(wall)}")
    # Stiffeners' tabs into the left wall, divider and right wall.
    walls = {}
    for kind in ("wall-left", "divider", "wall-right"):
        walls[kind] = []
        for half in ("lower", "upper"):
            walls[kind] += _placed(f"{kind}-{half}")[0]
    missing = []
    for name, y, a, b in [(f"stiffener-display-{i + 1}", y, "wall-left", "divider") for i, y in enumerate(STIFF_Y)] + \
                         [("stiffener-column", COL_SPLIT, "divider", "wall-right")]:
        tp, _, _ = _placed(name)
        x0, _, x1, _ = _bbox(("p", tp[0]))
        for kind, at in ((a, x0), (b, x1)):
            tabs = _tabs(tp[0], 0, at)
            morts = sorted(ds for (ys, ds) in _rects(walls[kind], xr=(round(y - T / 2, 2), round(y + T / 2, 2))))
            if tabs != morts or not tabs:
                missing.append(f"{fname(name)} into {kind}")
        covered[fname(name)].append("tabs into the walls")
    ok(not missing, "stiffeners: each tab on a 3 mm mortise in the wall it meets" + (": " + ", ".join(missing) if missing else ""))
    # The screen's window and pocket, and each knob bore inside its pocket.
    outer, oc, _ = _placed("bezel-outer-column-upper")
    pocket = _rects(inner["bezel-inner-column-1"], xr=(round(_dx - DISPLAY[0] / 2 - DISPLAY_CLEAR, 2), round(_dx + DISPLAY[0] / 2 + DISPLAY_CLEAR, 2)))
    win = [r for r in _rects(outer) if r[0][1] - r[0][0] < 80]
    kp = _rects(inner["bezel-inner-column-1"])
    bores_in = all(any(xs[0] < x - r and x + r < xs[1] and ys[0] < y - r and y + r < ys[1] for xs, ys in kp
                       if xs[1] - xs[0] < 40) for x, y, r in oc)
    ok(len(pocket) == 1 and len(win) == 1 and pocket[0][0][0] < win[0][0][0] and win[0][0][1] < pocket[0][0][1]
       and pocket[0][1][0] < win[0][1][0] and win[0][1][1] < pocket[0][1][1] and bores_in,
       "face: the screen's window inside its pocket, each knob bore inside its 35 mm pocket")
    covered["bezel_outer_column_upper"].append("window and bores over the inner layer's pockets")
    covered["bezel_inner_column_1"].append("screen pocket and knob pockets")


def inlet_checks(ok, covered):
    polys, circles, _ = _placed("back-column-lower")
    cut = [q for q in polys if len(q) == 4 and abs((max(p[0] for p in q) - min(p[0] for p in q)) - IEC_CUT[0]) < 0.01]
    cx0, cx1 = min(p[0] for p in cut[0]), max(p[0] for p in cut[0])
    cy0, cy1 = min(p[1] for p in cut[0]), max(p[1] for p in cut[0])
    screws = [c for c in circles if abs(c[1] - (cy0 + cy1) / 2) < 0.01 and abs(abs(c[0] - (cx0 + cx1) / 2) - IEC_SCREW_PITCH / 2) < 0.01]
    outside = all(not (cx0 < x < cx1 and cy0 < y < cy1) for x, y, _ in screws)
    fw, fh = IEC_FLANGE
    fx0, fx1 = (cx0 + cx1) / 2 - fw / 2, (cx0 + cx1) / 2 + fw / 2
    fy0, fy1 = (cy0 + cy1) / 2 - fh / 2, (cy0 + cy1) / 2 + fh / 2
    tray = _bbox(("p", max(polys, key=lambda q: _bbox(("p", q))[2] - _bbox(("p", q))[0])))
    tray_outline = max(polys, key=lambda q: _bbox(("p", q))[2] - _bbox(("p", q))[0])
    under = [c for c in [("p", q) for q in polys if q is not cut[0] and q is not tray_outline]
             + [("c",) + c for c in circles if c not in screws]
             if _bbox(c)[0] < fx1 and fx0 < _bbox(c)[2] and _bbox(c)[1] < fy1 and fy0 < _bbox(c)[3]
             and _bbox(c)[2] - _bbox(c)[0] < 200]
    ok(len(screws) == 2 and outside and not under and tray[0] <= fx0 and fx1 <= tray[2] and tray[1] <= fy0 and fy1 <= tray[3],
       f"inlet: cut-out {cx1 - cx0:.2f} x {cy1 - cy0:.2f} mm, flange screws {IEC_SCREW_PITCH:.0f} mm apart across its "
       f"{IEC_CUT[0]} side and outside the cut-out, and the {fw:.2f} x {fh:.2f} flange on the tray with no other cut under it")
    covered["back_column_lower"].append("inlet cut-out, flange screws and flange footprint")
    tp, tc, _ = read_part(os.path.join(ROOT, "test_cuts", "test_04_inlet.dxf"))
    ok(len(tc) == 2 and abs(math.hypot(tc[0][0] - tc[1][0], tc[0][1] - tc[1][1]) - IEC_SCREW_PITCH) < 0.01
       and abs(tc[0][1] - tc[1][1]) < 0.01,
       "test_04_inlet: the same two flange holes, across the cut-out's short side")


def bom_rows():
    import csv
    with open(os.path.join(ROOT, "bom.csv")) as f:
        return list(csv.DictReader(f))


def bom_checks(ok, covered):
    """Quantities in bom.csv against the holes and parts in the drawings."""
    rows = bom_rows()

    def qty(part, spec=None, note=None):
        hits = [r for r in rows if r["part"] == part and (spec is None or spec in r["spec"]) and (note is None or note in r["notes"])]
        return sum(int(r["qty"]) for r in hits) if hits else -1

    def count(name, d):
        _, circles, _ = _placed(name)
        return sum(1 for c in circles if abs(2 * c[2] - d) < 0.01)

    def slots(name, w):
        polys, _, _ = _placed(name)
        return sum(1 for q in polys if abs((max(p[0] for p in q) - min(p[0] for p in q)) - w) < 0.01 and len(q) > 4)

    panel_slots = sum(slots(f"rail-{r}-front-{e}", SCREW_SLOT[0]) for r in RAILS for e in ("lower", "upper"))
    blocks = sum(len(v) for v in block_centres().values())
    tray_psu = count("back-column-lower", M3_HOLE) - len(IEC_SCREWS) - len(block_centres()["back-column-lower"]) \
        + sum(1 for q in _placed("back-column-lower")[0] if len(q) > 4 and abs(max(p[1] for p in q) - min(p[1] for p in q) - M3_HOLE) < 0.01)
    n_sheets = len([f for f in os.listdir(os.path.join(ROOT, "sheets")) if f.endswith(".dxf")])
    want = [
        ("M4 x 10 pan head screw", None, None, panel_slots, "panel screws, one per rail slot"),
        ("M3 x 10 self-tapping screw", None, "Back cover", blocks, "back cover screws, one per screw block"),
        ("M3 x 16 screw with nut", None, None, len(CARD_HOLES), "card screws"),
        ("M2.5 x 16 screw with nut", None, None, count("back-column-upper", M2_5_HOLE), "Pi screws"),
        ("M3 x 6 screw", None, None, tray_psu, "supply screws, one per hole and slot in the power tray"),
        ("M2.5 x 6 screw", None, None, count("display-bracket", M2_5_HOLE), "screen standoff screws"),
        ("M3 x 10 self-tapping screw", None, "bracket", count("display-bracket", M3_HOLE), "bracket screws into the posts"),
        ("M3 x 12 screw with nut and washer", None, None, len(IEC_SCREWS), "inlet flange screws"),
        ("LED matrix panel", None, None, len(PANEL_CENTRES), "panels"),
        ("HUB75 ribbon", None, None, len(PANEL_CENTRES), "ribbons, one per panel"),
        ("Panel power cable", None, None, len(PANEL_CENTRES) + 1, "power cables, the panels' and the card's"),
        ("Adafruit 4991", None, None, len(KNOBS), "encoder breakouts"),
        ("Rotary encoder with push switch", None, None, len(KNOBS), "encoders"),
        ("Knob", None, None, len(KNOBS), "knobs"),
        ("STEMMA QT cable", None, None, len(KNOBS) - 1, "cables between the breakouts"),
        ("Birch plywood", None, None, n_sheets + 2, "sheets: the box's, one for the test cuts, one spare"),
    ]
    bad = [f"{part}: {qty(part, s_, n_)} in bom.csv, {w} {what}" for part, s_, n_, w, what in want if qty(part, s_, n_) != w]
    ok(not bad, f"bom.csv: {len(want)} quantities match the drawings ({panel_slots} panel screws, {blocks} back cover "
       f"screws, {tray_psu} supply screws, {n_sheets + 2} sheets)" + (": " + "; ".join(bad) if bad else ""))
    for name in ("screw_block", "back_column_lower", "display_bracket", "back_column_upper", "back_display_middle") + \
            tuple(fname(f"rail-{r}-front-{e}") for r in RAILS for e in ("lower", "upper")):
        covered[name].append("hole count against bom.csv")


def svg_checks(ok, covered):
    """Each part's SVG carries the same cuts as its DXF, at the same size."""
    import re
    bad = []
    for p in all_parts():
        polys, circles, _ = read_part(os.path.join(ROOT, "parts", f"{p.name}.dxf"))
        svg = open(os.path.join(ROOT, "parts", f"{p.name}.svg")).read()
        w, h = p.size()
        m = re.search(r'width="([\d.]+)mm" height="([\d.]+)mm"', svg)
        if (svg.count("<polygon") != len(polys) or svg.count("<circle") != len(circles) or not m
                or abs(float(m.group(1)) - w) > 0.01 or abs(float(m.group(2)) - h) > 0.01):
            bad.append(p.name)
        covered[p.name].append("SVG same as DXF")
    ok(not bad, f"every part's SVG has its DXF's cuts at its DXF's size, in millimetres" + (": " + ", ".join(bad) if bad else ""))


def check():
    import ezdxf
    from ezdxf import bbox as ebbox
    from collections import defaultdict
    bad = []
    covered = defaultdict(list)
    def ok(cond, msg):
        print(("ok    " if cond else "FAIL  ") + msg)
        if not cond:
            bad.append(msg)

    files = sorted(f for f in os.listdir(os.path.join(ROOT, "parts")) if f.endswith(".dxf"))
    fails = 0
    for f in files:
        doc = ezdxf.readfile(os.path.join(ROOT, "parts", f))
        auditor = doc.audit()
        b = ebbox.extents(doc.modelspace())
        w, h = b.size.x, b.size.y
        fits = (w <= BED[0] and h <= BED[1]) or (h <= BED[0] and w <= BED[1])
        mm = doc.header.get("$INSUNITS") == 4
        if auditor.has_errors or not fits or not mm:
            fails += 1
            ok(False, f"{f}: {w:.1f} x {h:.1f} mm, audit errors {len(auditor.errors)}, units mm {mm}")
        covered[f[:-4]].append("ezdxf audit, millimetres, fits the bed")
    ok(not fails, f"{len(files)} part DXFs open, pass ezdxf's audit, are in millimetres and fit a {BED[0]:.0f} x {BED[1]:.0f} bed")

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
    part = [p for p in all_parts() if p.name == fname("bezel-outer-column-upper")][0]
    px0, py0, _, _ = part.bbox()
    wins = []
    for e in load("bezel-outer-column-upper").query("LWPOLYLINE"):
        xs_ = [q[0] + px0 for q in e.get_points("xy")]
        ys_ = [q[1] + py0 for q in e.get_points("xy")]
        if 50 < max(xs_) - min(xs_) < 80:
            wins.append((max(xs_) - min(xs_), max(ys_) - min(ys_), (max(xs_) + min(xs_)) / 2, (max(ys_) + min(ys_)) / 2))
    ok(len(wins) == 1 and abs(wins[0][0] - DISPLAY_VIEW[0]) < 0.01 and abs(wins[0][1] - DISPLAY_VIEW[1]) < 0.01
       and abs(wins[0][2] - _dx) < 0.01 and abs(wins[0][3] - _dy) < 0.01,
       f"screen window {wins[0][0]:.2f} x {wins[0][1]:.2f} mm, the Touch Display 2's viewing area, centred on its outline")
    br = [c for c in placed_circles("display-bracket") if abs(c[2] - M2_5_HOLE) < 0.01]
    bxs = sorted({c[0] for c in br})
    bys = sorted({c[1] for c in br})
    ok(len(br) == 4 and abs(bxs[1] - bxs[0] - 49.0) < 0.01 and abs(bys[1] - bys[0] - 58.0) < 0.01,
       f"display bracket: 4 holes {bxs[1] - bxs[0]:.1f} x {bys[1] - bys[0]:.1f} mm, the screen's standoffs (49 x 58)")

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
    hw, hh = DISPLAY[0] / 2, DISPLAY[1] / 2
    boxes["screen"] = (_dx - hw, _dy - hh, T, _dx + hw, _dy + hh, T + DISPLAY_DEPTH)
    post_back = D_BEZEL + POST_LAYERS * T
    # the bracket as its three solid pieces round the notch
    bx0, by0, bx1, by1 = BRACKET
    nlo, nhi = _dy - 30.0, _dy + 12.0
    boxes["screen bracket, left"] = (bx0, by0, post_back, 204.0, by1, post_back + T)
    boxes["screen bracket, right"] = (242.0, by0, post_back, bx1, nlo, post_back + T)
    boxes["screen bracket, right upper"] = (251.0, nlo, post_back, bx1, nhi, post_back + T)
    boxes["screen bracket, top"] = (204.0, nhi, post_back, 251.0, by1, post_back + T)
    for i, (a, b) in enumerate(POSTS):
        boxes[f"screen post {i}"] = (a, POST_Y[0], D_BEZEL, b, POST_Y[1], post_back)
    # the screen's ribbon, out of its connector and round to the Pi
    boxes["screen ribbon"] = (DISPLAY_FFC[0] - 13, DISPLAY_FFC[1] - 6, post_back, DISPLAY_FFC[0] + 13, DISPLAY_FFC[1] + 6, post_back + 15)
    boxes["supply, panels"] = (PSU[0], PSU[1], D_WALL_BACK - 30.0, PSU[2], PSU[3], D_WALL_BACK)
    boxes["supply, Pi and card"] = (PSU_PI[0], PSU_PI[1], D_WALL_BACK - 30.0, PSU_PI[2], PSU_PI[3], D_WALL_BACK)
    # room past each supply's terminal end for the forks and the turn of the wires
    boxes["wiring, panel supply"] = (PSU[0], PSU[1] - WIRE_ROOM, D_WALL_BACK - 30.0, PSU[2], PSU[1], D_WALL_BACK)
    boxes["wiring, Pi supply"] = (PSU_PI_TERMINALS[0], PSU_PI[1] - WIRE_ROOM, D_WALL_BACK - 30.0,
                                  PSU_PI_TERMINALS[1], PSU_PI[1], D_WALL_BACK)
    cx, cy = IEC_CENTRE
    back_face = D_WALL_BACK + T
    boxes["inlet"] = (cx - IEC_CUT[0] / 2, cy - IEC_CUT[1] / 2, back_face - IEC_DEPTH, cx + IEC_CUT[0] / 2, cy + IEC_CUT[1] / 2, D_WALL_BACK)
    # its spade terminals and their wires, forward of the body
    boxes["inlet's spades"] = (cx - IEC_CUT[0] / 2, cy - IEC_CUT[1] / 2, back_face - IEC_DEPTH - 12.0,
                               cx + IEC_CUT[0] / 2, cy + IEC_CUT[1] / 2, back_face - IEC_DEPTH)
    for i, (x, y) in enumerate(IEC_SCREWS):
        boxes[f"inlet flange nut {i}"] = (x - 3.5, y - 3.5, D_WALL_BACK - 4.0, x + 3.5, y + 3.5, D_WALL_BACK)
    # the Pi's power: a right-angle USB-C plug on the pigtail
    ux, uy = PI_USB_C
    boxes["Pi's USB-C plug"] = (ux, uy - 6.0, board_face - 1.6 - 10.0, ux + 15.0, uy + 6.0, board_face - 1.6)
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

    for n in ("top", "bottom", "left-upper", "left-lower", "column-upper", "column-lower"):
        covered[fname(f"bezel-outer-{n}")].append("aperture against two panels each way")
    covered["bezel_outer_column_upper"] += ["knob bores 45 mm apart", "screen window = viewing area, centred"]
    covered["display_bracket"].append("standoff holes 49 × 58")
    covered["back_display_middle"].append("the 5A-75B's four holes")
    covered["back_column_upper"].append("the Pi 5's 49 × 58")
    for r in RAILS:
        for layer in RAIL_SPLITS:
            for e in ("lower", "upper"):
                covered[fname(f"rail-{r}-{layer}-{e}")].append("screw slots and pin holes against the panel drawing")
    for e in ("lower", "upper"):
        covered[fname(f"wall-left-{e}")].append("length between the top and bottom walls")
    in_layout = {
        "rail": [p.name for p in all_parts() if p.name.startswith("rail_")],
        "wall": ["wall_top", "wall_bottom"] + [fname(f"{k}-{e}") for k in ("wall-left", "divider", "wall-right") for e in ("lower", "upper")],
        "stiffener": ["stiffener_display_1", "stiffener_display_2", "stiffener_column"],
        "block": ["screw_block"] + [p.name for p in all_parts() if p.name.startswith("back_")],
        "card": ["back_display_middle", "ring_card"], "Pi": ["back_column_upper", "ring_pi"],
        "knob": ["bezel_outer_column_upper", "bezel_inner_column_1"], "screen": ["bezel_inner_column_1"],
        "screen post": ["display_post"], "screen bracket": ["display_bracket"],
        "supply": ["back_column_lower"], "inlet": ["back_column_lower"], "splice": ["splice"],
    }
    for key, parts_ in in_layout.items():
        if any(n.startswith(key) for n in names):
            for n in parts_:
                covered[n].append("3D layout: no overlap")

    # Rings: two under each of the card's and the Pi's screws, bored for them.
    rc = read_part(os.path.join(ROOT, "parts", "ring_card.dxf"))[1]
    rp = read_part(os.path.join(ROOT, "parts", "ring_pi.dxf"))[1]
    qty_ = {p.name: p.qty for p in all_parts()}
    ok(qty_["ring_card"] == RING_LAYERS * len(CARD_HOLES) and qty_["ring_pi"] == RING_LAYERS * len(PI_HOLES)
       and abs(2 * min(c[2] for c in rc) - M3_HOLE) < 0.01 and abs(2 * min(c[2] for c in rp) - M2_5_HOLE) < 0.01
       and RING_LAYERS * T + 1.6 + 2.4 + T <= 16.0,
       f"rings: {qty_['ring_card']} for the card bored {M3_HOLE} and {qty_['ring_pi']} for the Pi bored {M2_5_HOLE}, "
       f"{RING_LAYERS} under each screw; back, rings, board and nut take {RING_LAYERS * T + 1.6 + 2.4 + T:.1f} of a 16 mm screw")
    covered["ring_card"].append("count and bore against the card's screws")
    covered["ring_pi"].append("count and bore against the Pi's screws")

    # Cradles: the box drops into the notch, and the front lip stays below the LEDs.
    cp = read_part(os.path.join(ROOT, "parts", "cradle.dxf"))[0][0]
    ys = sorted({round(q[1], 2) for q in cp})
    floor = sorted(q[0] for q in cp if abs(q[1] - 15.0) < 0.01)
    notch = max(floor[i + 1] - floor[i] for i in range(len(floor) - 1))
    lip_front = max(q[1] for q in cp if q[0] < floor[0] + 0.01) - 15.0
    ok(D_WALL_BACK + T < notch < D_WALL_BACK + T + 1.0 and lip_front < Y_T - AP_Y,
       f"cradle: notch {notch:.1f} mm for a box {D_WALL_BACK + T:.0f} deep; front lip {lip_front:.0f} mm, "
       f"under the {Y_T - AP_Y:.2f} mm of face below the LEDs")
    covered["cradle"].append("notch against the box's depth, lip below the LEDs")

    # Test cuts: the same holes as the parts they stand for.
    kp_, kc_, _ = read_part(os.path.join(ROOT, "test_cuts", "test_01_kerf_comb.dxf"))
    widths = sorted(round(max(q[0] for q in r) - min(q[0] for q in r), 2) for r in kp_[1:])
    t2 = read_part(os.path.join(ROOT, "test_cuts", "test_02_knob_and_display.dxf"))[1]
    st = sorted((round(c[0], 2), round(c[1], 2)) for c in t2 if abs(2 * c[2] - M2_5_HOLE) < 0.01)
    t3p, t3c, _ = read_part(os.path.join(ROOT, "test_cuts", "test_03_panel_rail.dxf"))
    ok(widths == [round(T + d, 2) for d in (-0.2, -0.1, 0.0, 0.1, 0.2)]
       and any(abs(2 * c[2] - KNOB_BORE) < 0.01 for c in t2) and len(st) == 4
       and abs(st[2][0] - st[0][0] - 49.0) < 0.01 and abs(st[1][1] - st[0][1] - 58.0) < 0.01
       and len(t3p) - 1 == 4 and len(t3c) == 2,
       f"test cuts: comb {widths[0]}..{widths[-1]} mm, a {KNOB_BORE} knob bore and the screen's 49 x 58, "
       f"one panel side's 4 slots and 2 pin holes")

    # The knobs' lead: from k2's breakout over the top of the screen, down behind
    # it and its bracket to the header's pin 1. Its length has to cover that and
    # leave slack for the plugs and the bends.
    k2x, k2y = KNOBS["k2"]
    top = _dy + DISPLAY[1] / 2
    behind = post_back + T + 3.0
    route = ((k2y - top - 2.0) + (behind - 12.0) + (top + 2.0 - PI_PIN1[1])
             + abs(PI_PIN1[0] - (k2x - 12.7)) + (board_face - 1.6 - 8.5 - 4.0 - behind))
    ok(KNOB_LEAD >= route + 40.0, f"knob lead: k2 to the Pi's pin 1 is {route:.0f} mm round the screen; "
       f"the lead is {KNOB_LEAD:.0f}, {KNOB_LEAD - route:.0f} to spare")

    geometry_checks(ok, covered)
    joint_checks(ok, covered)
    inlet_checks(ok, covered)
    bom_checks(ok, covered)
    svg_checks(ok, covered)

    if "--parts" in sys.argv:
        print()
        print("| Part | Pieces | Size (mm) | Holes | Thinnest web (mm) | Checked against |")
        print("| :--- | ---: | :--- | ---: | ---: | :--- |")
        for p in all_parts():
            g = PART_GEOMETRY.get(p.name, {})
            w, h = p.size()
            web = g.get("web", float("nan"))
            print(f"| `{p.name}` | {p.qty} | {w:.1f} × {h:.1f} | {g.get('holes', 0)} | "
                  f"{'-' if web != web else f'{web:.1f}'} | {'; '.join(dict.fromkeys(covered[p.name]))} |")
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
