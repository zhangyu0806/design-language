#!/usr/bin/env bash
set -euo pipefail

# 中文字体分包 subset（推荐 web 用）
# 用 fonttools 按 unicode-range 切片，浏览器只下载用到的分包（Google Fonts 同款思路）。
# 适合动态内容（不需要预先知道用到哪些字）。
#
# 依赖：python3 -m venv .venv && .venv/bin/pip install fonttools brotli
#
# 用法：
#   ./scripts/subset-split.sh <字体文件.ttf|otf> [输出目录] [字体族名] [字重]
# 例：
#   ./scripts/subset-split.sh fonts/NotoSansSC.otf fonts/dist/noto-sans-sc "Noto Sans SC" 400
#
# 输出：分包 woff2 + result.css（含 @font-face 与 unicode-range）。
# 把 result.css import 进项目即可。

INPUT="${1:?需要字体文件路径}"
OUTDIR="${2:-fonts/dist/$(basename "${INPUT%.*}")}"
FAMILY="${3:-}"
WEIGHT="${4:-400}"

if [[ ! -f "$INPUT" ]]; then
  echo "字体文件不存在: $INPUT" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_PY="$SCRIPT_DIR/../.venv/bin/python"
PY="${VENV_PY}"
[[ -x "$PY" ]] || PY="python3"

if ! "$PY" -c "import fontTools, brotli" 2>/dev/null; then
  echo "缺少 fonttools/brotli。安装: python3 -m venv .venv && .venv/bin/pip install fonttools brotli" >&2
  exit 1
fi

mkdir -p "$OUTDIR"
echo "[subset-split] 分包中: $INPUT -> $OUTDIR"

ARGS=("$SCRIPT_DIR/split_font.py" "$INPUT" "$OUTDIR" "--weight" "$WEIGHT")
[[ -n "$FAMILY" ]] && ARGS+=("--family" "$FAMILY")
"$PY" "${ARGS[@]}"

echo "[subset-split] 完成。引入方式："
echo "  @import \"$OUTDIR/result.css\";"
