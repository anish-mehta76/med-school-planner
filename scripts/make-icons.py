"""Draws the app icon (white check mark in a ring on the accent teal) as PNGs.

Standard library only. Run from the repo root:  python3 scripts/make-icons.py
Writes public/apple-touch-icon.png (180), public/icon-192.png and public/icon-512.png.
Icons are opaque and full-bleed, because iOS rounds the corners itself.
"""
import math
import struct
import zlib
from pathlib import Path

TEAL = (0x0F, 0x6E, 0x66)
WHITE = (0xFF, 0xFF, 0xFF)
SS = 4  # supersamples per axis for anti-aliasing

# Geometry in a 0..1 unit square.
CENTER = (0.5, 0.5)
RING_R = 0.30
STROKE = 0.055
CHECK = [(0.385, 0.505), (0.465, 0.585), (0.625, 0.425)]


def seg_dist(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - (ax + t * dx), py - (ay + t * dy))


def inked(x, y):
    if abs(math.hypot(x - CENTER[0], y - CENTER[1]) - RING_R) <= STROKE / 2:
        return True
    for (ax, ay), (bx, by) in zip(CHECK, CHECK[1:]):
        if seg_dist(x, y, ax, ay, bx, by) <= STROKE / 2:
            return True
    return False


def render(size):
    rows = bytearray()
    for j in range(size):
        rows.append(0)  # PNG filter: none
        for i in range(size):
            hits = 0
            for sj in range(SS):
                for si in range(SS):
                    if inked((i + (si + 0.5) / SS) / size, (j + (sj + 0.5) / SS) / size):
                        hits += 1
            a = hits / (SS * SS)
            rows.extend(round(TEAL[k] + (WHITE[k] - TEAL[k]) * a) for k in range(3))
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
