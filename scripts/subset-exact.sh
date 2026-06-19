#!/usr/bin/env bash
set -euo pipefail

# 中文字体精确 subset（固定文案的小站用）
# 扫描项目源码提取实际用到的汉字，用 pyftsubset 一次性压到最小。
# 体积最小，但内容变了要重新跑。
#
# 依赖：pip install fonttools brotli
#
# 用法：
#   ./scripts/subset-exact.sh <字体文件.ttf|otf> <源码目录> [输出.woff2]
# 例：
#   ./scripts/subset-exact.sh fonts/NotoSansSC.ttf ../src fonts/dist/noto-sans-sc.subset.woff2

INPUT="${1:?需要字体文件路径}"
SRCDIR="${2:?需要要扫描的源码目录}"
OUTPUT="${3:-fonts/dist/$(basename "${INPUT%.*}").subset.woff2}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_PY="$SCRIPT_DIR/../.venv/bin/python"
if [[ -x "$VENV_PY" ]]; then
  PY="$VENV_PY"
  PYFTSUBSET="$SCRIPT_DIR/../.venv/bin/pyftsubset"
else
  PY="python3"
  PYFTSUBSET="pyftsubset"
fi

if ! "$PY" -c "import fontTools" 2>/dev/null; then
  echo "缺少 fonttools。安装方式（任选）:" >&2
  echo "  python3 -m venv .venv && .venv/bin/pip install fonttools brotli" >&2
  echo "  或 pipx install fonttools" >&2
  exit 1
fi

mkdir -p "$(dirname "$OUTPUT")"
CHARS_FILE="$(mktemp)"
trap 'rm -f "$CHARS_FILE"' EXIT

# 抽取源码中所有非 ASCII 字符（含中文标点），去重为 unicode 列表
"$PY" - "$SRCDIR" "$CHARS_FILE" <<'PY'
import sys, pathlib
srcdir, out = sys.argv[1], sys.argv[2]
exts = {".html",".htm",".vue",".jsx",".tsx",".js",".ts",".md",".json",".txt",".css"}
chars = set()
for p in pathlib.Path(srcdir).rglob("*"):
    if p.suffix.lower() in exts and p.is_file():
        try:
            for ch in p.read_text(encoding="utf-8", errors="ignore"):
                if ord(ch) > 0x2000:
                    chars.add(ch)
        except Exception:
            pass
# 常用基础标点与全角字符兜底
base = "，。、；：？！“”‘’（）《》【】—…·　0123456789"
chars.update(base)
pathlib.Path(out).write_text("".join(sorted(chars)), encoding="utf-8")
print(f"[subset-exact] 提取到 {len(chars)} 个唯一字符")
PY

echo "[subset-exact] subset 中: $INPUT -> $OUTPUT"
"$PYFTSUBSET" "$INPUT" \
  --text-file="$CHARS_FILE" \
  --output-file="$OUTPUT" \
  --flavor=woff2 \
  --layout-features='*' \
  --no-hinting \
  --desubroutinize

IN_SIZE=$(du -h "$INPUT" | cut -f1)
OUT_SIZE=$(du -h "$OUTPUT" | cut -f1)
echo "[subset-exact] 完成: $IN_SIZE -> $OUT_SIZE  ($OUTPUT)"
echo "[subset-exact] 在 CSS 里手写 @font-face 指向该 woff2，并设 font-display: swap。"
