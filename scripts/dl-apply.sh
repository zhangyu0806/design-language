#!/usr/bin/env bash
# dl-apply — 把个人设计语言注入到任意项目，让 AI 生成的 UI 收敛到你的风格。
set -euo pipefail

SOURCE="${BASH_SOURCE[0]}"
while [ -L "$SOURCE" ]; do
  DIR="$(cd -P "$(dirname "$SOURCE")" && pwd)"
  SOURCE="$(readlink "$SOURCE")"
  case "$SOURCE" in /*) ;; *) SOURCE="$DIR/$SOURCE" ;; esac
done
SCRIPT_DIR="$(cd -P "$(dirname "$SOURCE")" && pwd)"
DL_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
. "$SCRIPT_DIR/dl-apply-registry.sh"

PRESETS_LIST="editorial brutalist warm dark"
BEGIN_MARK="<!-- BEGIN design-language (dl-apply, 勿手改本区块) -->"
END_MARK="<!-- END design-language -->"

die() {
  printf 'dl-apply: %s\n' "$1" >&2
  exit 1
}

usage_error() {
  die "$1。用法: dl-apply [--check] [--modules ID[,ID...]] <项目目录> [preset]"
}

MODE="apply"
TARGET=""
PRESET=""
POSITIONAL_COUNT=0
OPTIONS_ENABLED=1
SELECTED_MODULES=" "

select_modules() {
  MODULE_VALUE="$1"
  [ -n "$MODULE_VALUE" ] || usage_error "--modules 缺少值"

  MODULE_REMAINDER="$MODULE_VALUE"
  while :; do
    case "$MODULE_REMAINDER" in
      *,*) MODULE_ID="${MODULE_REMAINDER%%,*}"; MODULE_REMAINDER="${MODULE_REMAINDER#*,}"; MORE_MODULES=1 ;;
      *) MODULE_ID="$MODULE_REMAINDER"; MORE_MODULES=0 ;;
    esac
    [ -n "$MODULE_ID" ] || usage_error "模块列表包含空 ID"
    case " $MODULES_LIST " in
      *" $MODULE_ID "*) ;;
      *) usage_error "未知模块: $MODULE_ID（可选: $MODULES_LIST）" ;;
    esac
    case "$SELECTED_MODULES" in
      *" $MODULE_ID "*) ;;
      *) SELECTED_MODULES="$SELECTED_MODULES$MODULE_ID " ;;
    esac
    [ "$MORE_MODULES" -eq 1 ] || break
  done
}

while [ "$#" -gt 0 ]; do
  ARGUMENT="$1"
  shift
  if [ "$OPTIONS_ENABLED" -eq 1 ]; then
    case "$ARGUMENT" in
      --) OPTIONS_ENABLED=0; continue ;;
      --check) MODE="check"; continue ;;
      --modules)
        [ "$#" -gt 0 ] || usage_error "--modules 缺少值"
        select_modules "$1"
        shift
        continue
        ;;
      --modules=*) select_modules "${ARGUMENT#--modules=}"; continue ;;
      -*) usage_error "未知选项: $ARGUMENT" ;;
    esac
  fi

  POSITIONAL_COUNT=$((POSITIONAL_COUNT + 1))
  case "$POSITIONAL_COUNT" in
    1) TARGET="$ARGUMENT" ;;
    2) PRESET="$ARGUMENT" ;;
    *) usage_error "位置参数过多" ;;
  esac
done

[ -n "$TARGET" ] || usage_error "缺少项目目录"
[ -n "$PRESET" ] || PRESET="dark"
[ -d "$TARGET" ] || die "目录不存在: $TARGET"
case " $PRESETS_LIST " in
  *" $PRESET "*) ;;
  *) usage_error "未知 preset: $PRESET（可选: $PRESETS_LIST）" ;;
esac

MODULES=""
append_module_id() {
  if [ -n "$MODULES" ]; then
    MODULES="$MODULES,$1"
  else
    MODULES="$1"
  fi
}
for MODULE_ID in $MODULES_LIST; do
  case "$SELECTED_MODULES" in
    *" $MODULE_ID "*) append_module_id "$MODULE_ID" ;;
  esac
done
MODULES_DISPLAY="${MODULES:-none}"

DESIGN_MD="$DL_ROOT/DESIGN.md"
STYLE_PREVIEW_MD="$DL_ROOT/STYLE_PREVIEW.md"
PRESET_MD="$DL_ROOT/presets/$PRESET.md"
[ -r "$DESIGN_MD" ] || die "找不到或无法读取 $DESIGN_MD"
[ -r "$STYLE_PREVIEW_MD" ] || die "找不到或无法读取 $STYLE_PREVIEW_MD"
[ -r "$PRESET_MD" ] || die "找不到或无法读取 $PRESET_MD"

file_mode() {
  stat -c '%a' "$1" 2>/dev/null || stat -f '%Lp' "$1" 2>/dev/null
}

file_owner() {
  stat -c '%u' "$1" 2>/dev/null || stat -f '%u' "$1" 2>/dev/null
}

file_identity() {
  stat -c '%d:%i' "$1" 2>/dev/null || stat -f '%d:%i' "$1" 2>/dev/null
}
for MODULE_ID in $MODULES_LIST; do
  case "$SELECTED_MODULES" in
    *" $MODULE_ID "*)
      MODULE_FILE="$(module_file "$MODULE_ID")" || die "未知模块注册: $MODULE_ID"
      [ -r "$MODULE_FILE" ] || die "找不到或无法读取 $MODULE_FILE"
      ;;
  esac
done

TARGET_ABS="$(cd -- "$TARGET" && pwd)"
AGENTS="$TARGET_ABS/AGENTS.md"
BLOCK="$(mktemp)" || die "无法创建临时文件"
EXTRACTED=""
EXTRACT_PREFIX=""
CANDIDATE=""
cleanup() {
  rm -f "$BLOCK"
  [ -z "$EXTRACTED" ] || rm -f "$EXTRACTED"
  [ -z "$EXTRACT_PREFIX" ] || rm -f "$EXTRACT_PREFIX"
  [ -z "$CANDIDATE" ] || rm -f "$CANDIDATE"
}
trap cleanup EXIT HUP INT TERM

append_section() {
  printf '\n---\n\n' >> "$BLOCK"
  cat "$1" >> "$BLOCK"
  printf '\n' >> "$BLOCK"
}

{
  printf '%s\n\n' "$BEGIN_MARK"
  printf '# 设计语言（当前 preset: %s；modules: %s）\n\n' "$PRESET" "$MODULES_DISPLAY"
  printf '> 本区块由 `dl-apply` 从 design-language 注入。动 UI 前必读。重跑 dl-apply 会刷新。\n'
  printf '> 上游: https://github.com/zhangyu0806/design-language\n\n'
  cat "$DESIGN_MD"
  printf '\n'
} > "$BLOCK"
append_section "$STYLE_PREVIEW_MD"
for MODULE_ID in $MODULES_LIST; do
  case "$SELECTED_MODULES" in
    *" $MODULE_ID "*)
      MODULE_FILE="$(module_file "$MODULE_ID")" || die "未知模块注册: $MODULE_ID"
      printf '\n---\n\n## 可选模块: %s\n\n' "$MODULE_ID" >> "$BLOCK"
      cat "$MODULE_FILE" >> "$BLOCK"
      printf '\n' >> "$BLOCK"
      ;;
  esac
done
append_section "$PRESET_MD"
printf '\n%s\n' "$END_MARK" >> "$BLOCK"

BEGIN_COUNT=0
END_COUNT=0
BEGIN_LINE=0
END_LINE=0
SUSPICIOUS_COUNT=0
ORIGINAL_ID=""
[ ! -L "$AGENTS" ] || die "拒绝修改符号链接: $AGENTS"
if [ -e "$AGENTS" ]; then
  [ -f "$AGENTS" ] || die "目标不是普通文件: $AGENTS"
  [ -r "$AGENTS" ] || die "无法读取 $AGENTS"
  [ "$(file_owner "$AGENTS")" = "$(id -u)" ] || die "目标文件不属于当前用户，拒绝修改: $AGENTS"
  ORIGINAL_ID="$(file_identity "$AGENTS")" || die "无法读取 $AGENTS 的文件身份"
  MARKER_INFO="$(awk -v begin="$BEGIN_MARK" -v end="$END_MARK" '
    {
      line=$0
      sub(/\r$/, "", line)
    }
    line == begin { begin_count++; if (begin_line == 0) begin_line=NR; next }
    line == end { end_count++; if (end_line == 0) end_line=NR; next }
    { lower=tolower(line) }
    lower ~ /^[[:space:]]*<!--[[:space:]]*(begin|end)[[:space:]]*design-language/ { suspicious_count++ }
    END { printf "%d %d %d %d %d\n", begin_count, end_count, begin_line, end_line, suspicious_count }
  ' "$AGENTS")"
  set -- $MARKER_INFO
  BEGIN_COUNT="$1"
  END_COUNT="$2"
  BEGIN_LINE="$3"
  END_LINE="$4"
  SUSPICIOUS_COUNT="$5"
  [ ! -L "$AGENTS" ] && [ "$(file_identity "$AGENTS")" = "$ORIGINAL_ID" ] || die "AGENTS.md 在检查期间发生变化，请重试"
fi

if [ "$SUSPICIOUS_COUNT" -gt 0 ]; then
  die "AGENTS.md 中存在近似但不合法的 design-language 标记，请人工修复"
elif [ "$BEGIN_COUNT" -eq 0 ] && [ "$END_COUNT" -eq 0 ]; then
  MARKER_STATE="missing"
elif [ "$BEGIN_COUNT" -eq 1 ] && [ "$END_COUNT" -eq 1 ] && [ "$BEGIN_LINE" -lt "$END_LINE" ]; then
  MARKER_STATE="complete"
else
  die "AGENTS.md 中的 design-language 标记损坏、重复或顺序错误，请人工修复"
fi

if [ "$MODE" = "check" ]; then
  if [ "$MARKER_STATE" = "missing" ]; then
    printf 'dl-apply: MISSING，%s 中没有受管区块（期望 preset=%s, modules=%s）\n' "$AGENTS" "$PRESET" "$MODULES_DISPLAY" >&2
    exit 2
  fi
  EXTRACTED="$(mktemp)" || die "无法创建临时文件"
  EXTRACT_PREFIX="$(mktemp)" || die "无法创建临时文件"
  head -n "$END_LINE" "$AGENTS" > "$EXTRACT_PREFIX"
  tail -n +"$BEGIN_LINE" "$EXTRACT_PREFIX" > "$EXTRACTED"
  rm -f "$EXTRACT_PREFIX"
  EXTRACT_PREFIX=""
  if cmp -s "$BLOCK" "$EXTRACTED"; then
    printf 'dl-apply: OK，受管区块完全匹配: %s（preset=%s, modules=%s）\n' "$AGENTS" "$PRESET" "$MODULES_DISPLAY"
    exit 0
  fi
  printf 'dl-apply: MISMATCH，%s 的受管区块与期望不一致（preset=%s, modules=%s）\n' "$AGENTS" "$PRESET" "$MODULES_DISPLAY" >&2
  exit 2
fi

CANDIDATE="$(mktemp "$TARGET_ABS/.dl-apply.XXXXXX")" || die "无法在目标目录创建临时文件"
if [ "$MARKER_STATE" = "complete" ]; then
  head -n $((BEGIN_LINE - 1)) "$AGENTS" > "$CANDIDATE"
  cat "$BLOCK" >> "$CANDIDATE"
  tail -n +$((END_LINE + 1)) "$AGENTS" >> "$CANDIDATE"
else
  if [ -f "$AGENTS" ]; then
    cat "$AGENTS" > "$CANDIDATE"
    [ ! -s "$AGENTS" ] || printf '\n' >> "$CANDIDATE"
  fi
  cat "$BLOCK" >> "$CANDIDATE"
fi

if [ -f "$AGENTS" ]; then
  [ ! -L "$AGENTS" ] && [ "$(file_identity "$AGENTS")" = "$ORIGINAL_ID" ] || die "AGENTS.md 在更新期间发生变化，请重试"
  FILE_MODE="$(file_mode "$AGENTS")" || die "无法读取 $AGENTS 的权限"
  chmod "$FILE_MODE" "$CANDIDATE" || die "无法保留 $AGENTS 的权限"
  if cmp -s "$CANDIDATE" "$AGENTS"; then
    rm -f "$CANDIDATE"
    CANDIDATE=""
    printf 'dl-apply: 无需更新，受管区块已完全匹配（preset=%s, modules=%s）\n' "$PRESET" "$MODULES_DISPLAY"
    exit 0
  fi
fi
[ -z "$ORIGINAL_ID" ] || { [ ! -L "$AGENTS" ] && [ "$(file_identity "$AGENTS")" = "$ORIGINAL_ID" ]; } || die "AGENTS.md 在替换前发生变化，请重试"
mv "$CANDIDATE" "$AGENTS"
CANDIDATE=""
printf 'dl-apply: 已更新 %s（preset=%s, modules=%s）\n' "$AGENTS" "$PRESET" "$MODULES_DISPLAY"

cat <<EOF

下一步（接入样式，按需手动）:
  1. 主入口 CSS 顶部加:
       @import "$DL_ROOT/css/tokens.css";
       @import "tailwindcss";
       @import "$DL_ROOT/tailwind/theme.css";
  2. HTML 根标签: <html data-preset="$PRESET" data-theme="light">
  3. 要中文字体效果: $DL_ROOT/scripts/fetch-fonts.sh --subset "$TARGET_ABS"
  4. 风格方向未定时: 让 AI 按 STYLE_PREVIEW.md 先生成 design-previews/YYYY-MM-DD-任务名/index.html
EOF
