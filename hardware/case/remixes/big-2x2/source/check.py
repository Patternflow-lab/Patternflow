#!/usr/bin/env python3
"""Open every cut file this folder ships and measure it against the panel.

    python check.py            # exits 1 on the first group that fails

Three things are checked. Every DXF in ../dxf and ../sheets opens, passes
ezdxf's audit, is in millimetres and has nothing outside the CUT layer.
Every part fits a 600 x 300 mm bed, and every sheet stays inside one. And
the parts that touch a panel carry the panel's own numbers: those are typed
again below from the maker's drawing, not imported from big2x2.py, and
compared with what a kerf-free run of the generator draws.

CC-BY-SA-4.0, like the rest of this folder.
"""

import glob
import math
import os
import sys
import tempfile
from itertools import combinations

import ezdxf
from ezdxf.math import bulge_to_arc

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

# The panel, from the maker's drawing (page 6 of the simonepda-lasercut PDF),
# as it stands in this box. Its pitch grid is 160 x 320 (64 and 128 LEDs at
# 2.5 mm); its frame is drawn at 159.8 x 319.8.
PANEL = (160.0, 320.0)
PANEL_FRAME = (159.8, 319.8)
INSERTS_END = (85.0,)                    # the two end inserts, 2 x 42.5 apart
INSERT_END_FROM_EDGE = 160 - 148.5       # 11.5 from the short edge
INSERTS_EDGE_STEPS = (91.0, 63.0, 91.0)  # -122.5, -31.5, 31.5, 122.5
INSERT_EDGE_FROM_EDGE = 80 - 68.5        # 11.5 from the long edge
PIN_FROM_MIDDLE = 70.0
SHEET = (600.0, 300.0)

fails = []


def check(cond, what):
    print(("  ok    " if cond else "  FAIL  ") + what)
    if not cond:
        fails.append(what)


def near(a, b, tol=0.02):
    return abs(a - b) <= tol


def read(path):
    """Circles, slots (centre, length, width) and closed outlines, with arcs
    walked, from one DXF."""
    doc = ezdxf.readfile(path)
    msp = doc.modelspace()
    circles, slots, polys = [], [], []
    for e in msp:
        if e.dxftype() == "CIRCLE":
            circles.append((e.dxf.center.x, e.dxf.center.y, 2 * e.dxf.radius))
        elif e.dxftype() == "LWPOLYLINE":
            pts = list(e.get_points("xyb"))
            if len(pts) == 4 and any(b for _, _, b in pts):
                (x1, y1, _), (x2, y2, _), (x3, y3, _), (x4, y4, _) = pts
                cx, cy = (x1 + x2 + x3 + x4) / 4, (y1 + y2 + y3 + y4) / 4
                w = math.hypot(x2 - x3, y2 - y3)
                ln = math.hypot(x1 - x2, y1 - y2) + w
                slots.append((cx, cy, ln, w))
            else:
                walked = []
                n = len(pts)
                for i in range(n):
                    x0, y0, b = pts[i]
                    walked.append((x0, y0))
                    if b:
                        c, a0, a1, r = bulge_to_arc((x0, y0), pts[(i + 1) % n][:2], b)
                        a1 += 2 * math.pi if a1 < a0 else 0
                        walked += [(c.x + r * math.cos(a0 + (a1 - a0) * k / 8),
                                    c.y + r * math.sin(a0 + (a1 - a0) * k / 8)) for k in range(1, 8)]
                polys.append(walked)
    return doc, circles, slots, polys


def extent(polys, circles=()):
    xs = [x for p in polys for x, _ in p] + [c[0] + s * c[2] / 2 for c in circles for s in (-1, 1)]
    ys = [y for p in polys for _, y in p] + [c[1] + s * c[2] / 2 for c in circles for s in (-1, 1)]
    return min(xs), min(ys), max(xs), max(ys)


def steps(values):
    v = sorted(set(round(x, 2) for x in values))
    return [round(float(b - a), 2) for a, b in zip(v, v[1:])]


def files_open():
    print("Every DXF opens, in millimetres, on the CUT layer")
    paths = sorted(glob.glob(os.path.join(ROOT, "dxf", "*.dxf")) +
                   glob.glob(os.path.join(ROOT, "sheets", "*.dxf")))
    check(len(paths) > 40, f"{len(paths)} DXF files found")
    for p in paths:
        doc = ezdxf.readfile(p)
        auditor = doc.audit()
        layers = {e.dxf.layer for e in doc.modelspace()}
        name = os.path.relpath(p, ROOT)
        ok = (not auditor.has_errors and doc.header.get("$INSUNITS") == 4 and layers == {"CUT"}
              and len(doc.modelspace()) > 0)
        if not ok:
            check(False, f"{name}: audit errors {len(auditor.errors)}, units "
                  f"{doc.header.get('$INSUNITS')}, layers {sorted(layers)}")
    check(not fails, "all of them audit clean")


def beds():
    print("Every part fits the bed, every sheet stays on it")
    worst = 0.0
    for p in sorted(glob.glob(os.path.join(ROOT, "dxf", "*.dxf"))):
        _, c, s, polys = read(p)
        x0, y0, x1, y1 = extent(polys, c)
        w, h = sorted((x1 - x0, y1 - y0))
        worst = max(worst, h)
        if not (w <= SHEET[1] and h <= SHEET[0]):
            check(False, f"{os.path.basename(p)} is {x1 - x0:.1f} x {y1 - y0:.1f}")
    check(worst <= SHEET[0], f"longest part {worst:.1f} mm, bed {SHEET[0]:.0f}")
    for p in sorted(glob.glob(os.path.join(ROOT, "sheets", "*.dxf"))):
        _, c, s, polys = read(p)
        x0, y0, x1, y1 = extent(polys, c)
        check(x0 >= 0 and y0 >= 0 and x1 <= SHEET[0] and y1 <= SHEET[1],
              f"{os.path.basename(p)} spans {x0:.1f}..{x1:.1f} x {y0:.1f}..{y1:.1f}")


def against_the_panel(nominal):
    D = lambda n: os.path.join(nominal, "dxf", n + ".dxf")
    import big2x2 as B
    b = B.Box(3.0)
    T = b.T
    print("The rails carry the panel's inserts")
    for name in ("rail_top_back", "rail_bot_front"):
        _, c, s, polys = read(D(name))
        xs = [x for x, _, _, _ in s]
        check(len(s) == 4, f"{name}: four M4 slots, one per end insert of two panels")
        check(steps(xs) == [85.0, 75.0, 85.0],
              f"{name}: slots {steps(xs)} apart; a panel's end inserts are 85 apart, "
              f"and 75 across the seam (2 x (80 - 42.5))")
        x0, y0, x1, y1 = extent(polys)
        # seen from the back the rail's left-wall end is on the right
        far = x1 - max(xs)
        check(near(far, T + b.CL + (80 - 42.5)),
              f"{name}: {far:.2f} from the left wall's outside to the first slot = "
              f"wall {T} + clearance {b.CL} + panel edge to insert 37.5")
        check(all(near(y - y0, 10.0) for _, y, _, _ in s), f"{name}: slots centred on the 20 mm rail")
        check(all(near(ln, 6.0) and near(w, 4.5) for _, _, ln, w in s),
              f"{name}: 4.5 wide, 6.0 long, so an M4 can move 1 mm either way toward the seam")
    _, c, s, polys = read(D("rail_mid_front"))
    ys = [y for _, y, _, _ in s]
    check(len(s) == 8 and steps(ys) == [2 * INSERT_END_FROM_EDGE],
          f"rail_mid_front: two rows of slots {steps(ys)} apart, the two panels' end "
          f"inserts across the horizontal seam (2 x 11.5)")
    check(steps([x for x, _, _, _ in s]) == [85.0, 75.0, 85.0], "rail_mid_front: same columns as the end rails")
    print("The seam rails carry the long-edge inserts and the pins")
    for name in ("seam_upper_front", "seam_lower_back"):
        _, c, s, polys = read(D(name))
        cols = steps([x for x, _, _, _ in s])
        rows = steps([y for _, y, _, _ in s])
        check(len(s) == 8, f"{name}: eight M4 slots, four per panel")
        check(cols == [2 * INSERT_EDGE_FROM_EDGE],
              f"{name}: columns {cols} apart, the two panels' inner-edge inserts (2 x 11.5)")
        check(rows == list(INSERTS_EDGE_STEPS), f"{name}: rows {rows} apart, as the drawing's 91, 63, 91")
        pins = [(x, y) for x, y, d in c if near(d, 5.0)]
        py = steps([y for _, y in pins])
        check(len(pins) == 4 and py == [2 * PIN_FROM_MIDDLE],
              f"{name}: 5.0 holes for the 3.48 pins, {py} apart (either way up)")
    print("The opening is the four panels and 0.3 mm a side")
    _, c, s, polys = read(D("wall_top"))
    x0, y0, x1, y1 = extent(polys)
    # the divider's mortises are the two T x 15 holes; the wall's left end is
    # the left wall's outside, so the opening is from there less one wall
    div = [min(q[0] for q in p) for p in polys
           if len(p) == 4 and near(max(q[0] for q in p) - min(q[0] for q in p), T)
           and near(max(q[1] for q in p) - min(q[1] for q in p), 15.0)]
    across = min(div) - x0 - T if div else 0.0
    check(len(div) == 2 and near(across, 2 * PANEL[0] + 0.6),
          f"wall_top: {across:.1f} from the left wall to the divider, two panels are {2 * PANEL[0]:.0f} "
          f"on the pitch grid and {2 * PANEL_FRAME[0]:.1f} on the frame")
    _, c, s, polys = read(D("wall_left_upper"))
    x0, y0, x1, y1 = extent(polys)
    inner = (x1 - x0) - T                 # less the finger depth at the top end
    check(near(2 * inner, 2 * PANEL[1] + 0.6),
          f"left wall halves give {2 * inner:.1f} inside, two panels are {2 * PANEL[1]:.0f} "
          f"on the grid and {2 * PANEL_FRAME[1]:.1f} on the frame")
    print("The column, the boards and the inlet")
    _, c, s, polys = read(D("column_front_upper"))
    knobs = [(x, y) for x, y, d in c if near(d, 7.2)]
    check(len(knobs) == 4 and steps([x for x, _ in knobs]) == [40.0] and steps([y for _, y in knobs]) == [40.0],
          "four 7.2 mm encoder holes on a 40 mm grid")
    _, c, s, polys = read(D("electronics_plate"))
    pi = [(x, y) for x, y, d in c if near(d, 2.9)]
    check(sorted(steps([x for x, _ in pi]) + steps([y for _, y in pi])) == [49.0, 58.0],
          "Raspberry Pi 5 holes on 58 x 49")
    # the card's holes are the M3 holes that are not the plate's own mounts,
    # which sit on the centre line or 54 either side of it. The plate is drawn
    # from the back, the card's component side, which is how patternflood's
    # template is drawn too, so the two must match without a mirror.
    tmpl = [(9.11, 143.08), (90.51, 143.35), (20.07, 7.81), (80.44, 7.96)]
    mid = (extent(polys)[0] + extent(polys)[2]) / 2
    card = [(x, y) for x, y, d in c if near(d, 3.4) and not near(abs(x - mid), 0.0, 0.5)
            and not near(abs(x - mid), 54.0, 0.5)]

    def shape(pts):
        mx, my = min(p[0] for p in pts), min(p[1] for p in pts)
        return sorted((round(x - mx, 2), round(y - my, 2)) for x, y in pts)

    check(len(card) == 4 and shape(card) == shape(tmpl),
          f"5A-75B holes are patternflood's template, not its mirror: {shape(card)}")
    _, c2, _, _ = read(D("card_template"))
    check(shape([(x, y) for x, y, d in c2]) == shape(tmpl), "card_template carries the same four holes")
    _, c, s, polys = read(D("wall_right_lower"))
    rects = []
    for p in polys:
        xs, ys = [q[0] for q in p], [q[1] for q in p]
        if len(p) == 4:
            rects.append((round(max(xs) - min(xs), 2), round(max(ys) - min(ys), 2)))
    check((46.75, 27.25) in rects, "IEC inlet cutout 46.75 x 27.25")
    screws = [(x, y) for x, y, d in c if near(d, 3.2)]
    check(len(screws) == 2 and near(math.dist(*screws), 40.0), "inlet flange screws 40 apart")
    print("The panel template is one panel")
    _, c, s, polys = read(D("panel_template"))
    x0, y0, x1, y1 = extent(polys)
    check(near(x1 - x0, PANEL[0]) and near(y1 - y0, PANEL[1]), f"{x1 - x0:.1f} x {y1 - y0:.1f}")
    m4 = [(x - x0, y - y0) for x, y, d in c if near(d, 4.5)]
    check(len(m4) == 12, f"{len(m4)} insert holes, the drawing's 12-M4")


def kerf_applied(nominal, kerf=0.15):
    print(f"The shipped files are the nominal ones with the {kerf} mm kerf applied")
    for name in ("rail_mid_front", "wall_left_upper", "column_front_upper", "electronics_plate"):
        _, c0, s0, p0 = read(os.path.join(nominal, "dxf", name + ".dxf"))
        _, c1, s1, p1 = read(os.path.join(ROOT, "dxf", name + ".dxf"))
        a, b_ = extent(p0), extent(p1)
        check(near((b_[2] - b_[0]) - (a[2] - a[0]), kerf, 0.01),
              f"{name}: outline {kerf} mm larger")
        check(all(near(x[2] - y[2], kerf, 0.001) for x, y in zip(sorted(c0), sorted(c1))),
              f"{name}: every hole {kerf} mm smaller")
        check(len(s0) == len(s1) and all(near(x[2] - y[2], kerf, 0.001) and near(x[3] - y[3], kerf, 0.001)
                                         for x, y in zip(sorted(s0), sorted(s1))),
              f"{name}: every slot {kerf} mm shorter and narrower")


def main():
    files_open()
    beds()
    with tempfile.TemporaryDirectory() as tmp:
        import big2x2
        big2x2.main(["--kerf", "0", "--out", tmp, "--no-images"])
        against_the_panel(tmp)
        kerf_applied(tmp)
    print()
    if fails:
        print(f"{len(fails)} failed")
        return 1
    print("all passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
