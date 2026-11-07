#!/usr/bin/env python3
"""Patternflow 2x2: four 128 x 64 panels in one laser-cut box.

    python big2x2.py                          # 3 mm sheet, 0.15 mm kerf
    python big2x2.py --thickness 3.18 --kerf 0.12

Writes ../dxf/ (one file per part), ../sheets/ (the parts nested on 600 x 300
mm sheets, as DXF and SVG) and ../images/ (the previews in the README). The
same run with the same arguments writes the same bytes.

CC-BY-SA-4.0, like the rest of this folder (its README is the license header).

One frame for the whole box, in millimetres. The origin is the middle of the
display, x to the right and y up as you face it, z toward you. z = 0 is the
LED face. The box stands the way the stock Patternflow stands: the panels
upright (each one 160 wide, 320 tall), a column for the knobs on the right.

Each part is drawn as it is seen from outside the box, from the back for the
parts that sit behind the panels, so the face up on the laser bed is the
face you see. Every cut edge is moved out of the part by half the kerf, so
a hole drawn 4.5 cuts at 4.5 and a 3 mm tab fills a 3 mm mortise.
"""

import argparse
import math
import os
import sys

import ezdxf
from shapely import affinity
from shapely.geometry import Polygon, box
from shapely.ops import unary_union

# no timestamps and no fresh GUIDs, so a rerun writes the same bytes
ezdxf.options.write_fixed_meta_data_for_testing = True

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)

SHEET_W, SHEET_H = 600.0, 300.0      # cut area; a 12 x 24 in sheet is 305 x 610
SHEET_MARGIN, SHEET_GAP = 4.0, 3.0

# ---------------------------------------------------------------- the panel
# The 320 x 160 P2.5 module the build guide links, standing upright. Measured
# off the maker's drawing on page 6 of hardware/case/remixes/simonepda-lasercut/
# lasercut_layout.pdf and the holes its page 3 cuts (that plate was built three
# times): twelve M4 inserts, two 3.48 mm locating pins 4 mm tall, 14 mm deep.
PANEL_W, PANEL_H, PANEL_D = 160.0, 320.0, 14.0
PANEL_EDGE_X = 68.5                                  # inserts along the long edges
PANEL_EDGE_Y = (-122.5, -31.5, 31.5, 122.5)
PANEL_END_X = (-42.5, 42.5)                          # inserts at the short ends
PANEL_END_Y = 148.5
PANEL_PIN = (68.5, 70.0)                             # (-68.5, +70) and (+68.5, -70)
PANEL_CENTRES = [(-80.0, 160.0), (80.0, 160.0), (-80.0, -160.0), (80.0, -160.0)]

M4_SLOT_W, M4_SLOT_L = 4.5, 6.0     # 1.5 mm of play sideways, to close the seam
PIN_HOLE = 5.0
M3_HOLE, M25_HOLE, M3_NUT_AF = 3.4, 2.9, 5.5
ENC_HOLE = 7.2                      # PEC11R / EC11 bushing, M7
IEC_CUT = (46.75, 27.25)            # AC-14-F16A inlet with switch and fuse
IEC_SCREW_PITCH, IEC_SCREW_HOLE = 40.0, 3.2


class Box:
    """Every dimension that depends on the sheet thickness."""

    def __init__(s, T):
        s.T = T
        s.CL = 0.3                                   # panel to wall, each side
        s.XO, s.YO = PANEL_W + s.CL, PANEL_H + s.CL  # half the opening
        s.xLo, s.xLi = -s.XO - T, -s.XO              # left wall
        s.xDi, s.xDo = s.XO, s.XO + T                # divider
        s.CW = 104.0                                 # column, inside
        s.xRi = s.xDo + s.CW
        s.xRo = s.xRi + T                            # right wall
        s.yTi, s.yTo = s.YO, s.YO + T                # top wall
        s.yBi, s.yBo = -s.YO, -s.YO - T
        s.zLip = 3.0                                 # walls stand 3 mm proud of the LEDs
        s.zBack = -75.0                              # walls' back edge
        s.zCover = s.zBack - T
        s.zPanelBack = -PANEL_D
        s.zRailF, s.zRailB = s.zPanelBack, s.zPanelBack - 2 * T   # two sheets
        s.zStrB, s.zStrF = s.zBack, s.zBack + 3 * T               # three sheets
        s.zPlateF = s.zRailB - 4 * T                 # four rings under the plate
        s.zPlateB = s.zPlateF - T
        s.zColF, s.zColB = 0.0, -T                   # column front, LED face flush
        s.cx = (s.xDo + s.xRi) / 2                   # column centre line
        # rails on the panel backs, each centred on a row of end inserts
        s.rail_top = (160 + PANEL_END_Y - 10, 160 + PANEL_END_Y + 10)
        s.rail_mid = (-21.5, 21.5)
        s.rail_bot = (-s.rail_top[1], -s.rail_top[0])
        s.seam = (-20.0, 20.0)
        s.seam_up = (s.rail_mid[1] + 0.5, s.rail_top[0] - 0.5)
        s.seam_dn = (s.rail_bot[1] + 0.5, s.rail_mid[0] - 0.5)
        # back cover: three pieces across the whole width, a stringer under
        # each joint, one in the middle and one at each end
        s.H = 2 * s.yTo
        s.joint = s.H / 6
        s.stringers = {
            "top": (s.yTi - 20, s.yTi),
            "upper": (s.joint - 10, s.joint + 10),
            "middle": (-10.0, 10.0),
            "lower": (-s.joint - 10, -s.joint + 10),
            "bottom": (s.yBi, s.yBi + 20),
        }
        s.cover_x = (-130.0, 0.0, 130.0, round(s.cx, 1))
        s.cover_rows = {
            "top": [s.yTi - 10, s.joint + 5],
            "middle": [s.joint - 5, 0.0, -s.joint + 5],
            "bottom": [-s.joint - 5, s.yBi + 10],
        }
        s.cover_y = {"top": (s.joint, s.yTo), "middle": (-s.joint, s.joint),
                     "bottom": (s.yBo, -s.joint)}
        # knobs: the stock 2 x 2, on a 40 mm grid, at the top of the column
        s.knobs = [(s.cx + dx, y) for y in (270.0, 230.0) for dx in (-20.0, 20.0)]
        # electronics plate behind the middle of the display
        s.plate = (-60.0, 60.0, -285.0, 195.0)
        s.plate_mounts = [(0.0, 185.0), (0.0, 98.0), (-54.0, 0.0), (54.0, 0.0),
                          (0.0, -105.0), (0.0, -275.0)]
        # Colorlight 5A-75B, RJ45 end up. Holes from patternflood's measured
        # template (hardware/laser/test-cuts/07), its 4 mm margin taken off.
        s.card = (-45.88, 45.88, -66.0, 77.67)
        s.card_holes = [(s.card[0] + hx, s.card[2] + hy) for hx, hy in
                        ((5.11, 139.08), (86.51, 139.35), (16.07, 3.81), (76.44, 3.96))]
        # Raspberry Pi 5, 85 x 56, holes on 58 x 49
        s.pi = (-42.5, 42.5, 118.0, 174.0)
        s.pi_holes = [(s.pi[0] + hx, s.pi[2] + hy) for hx, hy in
                      ((3.5, 3.5), (61.5, 3.5), (3.5, 52.5), (61.5, 52.5))]
        s.fuse_slots = [(0.0, -170.0), (0.0, -250.0)]    # 4.2 x 30, along y
        # Mean Well LRS-150F-5 (159 x 97 x 30), against the divider in the
        # lower column, base toward the front, terminals toward the back cover
        s.psu = (s.xDo, s.xDo + 97.0, -316.0, -157.0, -34.0, -4.0)
        # its side inserts (3-M3, L = 5): 22 and 139 from the terminal end,
        # 15 from the base, and 6 and 24 for the pair. Both ways up are drilled.
        s.psu_holes = [(-157.0 - 22, -4.0 - 15), (-157.0 - 139, -4.0 - 6),
                       (-157.0 - 139, -4.0 - 24),
                       (-316.0 + 22, -4.0 - 15), (-316.0 + 139, -4.0 - 6),
                       (-316.0 + 139, -4.0 - 24)]
        s.iec = (-115.0, -36.0)                       # on the right wall, (y, z)
        s.pass_5v = (-150.0, -50.0, 30.0, 16.0)       # divider, (y, z, len, width)
        s.pass_i2c = (215.0, -50.0, 14.0)             # divider, (y, z, dia)
        s.feet_x = (-110.0, round(s.cx, 1))
        s.foot_z = (-38.0 - 100, -38.0 + 100)         # 200 long, under the box's middle
        s.foot_screws_z = (-55.0, -20.0)
        # finger joints between the walls, along z
        s.fingers = 5
        s.div_tabs = [(-60.0, -45.0), (-30.0, -15.0)]  # divider into top/bottom wall
        s.col_side_tabs_up = [(30.0, 60.0), (140.0, 170.0), (250.0, 280.0)]
        s.col_side_tabs_dn = [(-60.0, -30.0), (-170.0, -140.0), (-280.0, -250.0)]
        s.col_end_tabs = [(s.cx - 37, s.cx - 17), (s.cx + 17, s.cx + 37)]

    def finger_segments(s):
        n = s.fingers
        step = (s.zLip - s.zBack) / n
        return [(s.zBack + i * step, s.zBack + (i + 1) * step, i % 2 == 0) for i in range(n)]


# ------------------------------------------------------------------ parts

class Part:
    def __init__(self, name, qty, shape, view, what):
        self.name, self.qty, self.view, self.what = name, qty, view, what
        self.shape = shape            # shapely Polygon, outline with mortises
        self.circles = []             # (x, y, d)
        self.slots = []               # (x, y, w, l, angle_deg)
        self.hexes = []               # (x, y, af)

    def map(self, f):
        """Turn the part into its drawing frame. f maps a point and must be
        a mirror or a rotation; the features move with it."""
        self.shape = Polygon(*_map_poly(self.shape, f))
        self.circles = [(*f(x, y), d) for x, y, d in self.circles]
        out = []
        for x, y, w, l, a in self.slots:
            ex, ey = math.cos(math.radians(a)), math.sin(math.radians(a))
            p0, p1 = f(x, y), f(x + ex, y + ey)
            out.append((*p0, w, l, math.degrees(math.atan2(p1[1] - p0[1], p1[0] - p0[0]))))
        self.slots = out
        self.hexes = [(*f(x, y), af) for x, y, af in self.hexes]
        return self

    def bounds(self):
        return self.shape.bounds

    def normalised(self):
        """A copy with its bounding box at the origin."""
        x0, y0, _, _ = self.bounds()
        return self.moved(-x0, -y0)

    def moved(self, dx, dy, rot=False):
        p = Part(self.name, self.qty, self.shape, self.view, self.what)
        f = (lambda x, y: (-y, x)) if rot else (lambda x, y: (x, y))
        p.circles, p.slots, p.hexes = list(self.circles), list(self.slots), list(self.hexes)
        if rot:
            p.map(f)
            x0, y0, _, _ = p.bounds()
            dx, dy = dx - x0, dy - y0
        p.shape = affinity.translate(p.shape, dx, dy)
        p.circles = [(x + dx, y + dy, d) for x, y, d in p.circles]
        p.slots = [(x + dx, y + dy, w, l, a) for x, y, w, l, a in p.slots]
        p.hexes = [(x + dx, y + dy, af) for x, y, af in p.hexes]
        return p


def _map_poly(poly, f):
    ext = [f(x, y) for x, y in poly.exterior.coords]
    ints = [[f(x, y) for x, y in r.coords] for r in poly.interiors]
    return ext, ints


def rect(x0, y0, x1, y1):
    return box(min(x0, x1), min(y0, y1), max(x0, x1), max(y0, y1))


def rounded(x0, y0, x1, y1, r):
    return rect(x0, y0, x1, y1).buffer(-r, join_style=2).buffer(r, resolution=8)


def single(geom):
    if geom.geom_type != "Polygon":
        raise ValueError(f"part fell apart: {geom.geom_type}")
    return geom


# view maps, from the box frame to the drawing
FROM_LEFT = lambda y, z: (-y, z)        # left wall, seen from outside
FROM_RIGHT = lambda y, z: (y, z)        # right wall and divider, seen from +x
FROM_TOP = lambda x, z: (x, -z)         # top wall, seen from above
FROM_BELOW = lambda x, z: (x, z)        # bottom wall and feet, seen from below
FROM_FRONT = lambda x, y: (x, y)
FROM_BACK = lambda x, y: (-x, y)


def wall_side(b, which, half):
    """Left wall, right wall or divider, upper or lower half, in (y, z)."""
    y0, y1 = (0.0, b.yTi) if half == "upper" else (b.yBi, 0.0)
    shape = rect(y0, b.zBack, y1, b.zLip)
    end = b.yTi if half == "upper" else b.yBi
    out = b.yTo if half == "upper" else b.yBo
    if which == "divider":
        for za, zb in b.div_tabs:
            shape = shape.union(rect(end, za, out, zb))
    else:
        for za, zb, wall_owns in b.finger_segments():
            if not wall_owns:                     # odd segments belong to the sides
                shape = shape.union(rect(end, za, out, zb))
    cuts = []
    # rails through the wall
    rails = [b.rail_top if half == "upper" else b.rail_bot, b.rail_mid]
    if which == "right":
        rails = [b.rail_mid]
    for ra, rb in rails:
        cuts.append(rect(ra, b.zRailB, rb, b.zRailF))
    # stringers drop into notches from the back edge
    for sa, sb in b.stringers.values():
        cuts.append(rect(sa, b.zBack - 1, sb, b.zStrF))
    # the column front's tabs
    if which in ("divider", "right"):
        for ta, tb in (b.col_side_tabs_up if half == "upper" else b.col_side_tabs_dn):
            cuts.append(rect(ta, b.zColB, tb, b.zColF))
    shape = shape.difference(unary_union(cuts))
    shape = shape.intersection(rect(min(y0, out) - 1, b.zBack, max(y1, out) + 1, b.zLip))
    names = {"left": "wall_left", "right": "wall_right", "divider": "divider"}
    what = {"left": "left wall", "right": "right wall, inlet side",
            "divider": "between the panels and the column"}[which]
    p = Part(f"{names[which]}_{half}", 1, single(shape),
             "from outside" if which != "divider" else "from the column", f"{what}, {half} half")
    if which == "divider":
        if half == "lower":
            for y, z in b.psu_holes:
                p.circles.append((y, z, M3_HOLE))
            y, z, ln, w = b.pass_5v
            p.slots.append((y, z, w, ln, 0.0))
        else:
            y, z, d = b.pass_i2c
            p.circles.append((y, z, d))
    if which == "right" and half == "lower":
        y, z = b.iec
        w, h = IEC_CUT
        p.shape = single(p.shape.difference(rect(y - w / 2, z - h / 2, y + w / 2, z + h / 2)))
        for dz in (-IEC_SCREW_PITCH / 2, IEC_SCREW_PITCH / 2):
            p.circles.append((y, z + dz, IEC_SCREW_HOLE))
    return p.map(FROM_LEFT if which == "left" else FROM_RIGHT)


def wall_end(b, which):
    """Top or bottom wall, in (x, z)."""
    shape = rect(b.xLi, b.zBack, b.xRi, b.zLip)
    for za, zb, wall_owns in b.finger_segments():
        if wall_owns:
            shape = shape.union(rect(b.xLo, za, b.xLi, zb)).union(rect(b.xRi, za, b.xRo, zb))
    cuts = [rect(b.xDi, za, b.xDo, zb) for za, zb in b.div_tabs]
    cuts += [rect(xa, b.zColB, xb, b.zColF) for xa, xb in b.col_end_tabs]
    # vents, behind the panels and in the column; the bottom wall's stay
    # clear of the feet
    clear = b.feet_x if which == "bottom" else ()
    vx = [x for x in range(-150, 151, 12) if all(abs(x - f) > 14 for f in clear)]
    vx += [x for x in range(int(b.xDo + 14), int(b.xRi - 9), 12)
           if all(abs(x - f) > 14 for f in clear)]
    for x in vx:
        cuts.append(rect(x - 2, -62.0, x + 2, -16.0))
    shape = single(shape.difference(unary_union(cuts)))
    p = Part(f"wall_{which}", 1, shape, "from outside",
             f"{which} wall, the whole width, vents behind the panels")
    if which == "bottom":
        for x in b.feet_x:
            for z in b.foot_screws_z:
                p.circles.append((x, z, M3_HOLE))
    return p.map(FROM_TOP if which == "top" else FROM_BELOW)


def column_front(b, half):
    up = half == "upper"
    y0, y1 = (0.0, b.yTi) if up else (b.yBi, 0.0)
    shape = rect(b.xDo, y0, b.xRi, y1)
    for ta, tb in (b.col_side_tabs_up if up else b.col_side_tabs_dn):
        shape = shape.union(rect(b.xDi, ta, b.xDo, tb)).union(rect(b.xRi, ta, b.xRo, tb))
    ye, yo = (b.yTi, b.yTo) if up else (b.yBi, b.yBo)
    for xa, xb in b.col_end_tabs:
        shape = shape.union(rect(xa, ye, xb, yo))
    p = Part(f"column_front_{half}", 1, single(shape), "from the front",
             "column front, " + ("the four knobs" if up else "blank"))
    if up:
        for x, y in b.knobs:
            p.circles.append((x, y, ENC_HOLE))
    return p.map(FROM_FRONT)


def knob_doubler(b):
    ys = [y for _, y in b.knobs]
    shape = rect(b.xDo, min(ys) - 25, b.xRi, max(ys) + 25)
    shape = shape.difference(unary_union([rect(x - 8, y - 8, x + 8, y + 8) for x, y in b.knobs]))
    p = Part("knob_doubler", 1, single(shape), "from the front",
             "glued behind the column front; the encoder bodies sit in its pockets")
    return p.map(FROM_FRONT)


def column_splice(b):
    p = Part("column_splice", 1, rect(b.xDo, -15.0, b.xRi, 15.0), "from the front",
             "glued behind the joint between the two column fronts")
    return p.map(FROM_FRONT)


def rail(b, which, layer):
    """Rails lie flat on the panel backs, two sheets glued. layer 'front'
    touches the panels and holds the nuts for the electronics plate."""
    if which == "mid":
        ya, yb = b.rail_mid
        shape = rect(b.xLo, ya, b.xRo, yb)
    else:
        ya, yb = b.rail_top if which == "top" else b.rail_bot
        shape = rect(b.xLo, ya, b.xDo, yb)
    p = Part(f"rail_{which}_{layer}", 1, shape, "from the back",
             f"{which} rail, {'the sheet against the panels' if layer == 'front' else 'the sheet behind it'}")
    ys = {"top": [PANEL_END_Y + 160], "bot": [-PANEL_END_Y - 160],
          "mid": [160 - PANEL_END_Y, -160 + PANEL_END_Y]}[which]
    for cx, _ in PANEL_CENTRES[:2]:
        for dx in PANEL_END_X:
            for y in ys:
                p.slots.append((cx + dx, y, M4_SLOT_W, M4_SLOT_L, 0.0))
    if which == "mid":
        for x, y in b.plate_mounts:
            if b.rail_mid[0] < y < b.rail_mid[1]:
                (p.hexes if layer == "front" else p.circles).append(
                    (x, y, M3_NUT_AF) if layer == "front" else (x, y, M3_HOLE))
    return p.map(FROM_BACK)


def seam_rail(b, half, layer):
    ya, yb = b.seam_up if half == "upper" else b.seam_dn
    p = Part(f"seam_{half}_{layer}", 1, rect(b.seam[0], ya, b.seam[1], yb), "from the back",
             f"along the seam between the two {half} panels, "
             + ("the sheet against the panels" if layer == "front" else "the sheet behind it"))
    cy = 160.0 if half == "upper" else -160.0
    for cx in (-80.0, 80.0):
        x = cx + (PANEL_EDGE_X if cx < 0 else -PANEL_EDGE_X)     # the inner edge
        for dy in PANEL_EDGE_Y:
            p.slots.append((x, cy + dy, M4_SLOT_W, M4_SLOT_L, 0.0))
        for dy in (-PANEL_PIN[1], PANEL_PIN[1]):                  # either way up
            p.circles.append((x, cy + dy, PIN_HOLE))
    for x, y in b.plate_mounts:
        if ya < y < yb and b.seam[0] < x < b.seam[1]:
            if layer == "front":
                p.hexes.append((x, y, M3_NUT_AF))
            else:
                p.circles.append((x, y, M3_HOLE))
    return p.map(FROM_BACK)


def stringer(b, key, layer):
    ya, yb = b.stringers[key]
    p = Part(f"stringer_{key}_{layer}", 1, rect(b.xLo, ya, b.xRo, yb), "from the back",
             f"{key} stringer, three sheets glued; the {layer} one"
             + (" holds the nuts" if layer == "middle" else ""))
    rows = [y for ys in b.cover_rows.values() for y in ys if ya < y < yb]
    for y in rows:
        for x in b.cover_x:
            if layer == "middle":
                p.hexes.append((x, y, M3_NUT_AF))
            else:
                p.circles.append((x, y, M3_HOLE))
    return p.map(FROM_BACK)


def back_cover(b, key):
    ya, yb = b.cover_y[key]
    p = Part(f"back_{key}", 1, rect(b.xLo, ya, b.xRo, yb), "from the back",
             f"back cover, {key} third")
    for y in b.cover_rows[key]:
        for x in b.cover_x:
            p.circles.append((x, y, M3_HOLE))
    return p.map(FROM_BACK)


def electronics_plate(b):
    x0, x1, y0, y1 = b.plate
    p = Part("electronics_plate", 1, rounded(x0, y0, x1, y1, 4.0), "from the back",
             "behind the middle of the display: the Pi 5, the 5A-75B and the fuse box")
    for x, y in b.plate_mounts:
        p.circles.append((x, y, M3_HOLE))
    for x, y in b.card_holes:
        p.circles.append((x, y, M3_HOLE))
    for x, y in b.pi_holes:
        p.circles.append((x, y, M25_HOLE))
    for x, y in b.fuse_slots:
        p.slots.append((x, y, 4.2, 30.0, 90.0))
    # cable-tie anchors beside the card and the fuse box, a pair of slots each
    for y in (-30.0, 40.0, -210.0):
        for x in (-53.0, 53.0):
            for dy in (-4.0, 4.0):
                p.slots.append((x, y + dy, 2.4, 6.0, 0.0))
    return p.map(FROM_BACK)


def foot(b, layer):
    z0, z1 = b.foot_z
    p = Part(f"foot_{layer}", 2, rounded(-20.0, z0, 20.0, z1, 10.0), "from below",
             f"foot, three sheets glued; the {layer} one" +
             (" holds the nuts" if layer == "middle" else ""))
    for z in b.foot_screws_z:
        if layer == "middle":
            p.hexes.append((0.0, z, M3_NUT_AF))
        else:
            p.circles.append((0.0, z, M3_HOLE))
    return p.map(FROM_BELOW)


def ring(name, qty, od, idia, what):
    p = Part(name, qty, rounded(-od / 2, -od / 2, od / 2, od / 2, od / 2 - 0.01), "either face", what)
    p.circles.append((0.0, 0.0, idia))
    return p


def panel_template():
    """One panel's back, its inserts and pins, to hold against a real panel
    before cutting the rails."""
    w, h = PANEL_W, PANEL_H
    p = Part("panel_template", 1, rect(-w / 2, -h / 2, w / 2, h / 2), "from the back",
             "test piece: lay it on a panel's back; every insert should show through")
    for sx in (-1, 1):
        for y in PANEL_EDGE_Y:
            p.circles.append((sx * PANEL_EDGE_X, y, 4.5))
        p.circles.append((sx * PANEL_EDGE_X, 0.0, 2.0))      # some panels have a middle one
        for sy in (-1, 1):
            p.circles.append((sx * PANEL_PIN[0], sy * PANEL_PIN[1], PIN_HOLE))
            p.circles.append((PANEL_END_X[0 if sx < 0 else 1], sy * PANEL_END_Y, 4.5))
    return p.map(FROM_BACK)


def test_coupon(b):
    T = b.T
    shape = rect(0, 0, 130, 50).difference(rect(10, 10, 30, 10 + T))
    p = Part("test_coupon", 1, single(shape), "either face",
             "test piece: the key should push through the slot and hold")
    for i, d in enumerate((M3_HOLE, M4_SLOT_W, PIN_HOLE, ENC_HOLE)):
        p.circles.append((45 + i * 14, 15.0, d))
    p.hexes.append((105.0, 15.0, M3_NUT_AF))
    p.slots.append((118.0, 15.0, M4_SLOT_W, M4_SLOT_L, 0.0))
    p.circles.append((20.0, 35.0, IEC_SCREW_HOLE))
    key = Part("test_key", 1, rect(0, 0, 20, 40), "either face", "test piece: the key")
    return [p, key]


def all_parts(b):
    parts = []
    for which in ("left", "right", "divider"):
        for half in ("upper", "lower"):
            parts.append(wall_side(b, which, half))
    parts += [wall_end(b, "top"), wall_end(b, "bottom")]
    parts += [column_front(b, "upper"), column_front(b, "lower"), knob_doubler(b), column_splice(b)]
    for which in ("top", "mid", "bot"):
        for layer in ("front", "back"):
            parts.append(rail(b, which, layer))
    for half in ("upper", "lower"):
        for layer in ("front", "back"):
            parts.append(seam_rail(b, half, layer))
    for key in b.stringers:
        for layer in ("front", "middle", "back"):
            parts.append(stringer(b, key, layer))
    for key in ("top", "middle", "bottom"):
        parts.append(back_cover(b, key))
    parts.append(electronics_plate(b))
    for layer in ("top", "middle", "bottom"):
        parts.append(foot(b, layer))
    parts.append(ring("ring_plate", 4 * len(b.plate_mounts), 10.0, M3_HOLE,
                      "spacer under the electronics plate, four a screw"))
    parts.append(ring("ring_card", 8, 8.0, M3_HOLE, "spacer under the 5A-75B, two a screw"))
    parts.append(ring("ring_pi", 8, 7.0, M25_HOLE, "spacer under the Pi 5, two a screw"))
    return parts


def test_parts(b):
    return [panel_template()] + test_coupon(b)


# ---------------------------------------------------------------- output

def kerfed(part, kerf):
    k = kerf / 2
    shape = part.shape.buffer(k, join_style=2, mitre_limit=4.0) if k else part.shape
    circles = [(x, y, d - kerf) for x, y, d in part.circles]
    slots = [(x, y, w - kerf, l, a) for x, y, w, l, a in part.slots]
    hexes = [(x, y, af - kerf) for x, y, af in part.hexes]
    return shape, circles, slots, hexes


def slot_points(x, y, w, l, a):
    """A stadium as polyline points with bulges: centre (x, y), width w,
    centre-to-centre length l - w along angle a."""
    r = w / 2
    half = max(l / 2 - r, 0.0)
    ex, ey = math.cos(math.radians(a)), math.sin(math.radians(a))
    nx, ny = -ey, ex
    p1 = (x + ex * half + nx * r, y + ey * half + ny * r)
    p2 = (x - ex * half + nx * r, y - ey * half + ny * r)
    p3 = (x - ex * half - nx * r, y - ey * half - ny * r)
    p4 = (x + ex * half - nx * r, y + ey * half - ny * r)
    return [(*p1, 0), (*p2, 1), (*p3, 0), (*p4, 1)]


def hex_points(x, y, af):
    r = af / math.sqrt(3)
    return [(x + r * math.cos(math.radians(60 * i)), y + r * math.sin(math.radians(60 * i)))
            for i in range(6)]


def _r(v):
    return round(v, 4) + 0.0


def write_dxf(path, placed, kerf):
    doc = ezdxf.new("R2010", setup=False)
    doc.header["$INSUNITS"] = 4                       # millimetres
    doc.header["$MEASUREMENT"] = 1
    doc.layers.add("CUT", color=1)
    msp = doc.modelspace()
    att = {"layer": "CUT"}
    for part in placed:
        shape, circles, slots, hexes = kerfed(part, kerf)
        for ring_ in [shape.exterior, *shape.interiors]:
            pts = [(_r(x), _r(y)) for x, y in list(ring_.coords)[:-1]]
            msp.add_lwpolyline(pts, close=True, dxfattribs=att)
        for x, y, d in circles:
            msp.add_circle((_r(x), _r(y)), _r(d / 2), dxfattribs=att)
        for s in slots:
            msp.add_lwpolyline([(_r(a), _r(b), 0, 0, c) for a, b, c in slot_points(*s)],
                               format="xyseb", close=True, dxfattribs=att)
        for x, y, af in hexes:
            msp.add_lwpolyline([(_r(a), _r(b)) for a, b in hex_points(x, y, af)],
                               close=True, dxfattribs=att)
    doc.saveas(path)


def svg_body(placed, kerf, height, labels=True):
    out = []
    Y = lambda v: _r(height - v)
    for part in placed:
        shape, circles, slots, hexes = kerfed(part, kerf)
        d = []
        for ring_ in [shape.exterior, *shape.interiors]:
            pts = list(ring_.coords)[:-1]
            d.append("M" + " L".join(f"{_r(x)},{Y(y)}" for x, y in pts) + " Z")
        for s in slots:
            pts = slot_points(*s)
            r = _r(s[2] / 2)
            seg = [f"M{_r(pts[0][0])},{Y(pts[0][1])}"]
            for i in range(4):
                nx_, ny_, _ = pts[(i + 1) % 4]
                bulge = pts[i][2]
                if bulge:
                    seg.append(f"A{r},{r} 0 0 0 {_r(nx_)},{Y(ny_)}")
                else:
                    seg.append(f"L{_r(nx_)},{Y(ny_)}")
            d.append(" ".join(seg) + " Z")
        for x, y, af in hexes:
            pts = hex_points(x, y, af)
            d.append("M" + " L".join(f"{_r(a)},{Y(b_)}" for a, b_ in pts) + " Z")
        out.append(f'<path d="{" ".join(d)}"/>')
        for x, y, dd in circles:
            out.append(f'<circle cx="{_r(x)}" cy="{Y(y)}" r="{_r(dd / 2)}"/>')
    return out


def svg_labels(placed, height):
    out = []
    for part in placed:
        x0, y0, x1, y1 = part.bounds()
        size = max(3.0, min(7.0, (y1 - y0) / 4, (x1 - x0) / max(len(part.name), 1) * 1.6))
        out.append(f'<text x="{_r((x0 + x1) / 2)}" y="{_r(height - (y0 + y1) / 2 + size / 3)}" '
                   f'font-size="{_r(size)}" text-anchor="middle">{part.name}</text>')
    return out


def write_svg(path, placed, kerf, w, h, labels):
    lines = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{_r(w)}mm" height="{_r(h)}mm" '
             f'viewBox="0 0 {_r(w)} {_r(h)}">',
             '<g id="cut" fill="none" stroke="#ff0000" stroke-width="0.1">']
    lines += svg_body(placed, kerf, h)
    lines.append("</g>")
    if labels:
        lines.append('<g id="labels-do-not-cut" fill="#0000ff" font-family="monospace">')
        lines += svg_labels(placed, h)
        lines.append("</g>")
    lines.append("</svg>")
    with open(path, "w") as fh:
        fh.write("\n".join(lines) + "\n")


# ---------------------------------------------------------------- nesting

def nest(parts):
    """MaxRects, best short side fit, on SHEET_W x SHEET_H with a margin and
    a gap; each part may turn a quarter. Four orders are tried (by area, by
    long side, by width, by height) and the one on the fewest sheets is kept,
    the emptiest last sheet breaking a tie."""
    items = []
    for p in parts:
        for i in range(p.qty):
            items.append(p)

    def size(p):
        x0, y0, x1, y1 = p.bounds()
        return x1 - x0, y1 - y0

    orders = [lambda p: (-size(p)[0] * size(p)[1], p.name),
              lambda p: (-max(size(p)), -min(size(p)), p.name),
              lambda p: (-size(p)[0], -size(p)[1], p.name),
              lambda p: (-size(p)[1], -size(p)[0], p.name)]
    best = None
    for key in orders:
        for rule in ("bssf", "baf", "bl"):
            got = _nest(sorted(items, key=key), rule)
            last = sum(size(p)[0] * size(p)[1] for p in got[-1])
            score = (len(got), last)
            if best is None or score < best[0]:
                best = (score, got)
    return best[1]


def _nest(items, rule="bssf"):
    sheets = []

    def new_sheet():
        W, H = SHEET_W - 2 * SHEET_MARGIN + SHEET_GAP, SHEET_H - 2 * SHEET_MARGIN + SHEET_GAP
        return {"free": [(0.0, 0.0, W, H)], "placed": []}

    def place(sheet, w, h):
        best = None
        for fx, fy, fw, fh in sheet["free"]:
            for rot, (pw, ph) in ((False, (w, h)), (True, (h, w))):
                if pw <= fw + 1e-9 and ph <= fh + 1e-9:
                    if rule == "bssf":
                        score = (min(fw - pw, fh - ph), max(fw - pw, fh - ph), fy, fx)
                    elif rule == "baf":
                        score = (fw * fh - pw * ph, min(fw - pw, fh - ph), fy, fx)
                    else:                                       # bottom-left
                        score = (fy + ph, fx, 0, 0)
                    if best is None or score < best[0]:
                        best = (score, fx, fy, pw, ph, rot)
        return best

    def split(sheet, x, y, w, h):
        out = []
        for fx, fy, fw, fh in sheet["free"]:
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
        keep = []
        for i, a in enumerate(out):
            if not any(i != j and a[0] >= b_[0] - 1e-9 and a[1] >= b_[1] - 1e-9 and
                       a[0] + a[2] <= b_[0] + b_[2] + 1e-9 and a[1] + a[3] <= b_[1] + b_[3] + 1e-9
                       and (a != b_ or i > j) for j, b_ in enumerate(out)):
                keep.append(a)
        sheet["free"] = keep

    for p in items:
        x0, y0, x1, y1 = p.bounds()
        w, h = x1 - x0 + SHEET_GAP, y1 - y0 + SHEET_GAP
        done = False
        for sheet in sheets:
            got = place(sheet, w, h)
            if got:
                _, fx, fy, pw, ph, rot = got
                split(sheet, fx, fy, pw, ph)
                sheet["placed"].append(p.normalised().moved(fx + SHEET_MARGIN, fy + SHEET_MARGIN, rot))
                done = True
                break
        if not done:
            sheet = new_sheet()
            got = place(sheet, w, h)
            if not got:
                raise SystemExit(f"{p.name} does not fit a {SHEET_W:.0f} x {SHEET_H:.0f} sheet")
            _, fx, fy, pw, ph, rot = got
            split(sheet, fx, fy, pw, ph)
            sheet["placed"].append(p.normalised().moved(fx + SHEET_MARGIN, fy + SHEET_MARGIN, rot))
            sheets.append(sheet)
    return [s["placed"] for s in sheets]


# ---------------------------------------------------------------- main

def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--thickness", type=float, default=3.0, help="sheet thickness, mm (3.0)")
    ap.add_argument("--kerf", type=float, default=0.15, help="laser kerf, mm (0.15)")
    ap.add_argument("--out", default=ROOT, help="folder to write dxf/, sheets/ into")
    ap.add_argument("--no-images", action="store_true", help="skip the PNG previews")
    a = ap.parse_args(argv)
    b = Box(a.thickness)
    parts = all_parts(b)
    tests = test_parts(b)
    dxf_dir = os.path.join(a.out, "dxf")
    sheet_dir = os.path.join(a.out, "sheets")
    os.makedirs(dxf_dir, exist_ok=True)
    os.makedirs(sheet_dir, exist_ok=True)
    for p in parts + tests:
        write_dxf(os.path.join(dxf_dir, f"{p.name}.dxf"), [p.normalised()], a.kerf)
    sheets = nest(parts)
    for i, placed in enumerate(sheets, 1):
        write_dxf(os.path.join(sheet_dir, f"sheet-{i}.dxf"), placed, a.kerf)
        write_svg(os.path.join(sheet_dir, f"sheet-{i}.svg"), placed, a.kerf, SHEET_W, SHEET_H, True)
    tp = []
    x = SHEET_MARGIN
    for p in tests:                       # the panel template lies on its side
        n = p.normalised().moved(x, SHEET_MARGIN, rot=p.name == "panel_template")
        tp.append(n)
        x = n.bounds()[2] + 6
    write_dxf(os.path.join(sheet_dir, "test-cuts.dxf"), tp, a.kerf)
    write_svg(os.path.join(sheet_dir, "test-cuts.svg"), tp, a.kerf, SHEET_W, SHEET_H, True)
    count = sum(p.qty for p in parts)
    print(f"{len(parts)} parts ({count} pieces) on {len(sheets)} sheets of "
          f"{SHEET_W:.0f} x {SHEET_H:.0f}, sheet {a.thickness} mm, kerf {a.kerf} mm")
    print(f"box: {b.xRo - b.xLo:.1f} wide, {b.yTo - b.yBo:.1f} tall, "
          f"{b.zLip - b.zCover:.1f} deep")
    if not a.no_images:
        sys.path.insert(0, HERE)
        import previews
        previews.draw_all(b, parts, sheets, os.path.join(a.out, "images"))
    return b, parts, sheets


if __name__ == "__main__":
    # ezdxf orders two objects in each file by string hash; a fixed seed
    # keeps that order, and the bytes, the same from run to run
    if os.environ.get("PYTHONHASHSEED") != "0":
        os.execve(sys.executable, [sys.executable, *sys.argv], {**os.environ, "PYTHONHASHSEED": "0"})
    main()
