#!/usr/bin/env python3
"""
compress_pdf.py — Hawkeye Compression Engine
Rasterizes every page of the input PDF at a fixed DPI and re-encodes
as JPEG-backed PDF pages. Deterministic output size.

Usage:
    python compress_pdf.py <input.pdf> <output.pdf> [dpi=90]
    python compress_pdf.py <input.pdf> <hydra_dir>  120 --hydra
"""
import sys
import os
import io
import json
from pathlib import Path

# Hard floor — never exceed this regardless of CLI argument.
MAX_DPI = 90
JPEG_QUALITY = 60          # 55–65 is the sweet spot for scanned docs
GRAYSCALE = False          # set True to halve size on B/W scans

def log(msg):
    print(f"[compress_pdf] {msg}", flush=True)

def rasterize_pdf(in_path: str, out_path: str, dpi: int):
    import fitz                       # PyMuPDF
    from PIL import Image

    dpi = min(int(dpi), MAX_DPI)      # CLAMP — never above 90
    log(f"Rasterizing {in_path} @ {dpi} DPI (q={JPEG_QUALITY}, gray={GRAYSCALE})")

    src = fitz.open(in_path)
    out = fitz.open()                 # empty PDF we will fill

    zoom = dpi / 72.0
    matrix = fitz.Matrix(zoom, zoom)

    for i, page in enumerate(src):
        pix = page.get_pixmap(matrix=matrix, alpha=False)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)

        if GRAYSCALE:
            img = img.convert("L")

        buf = io.BytesIO()
        img.save(buf, format="JPEG",
                 quality=JPEG_QUALITY,
                 optimize=True,
                 progressive=True)
        buf.seek(0)

        # Page sized in points so the visual layout is preserved.
        rect = fitz.Rect(0, 0, pix.width * 72.0 / dpi,
                              pix.height * 72.0 / dpi)
        new_page = out.new_page(width=rect.width, height=rect.height)
        new_page.insert_image(rect, stream=buf.read())

        log(f"  page {i+1}/{len(src)} -> {pix.width}x{pix.height}")

    out.save(out_path,
             garbage=4,           # remove unreferenced objects
             deflate=True,
             clean=True)
    out.close()
    src.close()

    in_sz  = os.path.getsize(in_path)
    out_sz = os.path.getsize(out_path)
    ratio  = (1 - out_sz / in_sz) * 100 if in_sz else 0
    log(f"DONE: {in_sz}B -> {out_sz}B  ({ratio:.1f}% smaller)")

def hydra_shard(in_path: str, out_dir: str, dpi: int):
    """Optional: emit one JPEG per page + manifest.json."""
    import fitz
    from PIL import Image

    dpi = min(int(dpi), MAX_DPI)
    Path(out_dir).mkdir(parents=True, exist_ok=True)
    src = fitz.open(in_path)
    zoom = dpi / 72.0
    matrix = fitz.Matrix(zoom, zoom)
    manifest = []

    for i, page in enumerate(src):
        pix = page.get_pixmap(matrix=matrix, alpha=False)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        if GRAYSCALE:
            img = img.convert("L")
        fname = f"page_{i+1:04d}.jpg"
        fpath = os.path.join(out_dir, fname)
        img.save(fpath, format="JPEG",
                 quality=JPEG_QUALITY, optimize=True, progressive=True)
        manifest.append({
            "page": i + 1,
            "file": fname,
            "width": pix.width,
            "height": pix.height,
            "dpi": dpi,
        })

    with open(os.path.join(out_dir, "manifest.json"), "w") as f:
        json.dump(manifest, f)
    src.close()
    log(f"Hydra: wrote {len(manifest)} shards to {out_dir}")

def main():
    if len(sys.argv) < 3:
        print("Usage: compress_pdf.py <input.pdf> <output> [dpi] [--hydra]")
        sys.exit(2)

    in_path  = sys.argv[1]
    out_path = sys.argv[2]
    dpi_arg  = 90
    hydra    = False
    for a in sys.argv[3:]:
        if a == "--hydra":
            hydra = True
        else:
            try:
                dpi_arg = int(a)
            except ValueError:
                pass

    if not os.path.exists(in_path):
        log(f"ERROR: input not found: {in_path}")
        sys.exit(3)

    try:
        if hydra:
            hydra_shard(in_path, out_path, dpi_arg)
        else:
            rasterize_pdf(in_path, out_path, dpi_arg)
    except Exception as e:
        log(f"FATAL: {type(e).__name__}: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
