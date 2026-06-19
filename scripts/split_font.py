#!/usr/bin/env python3
"""按 unicode-range 分包中文字体（Google Fonts 同款思路），输出 woff2 分包 + CSS。

依赖 fonttools + brotli。由 subset-split.sh 调用，也可独立运行：
  python3 split_font.py <font> <outdir> [--family NAME] [--weight 400] [--chunk 500]

分包策略：先放拉丁/标点为 chunk-0，再把 CJK 码位每 N 个一包，
每包生成 woff2 与对应 @font-face（含 unicode-range），浏览器按需下载。
"""
import sys
import argparse
import pathlib
from fontTools import subset
from fontTools.ttLib import TTFont


def codepoints(font_path):
    font = TTFont(font_path, lazy=True)
    cmap = font.getBestCmap()
    font.close()
    return sorted(cmap.keys())


def make_ranges(cps, chunk):
    latin = [c for c in cps if c < 0x2E80]
    cjk = [c for c in cps if c >= 0x2E80]
    chunks = []
    if latin:
        chunks.append(latin)
    for i in range(0, len(cjk), chunk):
        chunks.append(cjk[i : i + chunk])
    return chunks


def unicode_range_str(cps):
    parts, start, prev = [], None, None
    for c in cps:
        if start is None:
            start = prev = c
        elif c == prev + 1:
            prev = c
        else:
            parts.append((start, prev))
            start = prev = c
    if start is not None:
        parts.append((start, prev))
    out = []
    for a, b in parts:
        out.append(f"U+{a:04X}" if a == b else f"U+{a:04X}-{b:04X}")
    return ", ".join(out)


def subset_chunk(font_path, cps, out_woff2):
    opts = subset.Options()
    opts.flavor = "woff2"
    opts.layout_features = ["*"]
    opts.hinting = False
    opts.desubroutinize = True
    opts.notdef_outline = True
    opts.recalc_bounds = True
    sub = subset.Subsetter(options=opts)
    font = subset.load_font(font_path, opts)
    sub.populate(unicodes=cps)
    sub.subset(font)
    subset.save_font(font, out_woff2, opts)
    font.close()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("font")
    ap.add_argument("outdir")
    ap.add_argument("--family", default=None)
    ap.add_argument("--weight", default="400")
    ap.add_argument("--style", default="normal")
    ap.add_argument("--chunk", type=int, default=500)
    args = ap.parse_args()

    font_path = args.font
    outdir = pathlib.Path(args.outdir)
    outdir.mkdir(parents=True, exist_ok=True)

    if not args.family:
        f = TTFont(font_path, lazy=True)
        name = f["name"].getDebugName(1) or pathlib.Path(font_path).stem
        f.close()
        args.family = name

    cps = codepoints(font_path)
    chunks = make_ranges(cps, args.chunk)
    stem = pathlib.Path(font_path).stem
    css_lines = []

    for idx, group in enumerate(chunks):
        woff2_name = f"{stem}.{idx}.woff2"
        subset_chunk(font_path, group, str(outdir / woff2_name))
        urange = unicode_range_str(group)
        css_lines.append(
            "@font-face {\n"
            f"  font-family: '{args.family}';\n"
            f"  font-style: {args.style};\n"
            f"  font-weight: {args.weight};\n"
            "  font-display: swap;\n"
            f"  src: url('./{woff2_name}') format('woff2');\n"
            f"  unicode-range: {urange};\n"
            "}\n"
        )
        print(f"  chunk {idx}: {len(group)} 字 -> {woff2_name}")

    css_path = outdir / "result.css"
    css_path.write_text("\n".join(css_lines), encoding="utf-8")
    print(f"[split] 共 {len(chunks)} 包，CSS: {css_path}")


if __name__ == "__main__":
    main()
