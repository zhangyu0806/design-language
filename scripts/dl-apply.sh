#!/usr/bin/env bash
# dl-apply — 把个人设计语言注入到任意项目，让 AI 生成的 UI 收敛到你的风格。
#
# 用法:
#   dl-apply <项目目录> [preset]        # 注入设计规范到 <项目>/AGENTS.md（默认 preset=dark）
#   dl-apply .                          # 对当前目录，用默认 dark preset
#   dl-apply ~/foo editorial            # 指定 editorial preset
#   dl-apply --check <项目目录>          # 只检查是否已注入，不修改文件
#
# 做两件事:
#   1) 把 DESIGN.md（全局 DNA + NEVERS）+ presets/<preset>.md 拼进项目的 AGENTS.md
#      （已存在则在标记区块内幂等更新，不动你其他内容）
#   2) 提示如何接入样式（tokens.css / theme.css）与字体脚本
#
# 设计语言仓库根目录：脚本所在目录的上一级。
set -euo pipefail

SOURCE="${BASH_SOURCE[0]}"
while [ -L "$SOURCE" ]; do
  DIR="$(cd -P "$(dirname "$SOURCE")" && pwd)"
  SOURCE="$(readlink "$SOURCE")"
  case "$SOURCE" in /*) ;; *) SOURCE="$DIR/$SOURCE" ;; esac
done
SCRIPT_DIR="$(cd -P "$(dirname "$SOURCE")" && pwd)"
DL_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

PRESETS_LIST="editorial brutalist warm dark"
BEGIN_MARK="<!-- BEGIN design-language (dl-apply, 勿手改本区块) -->"
END_MARK="<!-- END design-language -->"

die() { printf 'dl-apply: %s\n' "$1" >&2; exit 1; }

MODE="apply"
if [ "${1:-}" = "--check" ]; then
  MODE="check"
  shift
fi

TARGET="${1:-}"
PRESET="${2:-dark}"

[ -n "$TARGET" ] || die "缺少项目目录。用法: dl-apply <项目目录> [preset]"
[ -d "$TARGET" ] || die "目录不存在: $TARGET"
case " $PRESETS_LIST " in
  *" $PRESET "*) ;;
  *) die "未知 preset: $PRESET（可选: $PRESETS_LIST）" ;;
esac

DESIGN_MD="$DL_ROOT/DESIGN.md"
PRESET_MD="$DL_ROOT/presets/$PRESET.md"
[ -f "$DESIGN_MD" ] || die "找不到 $DESIGN_MD"
[ -f "$PRESET_MD" ] || die "找不到 $PRESET_MD"

TARGET_ABS="$(cd "$TARGET" && pwd)"
AGENTS="$TARGET_ABS/AGENTS.md"

if [ "$MODE" = "check" ]; then
  if [ -f "$AGENTS" ] && grep -qF "$BEGIN_MARK" "$AGENTS"; then
    PRESET_LINE="$(grep -m1 '^# 设计语言（当前 preset:' "$AGENTS" || true)"
    printf 'dl-apply: OK，已注入设计语言区块: %s\n' "$AGENTS"
    [ -n "$PRESET_LINE" ] && printf 'dl-apply: %s\n' "$PRESET_LINE"
    exit 0
  fi
  printf 'dl-apply: MISSING，未在 %s 找到设计语言区块。运行: dl-apply "%s" %s\n' "$AGENTS" "$TARGET_ABS" "$PRESET" >&2
  exit 2
fi

BLOCK="$(mktemp)"
trap 'rm -f "$BLOCK"' EXIT
{
  echo "$BEGIN_MARK"
  echo ""
  echo "# 设计语言（当前 preset: $PRESET）"
  echo ""
  echo "> 本区块由 \`dl-apply\` 从 design-language 注入。动 UI 前必读。重跑 dl-apply 会刷新。"
  echo "> 上游: https://github.com/zhangyu0806/design-language"
  echo ""
  cat "$DESIGN_MD"
  echo ""
  echo "---"
  echo ""
  cat "$PRESET_MD"
  echo ""
  echo "$END_MARK"
} > "$BLOCK"

if [ -f "$AGENTS" ] && grep -qF "$BEGIN_MARK" "$AGENTS"; then
  TMP="$(mktemp)"
  awk -v b="$BEGIN_MARK" -v e="$END_MARK" -v f="$BLOCK" '
    $0==b {skip=1; while((getline line < f)>0) print line; close(f); next}
    $0==e {skip=0; next}
    skip!=1 {print}
  ' "$AGENTS" > "$TMP"
  mv "$TMP" "$AGENTS"
  echo "dl-apply: 已在 $AGENTS 更新设计语言区块（preset=$PRESET）"
else
  { [ -f "$AGENTS" ] && cat "$AGENTS" && echo ""; cat "$BLOCK"; } > "$AGENTS.new"
  mv "$AGENTS.new" "$AGENTS"
  echo "dl-apply: 已写入 $AGENTS（preset=$PRESET）"
fi

cat <<EOF

下一步（接入样式，按需手动）:
  1. 主入口 CSS 顶部加:
       @import "$DL_ROOT/css/tokens.css";
       @import "tailwindcss";
       @import "$DL_ROOT/tailwind/theme.css";
     （或复制 tokens.css / theme.css 进项目内自托管，跨环境更稳）
  2. HTML 根标签: <html data-preset="$PRESET" data-theme="light">
  3. 要中文字体效果: $DL_ROOT/scripts/fetch-fonts.sh --subset "$TARGET_ABS"

AI 现在会从 $AGENTS 读到你的设计语言，生成的 UI 收敛到「你的风格」而非 AI 均值。
EOF
