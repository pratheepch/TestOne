"""Generate the four Experience Pixels logo concepts as pure black-on-white SVGs."""
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
import os, sys

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)

def svg(name, w, h, body, title):
    doc = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">\n'
           f'  <title>{title}</title>\n'
           f'  <rect width="{w}" height="{h}" fill="#FFFFFF"/>\n'
           f'  <g fill="#000000">\n{body}\n  </g>\n</svg>\n')
    with open(os.path.join(OUT, name), 'w') as fh:
        fh.write(doc)
    print('wrote', name)

def cells(coords, u, ox=0, oy=0):
    """One path made of unit squares (nonzero fill handles overlaps)."""
    d = ''.join(f'M{ox+c*u:g} {oy+r*u:g}h{u:g}v{u:g}h-{u:g}z' for r, c in coords)
    return f'    <path d="{d}"/>'

# ---------------------------------------------------------------- Concept 1: wordmark
font = TTFont('/usr/share/fonts/opentype/inter/Inter-SemiBold.otf')
gs = font.getGlyphSet()
UPM = font['head'].unitsPerEm          # 2048
XH = font['OS/2'].sxHeight             # 1118
STEM = 260                             # measured stem of 'l'
TRACK = 60                             # extra tracking, font units
SIZE = 100                             # font units -> px scale: 100 px per em
S = SIZE / UPM
N = 5                                  # cells per side of the pixel x (odd: diagonals share the centre)
STEP = XH / N

def glyph_path(gname, x, baseline):
    pen = SVGPathPen(gs)
    tp = TransformPen(pen, (S, 0, 0, -S, x * S, baseline))
    gs[gname].draw(tp)
    return f'    <path d="{pen.getCommands()}"/>'

def pixel_x(x, baseline):
    # 5x5 grid, both diagonals, squares of stem width centred on each cell so they just overlap at the corners
    coords = sorted({(i, i) for i in range(N)} | {(i, N - 1 - i) for i in range(N)})
    pitch = (XH - STEM) / (N - 1) * S           # centre-to-centre spacing so the x spans exactly the x-height
    u = STEM * S
    ox = x * S
    oy = baseline - XH * S
    d = ''.join(f'M{ox + c*pitch:.2f} {oy + r*pitch:.2f}h{u:.2f}v{u:.2f}h-{u:.2f}z' for r, c in coords)
    return f'    <path d="{d}"/>'

def square_dot(x, baseline):
    # dotless i stem spans 138..398; square dot of stem width sits one stem-width above x-height
    u = STEM * S
    return f'    <rect x="{x*S + 138*S:.2f}" y="{baseline - (XH + STEM + STEM*0.55)*S:.2f}" width="{u:.2f}" height="{u:.2f}"/>'

def line(text, baseline):
    parts, x = [], 0
    for ch in text:
        if ch == 'x':
            parts.append(pixel_x(x + 50, baseline)); x += 50 + XH + 50 + TRACK
        elif ch == 'i':
            parts.append(glyph_path('dotlessi', x, baseline))
            parts.append(square_dot(x, baseline)); x += gs['dotlessi'].width + TRACK
        else:
            parts.append(glyph_path(ch, x, baseline)); x += gs[ch].width + TRACK
    return '\n'.join(parts), x * S

l1, w1 = line('experience', 120)
l2, w2 = line('pixels', 120 + 108)
W = max(w1, w2) + 40
svg('concept-1-wordmark.svg', round(W), 270, l1 + '\n' + l2, 'Experience Pixels - Concept 1 - Double X wordmark')

# ---------------------------------------------------------------- Concept 2: monogram EP
u = 20
grid = []
grid += [(r, 0) for r in range(5)]                        # E stem
grid += [(r, c) for r in (0, 2, 4) for c in (1, 2, 3)]    # E bars, running into the P stem
grid += [(r, 4) for r in range(5)]                        # P stem (shared with the E bar ends)
grid += [(0, 5), (0, 6), (1, 6), (2, 5), (2, 6)]          # P bowl, single pixel counter at (1,5)
pad = 20
svg('concept-2-monogram.svg', 7*u + 2*pad, 5*u + 2*pad, cells(grid, u, pad, pad), 'Experience Pixels - Concept 2 - Shared Stem monogram')

# ---------------------------------------------------------------- Concept 3: escaped pixel
u, gap = 20, 6
pitch = u + gap
pad = 20
body = []
for r in range(3):
    for c in range(3):
        if (r, c) == (0, 2):
            continue
        body.append(f'M{pad + c*pitch} {pad + pitch + r*pitch}h{u}v{u}h-{u}z')
# escaped pixel: one full pitch up and right from its slot
body.append(f'M{pad + 3*pitch} {pad}h{u}v{u}h-{u}z')
size = pad*2 + 4*pitch - gap
svg('concept-3-escaped-pixel.svg', size, size, f'    <path d="{"".join(body)}"/>', 'Experience Pixels - Concept 3 - The Escaped Pixel')

# ---------------------------------------------------------------- Concept 4: aliased arc
pad = 20
o = pad
d = (f'M{o} {o+100}A100 100 0 0 1 {o+100} {o}'
     f'L{o+100} {o+40}L{o+80} {o+40}L{o+80} {o+60}L{o+60} {o+60}L{o+60} {o+80}L{o+40} {o+80}L{o+40} {o+100}Z')
svg('concept-4-aliased-arc.svg', 140, 140, f'    <path d="{d}"/>', 'Experience Pixels - Concept 4 - Aliased Arc')
