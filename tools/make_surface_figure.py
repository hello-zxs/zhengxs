#!/usr/bin/env python3
"""Draw the equivalent geodesic surface of the Luneburg lens (Rinehart's surface).

Writes assets/figures/fig-surface-light.svg and fig-surface-dark.svg.
Standard library only:

    python3 tools/make_surface_figure.py

Model
-----
For the Morse family  n^2(r) = 2 r^(-2+1/B) - r^(-2+2/B)  the metric
equivalence  rho = n r,  ds = n dr  integrates in closed form,

    s(rho) = B (rho + arcsin rho),          0 <= rho <= 1.

With rho = sin(theta) the depth below the apex is

    z(theta) = int_0^theta sqrt( B^2 (1 + cos t)^2 - cos^2 t ) dt.

B = 1/2 is the Luneburg lens. Clairaut's relation gives the geodesics:
measured from the turning point rho = |b|, a geodesic with impact
parameter b has swept the azimuth  B * sweep(rho, |b|)  at radius rho.
"""
from math import acos, asin, cos, sin, sqrt, pi
from pathlib import Path

B = 0.5                                    # Luneburg
W, H_PX = 900, 680
YAW, PITCH = -0.62, 0.50
SCALE, OX, OY = 215.0, 450.0, 372.0
REACH = 1.72                               # how far the plane rays extend
IMPACT = [-0.86, -0.62, -0.38, -0.14, 0.14, 0.38, 0.62, 0.86]
NT = 400


def slope(t):
    c = cos(t)
    return sqrt(max(0.0, B * B * (1 + c) ** 2 - c * c))


def depth_table():
    dt = (pi / 2) / NT
    z = [0.0]
    for i in range(1, NT + 1):
        a = (i - 1) * dt
        z.append(z[-1] + dt / 6 * (slope(a) + 4 * slope(a + dt / 2) + slope(a + dt)))
    return z


ZT = depth_table()
HEIGHT = ZT[-1]                            # 0.6326 lens radii for B = 1/2


def height(rho):
    u = asin(min(1.0, max(0.0, rho))) / (pi / 2) * NT
    i = min(NT - 1, int(u))
    return HEIGHT - (ZT[i] + (ZT[i + 1] - ZT[i]) * (u - i))


def sweep(rho, b):
    u, b2 = rho * rho, b * b
    q = ((1 + b2) * u - 2 * b2) / (u * (1 - b2))
    return acos(min(1.0, b / rho)) + 0.5 * (asin(max(-1.0, min(1.0, q))) + pi / 2)


def to2d(x, y, z):
    x1 = cos(YAW) * x - sin(YAW) * y
    y1 = sin(YAW) * x + cos(YAW) * y
    return OX + x1 * SCALE, OY - (y1 * sin(PITCH) + z * cos(PITCH)) * SCALE


def on_surface(rho, phi):
    t = asin(min(1.0, max(0.0, rho)))
    x, y = to2d(rho * cos(phi), rho * sin(phi), height(rho))
    facing = cos(t) * sin(PITCH) - slope(t) * sin(phi + YAW) * cos(PITCH) >= 0
    return x, y, facing


def runs(points):
    """Split a polyline into front-facing and back-facing runs."""
    out, run, flag = [], [], None
    for p in points:
        if flag is None:
            flag = p[2]
        if p[2] != flag:
            run.append(p)
            out.append((flag, run))
            run, flag = [], p[2]
        run.append(p)
    out.append((flag, run))
    return [(f, r) for f, r in out if len(r) > 1]


def path(points, stroke, width, opacity):
    d = " ".join(("M" if i == 0 else "L") + f"{p[0]:.1f},{p[1]:.1f}" for i, p in enumerate(points))
    return (f'<path d="{d}" fill="none" stroke="{stroke}" stroke-width="{width}" '
            f'opacity="{opacity}" stroke-linecap="round" stroke-linejoin="round"/>')


def build(theme):
    bg, glow0, ink, hot = theme
    back, front, plane = [], [], []

    def wire(points, width, front_a, back_a):
        for facing, run in runs(points):
            (front if facing else back).append(path(run, ink, width, front_a if facing else back_a))

    for r, a in ((1.3, 0.12), (REACH, 0.2)):
        plane.append(path([to2d(r * cos(2 * pi * i / 180), r * sin(2 * pi * i / 180), 0)
                           for i in range(181)], ink, 1.0, a))
    for k in range(18):
        phi = 2 * pi * k / 18
        wire([on_surface(sin(pi / 2 * i / 60), phi) for i in range(61)], 1.3, 0.42, 0.13)
    for k in range(1, 6):
        rho = sin(pi / 2 * k / 6)
        wire([on_surface(rho, 2 * pi * i / 144) for i in range(145)], 1.3, 0.36, 0.11)
    wire([on_surface(1.0, 2 * pi * i / 200) for i in range(201)], 2.0, 0.7, 0.42)

    geo_back, geo_front = [], []
    for b in IMPACT:
        ab, sgn = abs(b), (1 if b > 0 else -1)
        phi_in = pi - asin(b)
        full = sweep(1.0, ab)
        radius = lambda i: sqrt(ab * ab + (1 - ab * ab) * sin(pi / 2 * i / 60) ** 2)
        pts = [on_surface(radius(i), phi_in - sgn * B * (full - sweep(radius(i), ab))) for i in range(60, -1, -1)]
        pts += [on_surface(radius(i), phi_in - sgn * B * (full + sweep(radius(i), ab))) for i in range(1, 61)]
        for facing, run in runs(pts):
            (geo_front if facing else geo_back).append(path(run, hot, 2.1, 0.86 if facing else 0.3))
        phi_out = phi_in - sgn * B * 2 * full
        heading = 2 * (phi_in - sgn * B * full) - pi
        ex, ey = cos(phi_out), sin(phi_out)
        plane.append(path([to2d(-REACH, b, 0), to2d(-sqrt(1 - b * b), b, 0)], hot, 1.6, 0.5))
        plane.append(path([to2d(ex, ey, 0), to2d(ex + 0.6 * cos(heading), ey + 0.6 * sin(heading), 0)], hot, 1.6, 0.34))

    fx, fy = to2d(1.0, 0.0, 0.0)           # the focus: every geodesic leaves through this rim point
    mono = "ui-monospace, 'IBM Plex Mono', monospace"

    def text(x, y, anchor, fill, opacity, spacing, body):
        return (f'<text x="{x}" y="{y}" font-family="{mono}" font-size="10" fill="{fill}" opacity="{opacity}" '
                f'text-anchor="{anchor}" letter-spacing="{spacing}" font-weight="400">{body}</text>')

    parts = [
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H_PX}" width="{W}" height="{H_PX}" role="img">',
        '<title>Rinehart\'s surface, the equivalent geodesic surface of the Luneburg lens</title>',
        f'<rect width="{W}" height="{H_PX}" fill="{bg}"/>',
        f'<defs><radialGradient id="sg" cx="50%" cy="45%" r="55%"><stop offset="0" stop-color="{glow0[0]}" '
        f'stop-opacity="{glow0[1]}"/><stop offset="1" stop-color="{bg}" stop-opacity="0"/></radialGradient></defs>',
        f'<rect width="{W}" height="{H_PX}" fill="url(#sg)"/>',
        *plane, *back, *geo_back, *front, *geo_front,
        f'<circle cx="{fx:.1f}" cy="{fy:.1f}" r="3.2" fill="{hot}" opacity="0.95"/>',
        f'<circle cx="{fx:.1f}" cy="{fy:.1f}" r="9" fill="none" stroke="{hot}" stroke-width="0.7" opacity="0.35"/>',
        text(28, 40, "start", ink, 0.55, 1.6, "GEODESIC  /  02"),
        text(872, 40, "end", ink, 0.55, 1.0, "s(ρ) = ½ (ρ + arcsin ρ)"),
        text(28, 652, "start", ink, 0.5, 1.3, "LUNEBURG LENS  ≡  RINEHART SURFACE"),
        text(872, 652, "end", hot, 0.9, 1.3, "GEODESICS = RAYS"),
        '</svg>',
    ]
    return "".join(parts) + "\n"


THEMES = {
    "light": ("#F3F0E7", ("#ffffff", 0.65), "#1A1D1B", "#C9471C"),
    "dark": ("#08090B", ("#123047", 0.8), "#BFDDF2", "#FF6A3D"),
}

if __name__ == "__main__":
    out = Path(__file__).resolve().parent.parent / "assets" / "figures"
    for name, theme in THEMES.items():
        target = out / f"fig-surface-{name}.svg"
        target.write_text(build(theme), encoding="utf-8")
        print(f"wrote {target.relative_to(out.parent.parent)}  ({target.stat().st_size} bytes)  height = {HEIGHT:.4f}")
