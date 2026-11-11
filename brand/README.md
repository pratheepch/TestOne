# Experience Pixels, logo concept exploration

Phase 2 of the logo exploration. Four fundamentally different directions, pure `#000000` on `#FFFFFF`, flat vector, no color yet.

Open `contact-sheet.html` in a browser (or view `contact-sheet.png`) to compare them at large size and at 64, 32 and 16 px.

| File | Concept | Idea |
| --- | --- | --- |
| `concept-1-wordmark.svg` | Double X wordmark | Inter SemiBold outlines. Both x glyphs are built from nine stem-width squares on a 5x5 pixel grid. All i-dots are squares. The pixel x doubles as the favicon. |
| `concept-2-monogram.svg` | Shared Stem monogram | E and P on a 7x5 grid, uniform 1-unit stroke. The E bars run into the P stem. The P counter is the single pixel in the mark. |
| `concept-3-escaped-pixel.svg` | The Escaped Pixel | 3x3 block of pixels with the top-right pixel lifted one pitch out of the grid. Perfection plus one deliberate act of play. |
| `concept-4-aliased-arc.svg` | Aliased Arc | One solid shape: smooth outer quarter circle, three-step staircase inside. Raster resolving into a human curve. |

## Regenerate

```bash
pip install fonttools
python3 brand/generate.py brand
```

`generate.py` needs Inter SemiBold at `/usr/share/fonts/opentype/inter/Inter-SemiBold.otf` for the wordmark. The other three marks are pure geometry.

## Decision log

- 2026-11-11: Explore all four directions as SVG files in the repo, with a contact sheet for size checks. Approved.
- 2026-11-11: Wordmark x changed from a 4x4 to a 5x5 pixel grid after the 4x4 read as a checkered blob at display size.
- 2026-11-11: Monogram rebuilt so both letters keep correct orientation (a single shared stem mirrored the E).
