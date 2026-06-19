#!/usr/bin/env bash
set -euo pipefail

# 自动下载并配齐非 Google Fonts 字体（英文自托管 + 中文按需 subset）
# 字体文件不进仓库（见 .gitignore），clone 后跑一次即可。
#
# 依赖：curl, unzip；中文 subset 需 fonttools（见 ../scripts/）
#
# 用法（在 design-language/ 下运行）：
#   ./scripts/fetch-fonts.sh                 # 下载全部字体（英文 woff2 + 中文原始 ttf/otf）
#   ./scripts/fetch-fonts.sh --subset DIR    # 下载后再对中文做精确 subset（扫 DIR 实际用字）
#
# 产物：
#   starter/public/fonts/*.woff2     英文（Geist / Satoshi / 得意黑）
#   fonts/*.ttf|otf                  中文原始（文楷 / 思源 / MiSans）
#   英文 @font-face 已内联在 starter/src/styles/index.css

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$SCRIPT_DIR/.."
RAW="$ROOT/fonts"

# --subset DIR：把 DIR 当作目标项目，字体输出到 DIR/public/fonts；
# 不带参数时默认输出到本仓库 starter（开发本仓库用）。
TARGET="$ROOT/starter"
if [[ "${1:-}" == "--subset" && -n "${2:-}" ]]; then TARGET="$(cd "$2" && pwd)"; fi
PUB="$TARGET/public/fonts"
mkdir -p "$PUB" "$RAW"

GEIST="https://github.com/vercel/geist-font/raw/main/packages/next/dist/fonts"

dl() {
  local url="$1" out="$2"
  if [[ -f "$out" ]]; then echo "  已存在: $(basename "$out")"; return; fi
  echo "  下载: $(basename "$out")"
  curl -sL --max-time 60 -o "$out" "$url"
}

echo "[fetch] 英文字体 -> $PUB"
dl "$GEIST/geist-sans/Geist-Regular.woff2"  "$PUB/Geist-Regular.woff2"
dl "$GEIST/geist-sans/Geist-Medium.woff2"   "$PUB/Geist-Medium.woff2"
dl "$GEIST/geist-sans/Geist-SemiBold.woff2" "$PUB/Geist-SemiBold.woff2"
dl "$GEIST/geist-mono/GeistMono-Regular.woff2" "$PUB/GeistMono-Regular.woff2"

echo "[fetch] Satoshi (Fontshare)"
if [[ ! -f "$PUB/Satoshi-Variable.woff2" ]]; then
  TMP="$(mktemp -d)"
  curl -sL --max-time 120 -o "$TMP/satoshi.zip" "https://api.fontshare.com/v2/fonts/download/satoshi"
  unzip -o -q "$TMP/satoshi.zip" -d "$TMP"
  found="$(find "$TMP" -iname '*Variable.woff2' | head -1 || true)"
  [[ -n "$found" ]] && cp "$found" "$PUB/Satoshi-Variable.woff2" && echo "  Satoshi-Variable.woff2 ok"
  rm -rf "$TMP"
fi

echo "[fetch] 得意黑 Smiley Sans"
if [[ ! -f "$PUB/SmileySans-Oblique.woff2" ]]; then
  TMP="$(mktemp -d)"
  curl -sL --max-time 120 -o "$TMP/smiley.zip" \
    "https://github.com/atelier-anchor/smiley-sans/releases/download/v2.0.1/smiley-sans-v2.0.1.zip"
  unzip -o -q "$TMP/smiley.zip" -d "$TMP"
  cp "$TMP/SmileySans-Oblique.ttf.woff2" "$PUB/SmileySans-Oblique.woff2"
  echo "  SmileySans-Oblique.woff2 ok"
  rm -rf "$TMP"
fi

echo "[fetch] 霞鹜文楷 LXGW WenKai（中文，较大，存 $RAW）"
dl "https://github.com/lxgw/LxgwWenKai/releases/download/v1.520/LXGWWenKai-Regular.ttf" \
   "$RAW/LXGWWenKai-Regular.ttf"

echo "[fetch] 思源黑体/宋体（中文）"
dl "https://github.com/notofonts/noto-cjk/raw/main/Sans/SubsetOTF/SC/NotoSansSC-Regular.otf" \
   "$RAW/NotoSansSC-Regular.otf"
dl "https://github.com/notofonts/noto-cjk/raw/main/Serif/SubsetOTF/SC/NotoSerifSC-Regular.otf" \
   "$RAW/NotoSerifSC-Regular.otf"

echo "[fetch] MiSans（小米开源，dark preset 中文；官网需登录，用社区镜像）"
dl "https://github.com/woods-marshes/chat-multiplatform/raw/main/core/ui/src/commonMain/composeResources/font/MiSans-Regular.ttf" \
   "$RAW/MiSans-Regular.ttf"

if [[ "${1:-}" == "--subset" && -n "${2:-}" ]]; then
  echo "[fetch] 中文精确 subset（扫 $2）"
  for f in "$RAW/LXGWWenKai-Regular.ttf" "$RAW/NotoSansSC-Regular.otf" "$RAW/NotoSerifSC-Regular.otf" "$RAW/MiSans-Regular.ttf"; do
    [[ -f "$f" ]] && "$SCRIPT_DIR/subset-exact.sh" "$f" "$2" "$PUB/$(basename "${f%.*}").subset.woff2"
  done
fi

echo "[fetch] 完成。字体已输出到 $PUB"
echo "英文 @font-face 已内联在 starter/src/styles/index.css（复制 starter 的新项目自带）。"
