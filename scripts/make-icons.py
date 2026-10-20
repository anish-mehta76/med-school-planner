"""Draws the app icon (white check on a Spirit Blue shield over Heritage Blue) as PNGs.

Matches public/icon.svg. Standard library only. Run from the repo root:  python3 scripts/make-icons.py
Writes public/apple-touch-icon.png (180), public/icon-192.png and public/icon-512.png.
Icons are opaque and full-bleed, because iOS rounds the corners itself.
"""
import math
import struct
import zlib
from pathlib import Path

BG_TOP = (0x0A, 0x4A, 0x9A)  # gradient, top-left
BG_BOTTOM = (0x00, 0x2D, 0x72)  # Heritage Blue, bottom-right
SHIELD = (0x72, 0xAC, 0xE5)  # Spirit Blue
WHITE = (0xFF, 0xFF, 0xFF)
SS = 4  # supersamples per axis for anti-aliasing

# Geometry in a 0..1 unit square (the SVG's 0..100 viewBox divided by 100).
STROKE = 0.075
CHECK = [(0.37, 0.505), (0.455, 0.59), (0.63, 0.415)]


def bezier(p0, p1, p2, p3, n=32):
    pts = []
    for k in range(1, n + 1):
        t = k / n
        u = 1 - t
        pts.append(tuple(u**3 * a + 3 * u * u * t * b + 3 * u * t * t * c + t**3 * d for a, b, c, d in zip(p0, p1, p2, p3)))
    return pts


# M50 16 L78 26 V48 C78 66 66.5 78 50 85 C33.5 78 22 66 22 48 V26 Z
SHIELD_POLY = [(0.50, 0.16), (0.78, 0.26), (0.78, 0.48)]
SHIELD_POLY += bezier((0.78, 0.48), (0.78, 0.66), (0.665, 0.78), (0.50, 0.85))
SHIELD_POLY += bezier((0.50, 0.85), (0.335, 0.78), (0.22, 0.66), (0.22, 0.48))
SHIELD_POLY += [(0.22, 0.26)]


def in_shield(x, y):
    inside = False
    n = len(SHIELD_POLY)
    for i in range(n):
        (ax, ay), (bx, by) = SHIELD_POLY[i], SHIELD_POLY[(i + 1) % n]
        if (ay > y) != (by > y) and x < ax + (y - ay) * (bx - ax) / (by - ay):
            inside = not inside
    return inside


def seg_dist(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def on_check(x, y):
    return any(seg_dist(x, y, ax, ay, bx, by) <= STROKE / 2 for (ax, ay), (bx, by) in zip(CHECK, CHECK[1:]))


def color_at(x, y):
    if on_check(x, y):
        return WHITE
    if in_shield(x, y):
        return SHIELD
    t = max(0.0, min(1.0, (x + y) / 2))
    return tuple(BG_TOP[k] + (BG_BOTTOM[k] - BG_TOP[k]) * t for k in range(3))


def render(size):
    rows = bytearray()
    for j in range(size):
        rows.append(0)  # PNG filter: none
        for i in range(size):
            acc = [0.0, 0.0, 0.0]
            for sj in range(SS):
                for si in range(SS):
                    c = color_at((i + (si + 0.5) / SS) / size, (j + (sj + 0.5) / SS) / size)
                    for k in range(3):
                        acc[k] += c[k]
            rows.extend(round(v / (SS * SS)) for v in acc)
    return bytes(rows)


def png(size, raw):
    def chunk(kind, data):
        return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data) & 0xFFFFFFFF)

    ihdr = struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)  # 8-bit RGB, opaque
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')


if __name__ == '__main__':
    out = Path('public')
    out.mkdir(exist_ok=True)
    for name, size in [('apple-touch-icon.png', 180), ('icon-192.png', 192), ('icon-512.png', 512)]:
        (out / name).write_bytes(png(size, render(size)))
        print(f'wrote public/{name} ({size}x{size})')
