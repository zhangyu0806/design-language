#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FAILURES=0

assert_mirror() {
  SOURCE_FILE="$1"
  MIRROR_FILE="$2"

  if [ ! -f "$ROOT/$SOURCE_FILE" ]; then
    printf 'not ok - missing source: %s\n' "$SOURCE_FILE" >&2
    FAILURES=$((FAILURES + 1))
  elif [ ! -f "$ROOT/$MIRROR_FILE" ]; then
    printf 'not ok - missing mirror: %s\n' "$MIRROR_FILE" >&2
    FAILURES=$((FAILURES + 1))
  elif cmp -s "$ROOT/$SOURCE_FILE" "$ROOT/$MIRROR_FILE"; then
    printf 'ok - %s mirrors %s\n' "$MIRROR_FILE" "$SOURCE_FILE"
  else
    printf 'not ok - mirror differs: %s\n' "$MIRROR_FILE" >&2
    FAILURES=$((FAILURES + 1))
  fi
}

assert_no_stale_preview_wording() {
  FILE="$1"
  STALE_PREVIEW_WORDING='第二阶段[^。]*(没有(预览)?服务器|不提供预览服务器)|第二阶段[^。]*预览服务器[^。]*(没有|不提供)'

  if grep -Eq "$STALE_PREVIEW_WORDING" "$ROOT/$FILE"; then
    printf 'not ok - stale no-server wording: %s\n' "$FILE" >&2
    FAILURES=$((FAILURES + 1))
  else
    printf 'ok - no stale no-server wording: %s\n' "$FILE"
  fi
}

assert_mirror "DESIGN.md" "starter/.ai/DESIGN.md"
assert_mirror "STYLE_PREVIEW.md" "starter/.ai/STYLE_PREVIEW.md"
assert_mirror "presets/editorial.md" "starter/.ai/presets/editorial.md"
assert_mirror "presets/brutalist.md" "starter/.ai/presets/brutalist.md"
assert_mirror "presets/warm.md" "starter/.ai/presets/warm.md"
assert_mirror "presets/dark.md" "starter/.ai/presets/dark.md"
assert_mirror "references/UI_PATTERNS.md" "starter/.ai/references/UI_PATTERNS.md"
assert_mirror "references/MOTION.md" "starter/.ai/references/MOTION.md"
assert_mirror "references/DATA_VIS.md" "starter/.ai/references/DATA_VIS.md"
assert_mirror "references/PREFERENCES.md" "starter/.ai/references/PREFERENCES.md"

assert_no_stale_preview_wording "STYLE_PREVIEW.md"
assert_no_stale_preview_wording "starter/.ai/STYLE_PREVIEW.md"
assert_no_stale_preview_wording "README.md"
assert_no_stale_preview_wording "USAGE.md"
assert_no_stale_preview_wording "scripts/README.md"
assert_no_stale_preview_wording "starter/README.md"
assert_no_stale_preview_wording "starter/CLAUDE.md"

[ "$FAILURES" -eq 0 ] || exit 1
printf 'test-doc-sync: passed\n'
