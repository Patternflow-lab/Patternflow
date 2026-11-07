"""The pictures in the README, drawn from the same numbers as the cut files.

big2x2.py calls draw_all(). CC-BY-SA-4.0, like the rest of this folder.
"""

import math
import os

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
from matplotlib.patches import Circle, FancyBboxPatch, Rectangle  # noqa: E402

import big2x2 as B  # noqa: E402

WOOD, WOOD_EDGE = "#dcc29b", "#8a6a45"
WOOD_DARK = "#c4a477"
PANEL, PCB, PSU_C = "#1c1c1e", "#2f7d4f", "#b9bdc3"
RED, BLACK, BLUE, GREY = "#d62828", "#222222", "#1f6fd1", "#a0a0a0"
MAINS_L, MAINS_N = "#8b4513", "#3a6fb0"

plt.rcParams.update({"font.family": "DejaVu Sans", "font.size": 8,
                     "svg.hashsalt": "big2x2", "svg.fonttype": "none"})


def _rect(ax, x0, y0, x1, y1, fc, ec="none", lw=0.6, z=1, alpha=1.0, **kw):
    ax.add_patch(Rectangle((min(x0, x1), min(y0, y1)), abs(x1 - x0), abs(y1 - y0),
                           fc=fc, ec=ec, lw=lw, zorder=z, alpha=alpha, **kw))


def _dim(ax, x0, y0, x1, y1, text, off=(0, 0), rot=0):
    ax.annotate("", (x0, y0), (x1, y1),
                arrowprops=dict(arrowstyle="<->", lw=0.6, color="#444", shrinkA=0, shrinkB=0))
    ax.text((x0 + x1) / 2 + off[0], (y0 + y1) / 2 + off[1], text, ha="center", va="center",
            rotation=rot, fontsize=7.5, color="#333",
            bbox=dict(fc="white", ec="none", pad=0.6))


def _label(ax, xy, text, xytext, color="#222"):
    ax.annotate(text, xy, xytext, fontsize=7.5, color=color, ha="left", va="center",
                arrowprops=dict(arrowstyle="-", lw=0.5, color="#555"),
                bbox=dict(fc="white", ec="#bbb", lw=0.4, pad=1.2, boxstyle="round,pad=0.25"))


def led_image():
    """256 x 128 points of light, a pattern of concentric waves, at 2.5 mm."""
    rows, cols = 256, 128
    y, x = np.mgrid[0:rows, 0:cols]
    cx, cy = cols * 0.62, rows * 0.38
    r = np.hypot(x - cx, y - cy)
    r2 = np.hypot(x - cols * 0.25, y - rows * 0.78)
    v = 0.5 + 0.5 * np.sin(r * 0.21 - r2 * 0.09)
    hue = (0.55 + 0.25 * np.sin(r2 * 0.035) + 0.15 * v) % 1.0
    sat = np.full_like(v, 0.85)
    val = 0.18 + 0.82 * v ** 1.6
    rgb = matplotlib.colors.hsv_to_rgb(np.dstack([hue, sat, val]))
    k = 5                                   # pixels per LED
    big = np.zeros((rows * k, cols * k, 3))
    yy, xx = np.mgrid[0:k, 0:k]
    dot = (np.hypot(xx - (k - 1) / 2, yy - (k - 1) / 2) <= k * 0.36)[..., None]
    for i in range(rows):
        for j in range(cols):
            big[i * k:(i + 1) * k, j * k:(j + 1) * k] = dot * rgb[i, j] + (~dot) * 0.06
    return big


def front(b, path):
    fig, ax = plt.subplots(figsize=(6.2, 8.4))
    # feet, then the shell
    for fx in b.feet_x:
        _rect(ax, fx - 20, b.yBo - 3 * b.T, fx + 20, b.yBo, WOOD_DARK, WOOD_EDGE)
    _rect(ax, b.xLo, b.yBo, b.xRo, b.yTo, WOOD, WOOD_EDGE, lw=0.8)
    ax.imshow(led_image(), extent=(-160, 160, -320, 320), zorder=2, interpolation="bilinear")
    for x0, y0, x1, y1 in ((-160, 0, 160, 0), (0, -320, 0, 320)):
        ax.plot([x0, x1], [y0, y1], color="#000", lw=0.5, zorder=3)
    _rect(ax, b.xDo, b.yBi, b.xRi, b.yTi, WOOD, WOOD_EDGE, lw=0.5, z=2)
    ax.plot([b.xDo, b.xRi], [0, 0], color=WOOD_EDGE, lw=0.4, zorder=3)
    for i, (x, y) in enumerate(b.knobs):
        ax.add_patch(Circle((x, y), 9, fc="#2a2a2a", ec="#000", lw=0.6, zorder=4))
        ax.plot([x, x], [y, y + 7], color="#ddd", lw=1.0, zorder=5)
    names = {0: "K2", 1: "K1", 2: "K4", 3: "K3"}
    for i, (x, y) in enumerate(b.knobs):
        ax.text(x, y - 15, names[i], ha="center", va="center", fontsize=6.5, color="#5a4630", zorder=5)
    # dimensions
    _dim(ax, b.xLo, b.yTo + 22, b.xRo, b.yTo + 22, f"{b.xRo - b.xLo:.1f}")
    _dim(ax, -160, b.yTo + 9, 160, b.yTo + 9, "320 (128 px)")
    _dim(ax, b.xLo - 24, b.yBo, b.xLo - 24, b.yTo, f"{b.yTo - b.yBo:.1f}", rot=90)
    _dim(ax, b.xLo - 8, -320, b.xLo - 8, 320, "640 (256 px)", rot=90, off=(0, 120))
    _dim(ax, b.knobs[0][0], b.knobs[0][1] + 22, b.knobs[1][0], b.knobs[1][1] + 22, "40")
    ax.text(b.cx, -40, "column", rotation=90, ha="center", va="center", color=WOOD_EDGE, fontsize=8)
    ax.set_xlim(b.xLo - 40, b.xRo + 12)
    ax.set_ylim(b.yBo - 20, b.yTo + 34)
    ax.set_aspect("equal")
    ax.axis("off")
    fig.tight_layout()
    fig.savefig(path, dpi=150)
    plt.close(fig)


def _wire(ax, pts, color, lw=1.2, z=8, ls="-"):
    xs, ys = zip(*pts)
    ax.plot(xs, ys, color=color, lw=lw, zorder=z, solid_capstyle="round", ls=ls)


def back(b, path):
    """Seen from behind with the back cover off: x runs the other way."""
    X = lambda x: -x
    fig, ax = plt.subplots(figsize=(9.0, 8.6))
    _rect(ax, X(b.xLo), b.yBo, X(b.xRo), b.yTo, "#efe4d2", WOOD_EDGE, lw=0.8)
    for x0, x1 in ((b.xLo, b.xLi), (b.xDi, b.xDo), (b.xRi, b.xRo)):
        _rect(ax, X(x0), b.yBo, X(x1), b.yTo, WOOD, WOOD_EDGE, lw=0.4, z=2)
    for y0, y1 in ((b.yTi, b.yTo), (b.yBo, b.yBi)):
        _rect(ax, X(b.xLo), y0, X(b.xRo), y1, WOOD, WOOD_EDGE, lw=0.4, z=2)
    # panels and their connectors
    for cx, cy in B.PANEL_CENTRES:
        _rect(ax, X(cx - 80), cy - 160, X(cx + 80), cy + 160, PANEL, "#000", lw=0.5, z=2)
        sign = -1 if cy > 0 else 1                 # IN faces the horizontal seam
        for dy, name in ((sign * 128, "IN"), (-sign * 128, "OUT")):
            _rect(ax, X(cx - 10), cy + dy - 4.5, X(cx + 10), cy + dy + 4.5, "#555", "#999", z=3)
            ax.text(X(cx) + (14 if cx > 0 else -14), cy + dy, name, color="#bbb", fontsize=5.5,
                    ha="center", va="center", zorder=3)
        for dy in (-30, 30):
            _rect(ax, X(cx - 6), cy + dy - 3, X(cx + 6), cy + dy + 3, "#f2f2f2", "#999", z=3)
    # rails and seam rails, with their screws
    rails = [(b.xLo, b.xDo, *b.rail_top), (b.xLo, b.xRo, *b.rail_mid), (b.xLo, b.xDo, *b.rail_bot),
             (b.seam[0], b.seam[1], *b.seam_up), (b.seam[0], b.seam[1], *b.seam_dn)]
    for x0, x1, y0, y1 in rails:
        _rect(ax, X(x0), y0, X(x1), y1, WOOD, WOOD_EDGE, lw=0.5, z=4)
    screws = []
    for cx, _ in B.PANEL_CENTRES[:2]:
        for dx in B.PANEL_END_X:
            for y in (308.5, 11.5, -11.5, -308.5):
                screws.append((cx + dx, y))
    for cx, cy in B.PANEL_CENTRES:
        x = cx + (B.PANEL_EDGE_X if cx < 0 else -B.PANEL_EDGE_X)
        for dy in B.PANEL_EDGE_Y:
            screws.append((x, cy + dy))
    for x, y in screws:
        ax.add_patch(Circle((X(x), y), 3.6, fc="#777", ec="#333", lw=0.4, zorder=5))
    # electronics plate, the card, the Pi, the fuse box
    x0, x1, y0, y1 = b.plate
    ax.add_patch(FancyBboxPatch((X(x1), y0), x1 - x0, y1 - y0, boxstyle="round,pad=0,rounding_size=4",
                                fc=WOOD_DARK, ec=WOOD_EDGE, lw=0.6, zorder=6))
    for x, y in b.plate_mounts:
        ax.add_patch(Circle((X(x), y), 2.8, fc="#666", ec="#222", lw=0.4, zorder=7))
    cx0, cx1, cy0, cy1 = b.card
    _rect(ax, X(cx0), cy0, X(cx1), cy1, PCB, "#103", lw=0.5, z=7)
    for i in range(4):                             # eight HUB75 headers, four a side
        for side in (-1, 1):
            yy = cy0 + 18 + i * 30
            _rect(ax, X(side * 46), yy, X(side * 36), yy + 20, "#111", "#000", z=8)
    _rect(ax, X(-8), cy1 - 16, X(8), cy1, "#c8c8c8", "#666", z=8)          # RJ45
    px0, px1, py0, py1 = b.pi
    _rect(ax, X(px0), py0, X(px1), py1, PCB, "#103", lw=0.5, z=7)
    _rect(ax, X(-12), py0 + 14, X(18), py0 + 44, "#3b3b3b", "#000", z=8)    # cooler
    _rect(ax, X(px1 - 21), py0 + 2, X(px1), py0 + 54, "#c8c8c8", "#666", z=8)  # USB, RJ45
    _rect(ax, X(-35), -262, X(35), -152, "#222", "#000", z=7)               # fuse box
    for i in range(6):
        yy = -252 + i * 16
        _rect(ax, X(-6), yy, X(6), yy + 8, ["#e9c600", "#e9c600", "#e9c600", "#e9c600",
                                            "#c73a3a", "#a96fd0"][i], "#000", lw=0.3, z=8)
    # column: knobs, the supply, the inlet
    for x, y in b.knobs:
        _rect(ax, X(x - 12.7), y - 12.7, X(x + 12.7), y + 12.7, "#1b1b1b", "#000", z=7)
        ax.add_patch(Circle((X(x), y), 6.2, fc="#c9c9c9", ec="#555", lw=0.4, zorder=8))
    p = b.psu
    _rect(ax, X(p[0]), p[2], X(p[1]), p[3], PSU_C, "#555", lw=0.6, z=7)
    _rect(ax, X(p[0] + 4), p[3] - 14, X(p[1] - 4), p[3] - 2, "#2b2b2b", "#000", z=8)
    for i in range(7):
        ax.add_patch(Circle((X(p[0] + 10 + i * 12.5), p[3] - 8), 2.6, fc="#bbb", ec="#333",
                            lw=0.3, zorder=9))
    iy, _ = b.iec
    _rect(ax, X(b.xRi - 38), iy - 24, X(b.xRi), iy + 24, "#2b2b2b", "#000", z=7)
    # stringers, glued at the back, drawn see-through
    for y0, y1 in b.stringers.values():
        _rect(ax, X(b.xLo), y0, X(b.xRo), y1, WOOD, WOOD_EDGE, lw=0.4, z=12, alpha=0.38)
    # wiring
    for i, (cx, cy) in enumerate(B.PANEL_CENTRES):
        sign = -1 if cy > 0 else 1
        side = -1 if cx < 0 else 1
        hx = side * 41
        hy = cy0 + 18 + (3 if cy > 0 else 0) * 30 + 10
        _wire(ax, [(X(hx), hy), (X(side * 58), hy), (X(cx), cy + sign * 128)], GREY, lw=3.2, z=9)
    fx, fy = 0, -160
    term = (X(p[0] + 60), p[3] - 8)
    _wire(ax, [term, (X(p[0] + 60), b.pass_5v[0]), (X(30), b.pass_5v[0]), (X(30), -160)], RED, 1.6, z=10)
    _wire(ax, [(X(p[0] + 72), p[3] - 8), (X(p[0] + 72), b.pass_5v[0] - 6), (X(22), b.pass_5v[0] - 6),
               (X(22), -160)], BLACK, 1.6, z=10)
    for cx, cy in B.PANEL_CENTRES:
        _wire(ax, [(X(-25 if cx < 0 else 25), -240 if cy < 0 else -215),
                   (X(cx * 0.55), -240 if cy < 0 else -215), (X(cx * 0.55), cy - 30 if cy > 0 else cy + 30),
                   (X(cx), cy - 30 if cy > 0 else cy + 30)], RED, 0.9, z=10)
    _wire(ax, [(X(-20), -170), (X(-20), cy0 - 6), (X(-30), cy0 - 6)], RED, 0.9, z=10)
    _wire(ax, [(X(20), -170), (X(20), -150), (X(52), -150), (X(52), py0 + 26), (X(px0), py0 + 26)],
          RED, 0.9, z=10)
    _wire(ax, [(X(8), cy1), (X(8), py0), ], "#5aa0e0", 1.4, z=10)
    _wire(ax, [(X(-30), py1 - 4), (X(-30), b.pass_i2c[0]), (X(b.knobs[2][0]), b.pass_i2c[0]),
               (X(b.knobs[2][0]), b.knobs[2][1])], BLUE, 1.0, z=10)
    _wire(ax, [(X(b.knobs[2][0]), b.knobs[2][1]), (X(b.knobs[3][0]), b.knobs[3][1]),
               (X(b.knobs[1][0]), b.knobs[1][1]), (X(b.knobs[0][0]), b.knobs[0][1])], BLUE, 1.0, z=10)
    _wire(ax, [(X(b.xRi - 20), iy - 10), (X(b.xRi - 20), p[3] - 8), (X(p[0] + 10), p[3] - 8)],
          MAINS_L, 1.3, z=10)
    _wire(ax, [(X(b.xRi - 28), iy - 10), (X(b.xRi - 28), p[3] - 2), (X(p[0] + 22), p[3] - 2),
               (X(p[0] + 22), p[3] - 8)], MAINS_N, 1.3, z=10)
    # labels: the column's things on its side (the left, seen from behind),
    # everything else on the right
    rx, lx = X(b.xLo) + 22, X(b.xRo) - 22
    for xy, text, ty in (
            ((X(0), 150), "Raspberry Pi 5, Active Cooler", 250),
            ((X(-120), b.stringers["upper"][0] + 4), "stringers, for the back cover", 175),
            ((X(-20), 20), "Colorlight 5A-75B, receiver75", 105),
            ((X(-80), 32), "HUB75 IN, toward the seam", 45),
            ((X(-120), b.rail_mid[0] + 4), "rails, screwed to the panels", -15),
            ((X(-80), -130), "panel power input", -85),
            ((X(-20), -210), "6-way blade fuse box", -175),
    ):
        _label(ax, xy, text, (rx, ty))
    for xy, text, ty in (
            ((X(b.knobs[0][0]) - 12, b.knobs[0][1]), "4 × Adafruit 4991\n+ PEC11R encoder", 290),
            ((X(b.xRi - 20), iy), "IEC inlet with switch\nand T3.15A fuse", -60),
            ((X(b.cx), -260), "Mean Well\nLRS-150F-5", -250),
    ):
        ax.annotate(text, xy, (lx, ty), fontsize=7.5, ha="right", va="center",
                    arrowprops=dict(arrowstyle="-", lw=0.5, color="#555"),
                    bbox=dict(fc="white", ec="#bbb", lw=0.4, boxstyle="round,pad=0.25"))
    ax.set_xlim(X(b.xRo) - 120, X(b.xLo) + 170)
    ax.set_ylim(b.yBo - 10, b.yTo + 10)
    ax.set_aspect("equal")
    ax.axis("off")
    ax.set_title("From the back, cover off", fontsize=9)
    fig.tight_layout()
    fig.savefig(path, dpi=150)
    plt.close(fig)


def section(b, path):
    """Two cuts seen from the right: through the display's middle (x = 0) and
    through the column (x = column centre)."""
    fig, axes = plt.subplots(1, 2, figsize=(7.6, 8.6), sharey=True)
    for ax, where in zip(axes, ("display", "column")):
        Z = lambda z: z
        # shell
        for y0, y1 in ((b.yTi, b.yTo), (b.yBo, b.yBi)):
            _rect(ax, b.zBack, y0, b.zLip, y1, WOOD, WOOD_EDGE, lw=0.5, z=2)
        _rect(ax, b.zCover, b.yBo, b.zBack, b.yTo, WOOD, WOOD_EDGE, lw=0.5, z=2)
        for y0, y1 in b.stringers.values():
            _rect(ax, b.zStrB, y0, b.zStrF, y1, WOOD_DARK, WOOD_EDGE, lw=0.5, z=3)
        _rect(ax, b.foot_z[0], b.yBo - 3 * b.T, b.foot_z[1], b.yBo, WOOD_DARK, WOOD_EDGE, lw=0.5, z=2)
        if where == "display":
            _rect(ax, -B.PANEL_D, -320, 0, 320, PANEL, "#000", lw=0.5, z=2)
            for y0, y1 in (b.rail_top, b.rail_mid, b.rail_bot, b.seam_up, b.seam_dn):
                _rect(ax, b.zRailB, y0, b.zRailF, y1, WOOD, WOOD_EDGE, lw=0.5, z=3)
            for _, y in b.plate_mounts:
                if abs(_) < 1:
                    _rect(ax, b.zPlateF, y - 5, b.zRailB, y + 5, WOOD_DARK, WOOD_EDGE, lw=0.4, z=3)
            _rect(ax, b.zPlateB, b.plate[2], b.zPlateF, b.plate[3], WOOD_DARK, WOOD_EDGE, lw=0.5, z=3)
            for (y0, y1), h, c, name in (((b.card[2], b.card[3]), 19.5, PCB, "5A-75B"),
                                         ((b.pi[2], b.pi[3]), 17.5, PCB, "Pi 5"),
                                         ((-262, -152), 35, "#222", "fuse box")):
                top = b.zPlateB - (6 if name != "fuse box" else 0)
                if name != "fuse box":
                    _rect(ax, top - 1.6, y0, top, y1, c, "#000", lw=0.4, z=4)
                    _rect(ax, top - h, y0 + 10, top - 1.6, y1 - 10, "#555", "#000", lw=0.3, z=4,
                          alpha=0.6)
                else:
                    _rect(ax, top - h, y0, top, y1, c, "#000", lw=0.4, z=4)
                ax.text(top - h - 3, (y0 + y1) / 2, name, rotation=90, ha="right", va="center",
                        fontsize=7)
            for cy in (32, -32):
                _rect(ax, -B.PANEL_D - 19, cy - 6, -B.PANEL_D, cy + 6, "#666", "#000", lw=0.3, z=3)
            for z, y, text in ((-17, 300, "rail"), (-17, 250, "seam rail"), (-26, 186, "rings"),
                               (-33.5, -180 + 0, "plate"), (-70.5, 107, "stringer"),
                               (-76.5, 240, "back cover"), (-7, 250, "panel")):
                ax.text(z, y, text, rotation=90, ha="center", va="center", fontsize=6,
                        color="white" if text == "panel" else "#3d2b14", zorder=20)
            ax.text(-100, b.yBo - 13, "foot", fontsize=6.5, color="#3d2b14")
            ax.set_title("x = 0, through the display", fontsize=8)
        else:
            _rect(ax, b.zColB, b.yBi, b.zColF, b.yTi, WOOD, WOOD_EDGE, lw=0.5, z=3)
            _rect(ax, b.zColB - b.T, min(y for _, y in b.knobs) - 25, b.zColB,
                  max(y for _, y in b.knobs) + 25, WOOD_DARK, WOOD_EDGE, lw=0.4, z=3)
            _rect(ax, b.zColB - b.T, -15, b.zColB, 15, WOOD_DARK, WOOD_EDGE, lw=0.4, z=3)
            for _, y in b.knobs[::2]:
                _rect(ax, b.zColB - 6.5, y - 6.5, b.zColB, y + 6.5, "#777", "#000", lw=0.3, z=4)
                _rect(ax, b.zColB - 8.1, y - 12.7, b.zColB - 6.5, y + 12.7, "#111", "#000", lw=0.3, z=4)
                _rect(ax, b.zColF, y - 3, b.zColF + 17, y + 3, "#999", "#555", lw=0.3, z=4)
                _rect(ax, b.zColF + 3, y - 8, b.zColF + 17, y + 8, "#2a2a2a", "#000", lw=0.3, z=5)
            _rect(ax, b.zRailB, b.rail_mid[0], b.zRailF, b.rail_mid[1], WOOD, WOOD_EDGE, lw=0.5, z=3)
            p = b.psu
            _rect(ax, p[4], p[2], p[5], p[3], PSU_C, "#555", lw=0.6, z=3)
            _rect(ax, p[4] - 9, p[3] - 14, p[4], p[3] - 2, "#2b2b2b", "#000", lw=0.3, z=3)
            ax.text(p[4] - 12, (p[2] + p[3]) / 2, "LRS-150F-5", rotation=90, ha="right", va="center",
                    fontsize=7)
            iy, iz = b.iec
            _rect(ax, iz - 13.6, iy - 23.4, iz + 13.6, iy + 23.4, "#2b2b2b", "#000", lw=0.4, z=2,
                  alpha=0.45)
            ax.text(iz - 18, iy, "inlet (right wall)", rotation=90, ha="right", va="center", fontsize=7)
            ax.set_title(f"x = {b.cx:.1f}, through the column", fontsize=8)
        ax.axvline(0, color="#e0a000", lw=0.6, ls="--", zorder=1)
        ax.text(1, b.yTo + 6, "LED face", fontsize=6.5, color="#a07000")
        ax.set_xlim(b.foot_z[0] - 4, b.foot_z[1] + 4)
        ax.set_ylim(b.yBo - 20, b.yTo + 14)
        ax.set_aspect("equal")
        ax.set_xlabel("z, mm (front to the right)")
        ax.grid(alpha=0.25, lw=0.4)
        ax.tick_params(labelsize=6.5)
    fig.tight_layout()
    fig.savefig(path, dpi=150)
    plt.close(fig)


def _outline(ax, part, color="#c0392b"):
    shape, circles, slots, hexes = B.kerfed(part, 0.0)
    for ring in [shape.exterior, *shape.interiors]:
        xs, ys = ring.xy
        ax.plot(xs, ys, color=color, lw=0.35)
    for x, y, d in circles:
        ax.add_patch(Circle((x, y), d / 2, fill=False, ec=color, lw=0.3))
    for s in slots:
        pts = B.slot_points(*s)
        xs, ys = [q[0] for q in pts] + [pts[0][0]], [q[1] for q in pts] + [pts[0][1]]
        ax.plot(xs, ys, color=color, lw=0.3)
    for x, y, af in hexes:
        pts = B.hex_points(x, y, af) + [B.hex_points(x, y, af)[0]]
        ax.plot([q[0] for q in pts], [q[1] for q in pts], color=color, lw=0.3)


def sheets(sheet_list, path):
    n = len(sheet_list)
    cols = 2
    rows = math.ceil(n / cols)
    fig, axes = plt.subplots(rows, cols, figsize=(11, 2.9 * rows))
    axes = np.atleast_1d(axes).ravel()
    for i, ax in enumerate(axes):
        if i >= n:
            ax.axis("off")
            continue
        _rect(ax, 0, 0, B.SHEET_W, B.SHEET_H, "#f6efe3", "#999", lw=0.6)
        for part in sheet_list[i]:
            _outline(ax, part)
            x0, y0, x1, y1 = part.bounds()
            fs = 5.5 if min(x1 - x0, y1 - y0) > 12 else 4
            if min(x1 - x0, y1 - y0) > 12:
                ax.text((x0 + x1) / 2, (y0 + y1) / 2, part.name.replace("_", " "), fontsize=fs,
                        ha="center", va="center", color="#1a4f9c",
                        rotation=90 if (y1 - y0) > 2 * (x1 - x0) else 0)
        ax.set_xlim(-5, B.SHEET_W + 5)
        ax.set_ylim(-5, B.SHEET_H + 5)
        ax.set_aspect("equal")
        ax.axis("off")
        ax.set_title(f"sheet-{i + 1}", fontsize=8)
    fig.tight_layout()
    fig.savefig(path, dpi=130)
    plt.close(fig)


def wiring(path_png, path_svg):
    fig, ax = plt.subplots(figsize=(9.4, 5.2))
    ax.set_xlim(0, 100)
    ax.set_ylim(0, 56)
    ax.axis("off")

    def node(x, y, w, h, text, fc="#f4f4f4", ec="#555"):
        ax.add_patch(FancyBboxPatch((x, y), w, h, boxstyle="round,pad=0.3,rounding_size=0.8",
                                    fc=fc, ec=ec, lw=0.8, zorder=2))
        ax.text(x + w / 2, y + h / 2, text, ha="center", va="center", fontsize=7.2, zorder=3)
        return (x, y, w, h)

    def arrow(p, q, color, text=None, off=(0, 1.2), lw=1.4, ls="-"):
        ax.annotate("", q, p, arrowprops=dict(arrowstyle="-|>", color=color, lw=lw, ls=ls,
                                              shrinkA=0, shrinkB=0), zorder=1)
        if text:
            ax.text((p[0] + q[0]) / 2 + off[0], (p[1] + q[1]) / 2 + off[1], text, fontsize=6.4,
                    ha="center", va="center", color=color,
                    bbox=dict(fc="white", ec="none", pad=0.4), zorder=4)

    node(1, 44, 13, 7, "mains\n220–240 V AC")
    node(20, 44, 17, 7, "IEC C14 inlet\nswitch, T3.15A fuse", fc="#efe7da")
    node(43, 44, 18, 7, "Mean Well\nLRS-150F-5\n5 V, 22 A", fc="#e6e8eb")
    node(43, 27, 18, 9, "6-way blade fuse box\nnegative bus", fc="#ece7e7")
    arrow((14, 47.5), (20, 47.5), MAINS_L, "L, N, earth", (0, 4.6))
    arrow((37, 47.5), (43, 47.5), MAINS_L, "0.75 mm², 300 V", (0, 4.6))
    arrow((52, 44), (52, 36), RED, "2 pairs, 1.5 mm²\n(16 AWG)", (7.2, 0))
    panels = [("upper left", 70, 49), ("upper right", 70, 41), ("lower left", 70, 33),
              ("lower right", 70, 25)]
    for name, x, y in panels:
        node(x + 14, y, 15, 5.5, f"panel, {name}\n128 × 64", fc="#2b2b2b", ec="#000")
        ax.texts[-1].set_color("white")
    for i, (name, x, y) in enumerate(panels):
        arrow((61, 31.5 + (1.5 - i) * 1.6), (x + 14, y + 2.75), RED, None, lw=0.9)
    ax.text(73, 51.6, "7.5 A fuse, 0.75 mm² (18 AWG) each", fontsize=6.4, color=RED, ha="center")
    node(43, 9, 18, 8, "Colorlight 5A-75B\nreceiver75 gateware", fc="#dfeee5")
    node(14, 9, 18, 8, "Raspberry Pi 5\nActive Cooler", fc="#dfeee5")
    node(14, 23, 18, 8, "4 × Adafruit 4991\n+ PEC11R encoders", fc="#e3ebf6")
    arrow((47, 27), (47, 17), RED, "3 A fuse", (-4.4, 0), lw=0.9)
    arrow((44.5, 29), (32, 15), RED, "5 A fuse\nUSB-C pigtail", (-1, 3.6), lw=0.9)
    arrow((32, 11.5), (43, 11.5), "#3a8fd8", "gigabit Ethernet", (0, -1.8))
    arrow((23, 17), (23, 23), BLUE, "I²C\n3.3 V", (-4.2, 0))
    for i, (name, x, y) in enumerate(panels):
        arrow((61, 13 + i * 0.9), (x + 14, y + 1.0), GREY, None, lw=1.6)
    ax.text(73, 13.2, "HUB75 ribbons: J5, J8, J4, J1", fontsize=6.4, color="#666", ha="center")
    ax.text(1, 3, "Mains stays in the column. Two leads cross the divider into the space behind "
            "the panels: the 5 V pairs and the knobs' I²C lead.", fontsize=6.6, color="#444")
    fig.tight_layout()
    fig.savefig(path_png, dpi=150)
    fig.savefig(path_svg, metadata={"Date": None})
    plt.close(fig)


def draw_all(b, parts, sheet_list, outdir):
    os.makedirs(outdir, exist_ok=True)
    front(b, os.path.join(outdir, "front.png"))
    back(b, os.path.join(outdir, "back.png"))
    section(b, os.path.join(outdir, "section.png"))
    sheets(sheet_list, os.path.join(outdir, "sheets.png"))
    wiring(os.path.join(outdir, "wiring.png"), os.path.join(outdir, "wiring.svg"))
