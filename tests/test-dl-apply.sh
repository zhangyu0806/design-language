#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DL_APPLY="$ROOT/scripts/dl-apply.sh"
BEGIN_MARK='<!-- BEGIN design-language (dl-apply, 勿手改本区块) -->'
END_MARK='<!-- END design-language -->'
TMP_ROOT="$(mktemp -d)"
FAILURES=0
trap 'rm -rf "$TMP_ROOT"' EXIT

pass() {
  printf 'ok - %s\n' "$1"
}

fail() {
  printf 'not ok - %s\n' "$1" >&2
  FAILURES=$((FAILURES + 1))
}

assert_status() {
  EXPECTED_STATUS="$1"
  LABEL="$2"
  shift 2

  set +e
  "$@" > "$TMP_ROOT/command.out" 2> "$TMP_ROOT/command.err"
  ACTUAL_STATUS=$?
  set -e
  if [ "$ACTUAL_STATUS" -eq "$EXPECTED_STATUS" ]; then
    pass "$LABEL"
  else
    fail "$LABEL (expected status $EXPECTED_STATUS, got $ACTUAL_STATUS)"
  fi
}

assert_contains() {
  FILE="$1"
  TEXT="$2"
  LABEL="$3"
  if grep -qF "$TEXT" "$FILE"; then
    pass "$LABEL"
  else
    fail "$LABEL"
  fi
}

assert_not_contains() {
  FILE="$1"
  TEXT="$2"
  LABEL="$3"
  if grep -qF "$TEXT" "$FILE"; then
    fail "$LABEL"
  else
    pass "$LABEL"
  fi
}

assert_count() {
  FILE="$1"
  TEXT="$2"
  EXPECTED_COUNT="$3"
  LABEL="$4"
  if [ -f "$FILE" ]; then
    ACTUAL_COUNT="$(grep -cF "$TEXT" "$FILE" || true)"
  else
    ACTUAL_COUNT=0
  fi
  if [ "$ACTUAL_COUNT" -eq "$EXPECTED_COUNT" ]; then
    pass "$LABEL"
  else
    fail "$LABEL (expected $EXPECTED_COUNT, got $ACTUAL_COUNT)"
  fi
}

make_project() {
  PROJECT="$TMP_ROOT/$1"
  mkdir "$PROJECT"
  printf '%s\n' "$PROJECT"
}

LEGACY_PROJECT="$(make_project legacy)"
assert_status 0 "legacy syntax applies with explicit preset" bash "$DL_APPLY" "$LEGACY_PROJECT" editorial
assert_contains "$LEGACY_PROJECT/AGENTS.md" "# 设计语言（当前 preset: editorial" "legacy preset remains supported"
assert_contains "$LEGACY_PROJECT/AGENTS.md" "# STYLE_PREVIEW.md" "STYLE_PREVIEW remains default content"
assert_not_contains "$LEGACY_PROJECT/AGENTS.md" "## 可选模块:" "legacy call injects no optional modules"
DEFAULT_PROJECT="$(make_project default-dark)"
assert_status 0 "omitted preset defaults to dark" bash "$DL_APPLY" "$DEFAULT_PROJECT"
assert_contains "$DEFAULT_PROJECT/AGENTS.md" "preset: dark" "default dark is recorded in managed metadata"
assert_status 0 "legacy check uses default dark" bash "$DL_APPLY" --check "$DEFAULT_PROJECT"

EDITORIAL_PROJECT="$(make_project editorial-check-fallback)"
assert_status 0 "editorial fixture applies" bash "$DL_APPLY" "$EDITORIAL_PROJECT" editorial
ln "$EDITORIAL_PROJECT/AGENTS.md" "$EDITORIAL_PROJECT/inode-before-fallback"
assert_status 0 "check fallback uses the same editorial configuration" bash -c 'bash "$1" --check "$2" editorial || bash "$1" "$2" editorial' _ "$DL_APPLY" "$EDITORIAL_PROJECT"
if [ "$EDITORIAL_PROJECT/AGENTS.md" -ef "$EDITORIAL_PROJECT/inode-before-fallback" ]; then pass "matching check fallback does not rewrite editorial config"; else fail "matching check fallback does not rewrite editorial config"; fi

MODULE_PROJECT="$(make_project modules)"
assert_status 0 "options work before and after positionals" bash "$DL_APPLY" --modules=data-vis,ui-patterns "$MODULE_PROJECT" warm --modules motion,data-vis --modules=preferences
assert_contains "$MODULE_PROJECT/AGENTS.md" "modules: ui-patterns,motion,data-vis,preferences" "module IDs are deduplicated into registry order"
assert_count "$MODULE_PROJECT/AGENTS.md" "## 可选模块: ui-patterns" 1 "ui-patterns is rendered once"
assert_count "$MODULE_PROJECT/AGENTS.md" "## 可选模块: motion" 1 "motion is rendered once"
assert_count "$MODULE_PROJECT/AGENTS.md" "## 可选模块: data-vis" 1 "data-vis is rendered once"
assert_count "$MODULE_PROJECT/AGENTS.md" "## 可选模块: preferences" 1 "preferences is rendered once"
MODULE_ORDER="$(grep '^## 可选模块:' "$MODULE_PROJECT/AGENTS.md" | cut -d: -f2- | tr '\n' ',' || true)"
if [ "$MODULE_ORDER" = " ui-patterns, motion, data-vis, preferences," ]; then
  pass "modules render in canonical registry order"
else
  fail "modules render in canonical registry order"
fi

DELIMITER_PROJECT="$(make_project delimiter)"
assert_status 0 "double dash ends option parsing" bash "$DL_APPLY" --modules motion -- "$DELIMITER_PROJECT" brutalist
assert_contains "$DELIMITER_PROJECT/AGENTS.md" "preset: brutalist" "positionals after double dash are accepted"

DASH_PROJECT="$TMP_ROOT/-dash-project"
mkdir "$DASH_PROJECT"
assert_status 0 "double dash permits a dash-prefixed relative target" bash -c 'cd "$1" && bash "$2" -- "-dash-project"' _ "$TMP_ROOT" "$DL_APPLY"
assert_contains "$DASH_PROJECT/AGENTS.md" "preset: dark" "dash-prefixed target keeps the default preset"

assert_status 0 "strict check accepts exact block" bash "$DL_APPLY" --check --modules preferences,motion "$MODULE_PROJECT" warm --modules ui-patterns,data-vis
cp "$MODULE_PROJECT/AGENTS.md" "$MODULE_PROJECT/before-check"
ln "$MODULE_PROJECT/AGENTS.md" "$MODULE_PROJECT/inode-before-check"
chmod 640 "$MODULE_PROJECT/AGENTS.md"
assert_status 0 "exact check remains read-only" bash "$DL_APPLY" --check "$MODULE_PROJECT" warm --modules ui-patterns,motion,data-vis,preferences
if cmp -s "$MODULE_PROJECT/AGENTS.md" "$MODULE_PROJECT/before-check" && [ "$MODULE_PROJECT/AGENTS.md" -ef "$MODULE_PROJECT/inode-before-check" ] && [ "$(ls -ld "$MODULE_PROJECT/AGENTS.md" | cut -c1-10)" = "-rw-r-----" ]; then pass "check preserves bytes, inode, and mode"; else fail "check preserves bytes, inode, and mode"; fi
assert_status 2 "strict check detects preset mismatch" bash "$DL_APPLY" --check "$MODULE_PROJECT" dark --modules ui-patterns,motion,data-vis,preferences
assert_status 2 "strict check detects module mismatch" bash "$DL_APPLY" "$MODULE_PROJECT" --check warm --modules motion
printf '\nmanual drift\n' >> "$MODULE_PROJECT/AGENTS.md"
assert_status 0 "check ignores unmanaged suffix differences" bash "$DL_APPLY" --check "$MODULE_PROJECT" warm --modules preferences,data-vis,motion,ui-patterns
awk '{ if (!changed && index($0, "> 本区块由") == 1) { print "> drift"; changed=1 } print }' "$MODULE_PROJECT/AGENTS.md" > "$MODULE_PROJECT/drifted"
mv "$MODULE_PROJECT/drifted" "$MODULE_PROJECT/AGENTS.md"
assert_status 2 "strict check detects managed content drift" bash "$DL_APPLY" --check "$MODULE_PROJECT" warm --modules ui-patterns,motion,data-vis,preferences

NO_NEWLINE_PROJECT="$(make_project no-end-newline)"
assert_status 0 "fixture for end-newline strictness applies" bash "$DL_APPLY" "$NO_NEWLINE_PROJECT"
FILE_BYTES="$(wc -c < "$NO_NEWLINE_PROJECT/AGENTS.md" | tr -d ' ')"
dd if="$NO_NEWLINE_PROJECT/AGENTS.md" of="$NO_NEWLINE_PROJECT/without-newline" bs=1 count=$((FILE_BYTES - 1)) 2>/dev/null
mv "$NO_NEWLINE_PROJECT/without-newline" "$NO_NEWLINE_PROJECT/AGENTS.md"
assert_status 2 "strict check detects missing managed trailing newline" bash "$DL_APPLY" --check "$NO_NEWLINE_PROJECT"

MISSING_PROJECT="$(make_project missing)"
printf 'unmanaged\n' > "$MISSING_PROJECT/AGENTS.md"
assert_status 2 "check reports missing managed block" bash "$DL_APPLY" --check "$MISSING_PROJECT"

CRLF_PROJECT="$(make_project crlf-markers)"
printf 'prefix\r\n%s\r\nstale\r\n%s\r\nsuffix\r\n' "$BEGIN_MARK" "$END_MARK" > "$CRLF_PROJECT/AGENTS.md"
assert_status 0 "apply recognizes full-line CRLF markers" bash "$DL_APPLY" "$CRLF_PROJECT"
assert_count "$CRLF_PROJECT/AGENTS.md" "$BEGIN_MARK" 1 "CRLF replacement does not append a second block"

SYMLINK_PROJECT="$(make_project symlink)"
printf 'shared content\n' > "$SYMLINK_PROJECT/shared-agents.md"
ln -s shared-agents.md "$SYMLINK_PROJECT/AGENTS.md"
cp "$SYMLINK_PROJECT/shared-agents.md" "$SYMLINK_PROJECT/shared-before"
assert_status 1 "apply refuses a symlink AGENTS.md" bash "$DL_APPLY" "$SYMLINK_PROJECT"
if [ -L "$SYMLINK_PROJECT/AGENTS.md" ] && cmp -s "$SYMLINK_PROJECT/shared-agents.md" "$SYMLINK_PROJECT/shared-before"; then pass "symlink and target remain unchanged"; else fail "symlink and target remain unchanged"; fi

APPEND_PROJECT="$(make_project append-no-newline)"
printf 'unmanaged' > "$APPEND_PROJECT/AGENTS.md"
assert_status 0 "apply appends after content without final newline" bash "$DL_APPLY" "$APPEND_PROJECT"
EXPECTED_BOUNDARY="$(printf 'unmanaged\n%s\n' "$BEGIN_MARK")"
ACTUAL_BOUNDARY="$(head -n 2 "$APPEND_PROJECT/AGENTS.md")"
if [ "$ACTUAL_BOUNDARY" = "$EXPECTED_BOUNDARY" ]; then pass "append adds only the required line terminator"; else fail "append adds only the required line terminator"; fi

SAFE_PROJECT="$(make_project safe)"
printf 'prefix without normalization\n%s\nstale\n%s\nsuffix without normalization' "$BEGIN_MARK" "$END_MARK" > "$SAFE_PROJECT/AGENTS.md"
printf 'prefix without normalization\n' > "$SAFE_PROJECT/expected-prefix"
printf 'suffix without normalization' > "$SAFE_PROJECT/expected-suffix"
chmod 640 "$SAFE_PROJECT/AGENTS.md"
printf 'do not touch\n' > "$SAFE_PROJECT/other.txt"
cp "$SAFE_PROJECT/other.txt" "$SAFE_PROJECT/other-before"
assert_status 0 "apply replaces one valid managed block" bash "$DL_APPLY" --modules motion "$SAFE_PROJECT"
MODE_AFTER="$(ls -ld "$SAFE_PROJECT/AGENTS.md" | cut -c1-10)"
if [ "$MODE_AFTER" = "-rw-r-----" ]; then pass "existing AGENTS.md mode is preserved"; else fail "existing AGENTS.md mode is preserved"; fi
PREFIX_BYTES="$(wc -c < "$SAFE_PROJECT/expected-prefix" | tr -d ' ')"
SUFFIX_BYTES="$(wc -c < "$SAFE_PROJECT/expected-suffix" | tr -d ' ')"
head -c "$PREFIX_BYTES" "$SAFE_PROJECT/AGENTS.md" > "$SAFE_PROJECT/actual-prefix"
tail -c "$SUFFIX_BYTES" "$SAFE_PROJECT/AGENTS.md" > "$SAFE_PROJECT/actual-suffix"
if cmp -s "$SAFE_PROJECT/expected-prefix" "$SAFE_PROJECT/actual-prefix"; then pass "unmanaged prefix bytes are preserved"; else fail "unmanaged prefix bytes are preserved"; fi
if cmp -s "$SAFE_PROJECT/expected-suffix" "$SAFE_PROJECT/actual-suffix"; then pass "unmanaged suffix bytes are preserved"; else fail "unmanaged suffix bytes are preserved"; fi
if cmp -s "$SAFE_PROJECT/other.txt" "$SAFE_PROJECT/other-before"; then pass "only AGENTS.md is modified"; else fail "only AGENTS.md is modified"; fi
cp "$SAFE_PROJECT/AGENTS.md" "$SAFE_PROJECT/agents-content-before-second-apply"
ln "$SAFE_PROJECT/AGENTS.md" "$SAFE_PROJECT/agents-before-second-apply"
assert_status 0 "second identical apply succeeds" bash "$DL_APPLY" "$SAFE_PROJECT" --modules=motion
if cmp -s "$SAFE_PROJECT/AGENTS.md" "$SAFE_PROJECT/agents-content-before-second-apply"; then pass "second apply is byte-idempotent"; else fail "second apply is byte-idempotent"; fi
if [ "$SAFE_PROJECT/AGENTS.md" -ef "$SAFE_PROJECT/agents-before-second-apply" ]; then pass "identical apply does not rewrite AGENTS.md"; else fail "identical apply does not rewrite AGENTS.md"; fi

PREFERENCES_PROJECT="$(make_project preferences-persistence)"
printf 'Preference: 保留这个项目级记录\n' > "$PREFERENCES_PROJECT/DESIGN_PREFERENCES.md"
cp "$PREFERENCES_PROJECT/DESIGN_PREFERENCES.md" "$PREFERENCES_PROJECT/preferences-before"
assert_status 0 "preferences module applies without owning project records" bash "$DL_APPLY" "$PREFERENCES_PROJECT" editorial --modules preferences
assert_status 0 "subsequent apply can remove module guidance" bash "$DL_APPLY" "$PREFERENCES_PROJECT" editorial
if cmp -s "$PREFERENCES_PROJECT/DESIGN_PREFERENCES.md" "$PREFERENCES_PROJECT/preferences-before"; then pass "project preference records survive managed-block refresh"; else fail "project preference records survive managed-block refresh"; fi

assert_malformed() {
  NAME="$1"
  CONTENT="$2"
  PROJECT="$(make_project "malformed-$NAME")"
  printf '%b' "$CONTENT" > "$PROJECT/AGENTS.md"
  cp "$PROJECT/AGENTS.md" "$PROJECT/original"
  assert_status 1 "apply rejects malformed markers: $NAME" bash "$DL_APPLY" "$PROJECT"
  if cmp -s "$PROJECT/AGENTS.md" "$PROJECT/original"; then pass "malformed target remains unchanged: $NAME"; else fail "malformed target remains unchanged: $NAME"; fi
  assert_status 1 "check rejects malformed markers: $NAME" bash "$DL_APPLY" --check "$PROJECT"
}

assert_malformed "orphan-begin" "$BEGIN_MARK\n"
assert_malformed "orphan-end" "$END_MARK\n"
assert_malformed "reversed" "$END_MARK\n$BEGIN_MARK\n"
assert_malformed "duplicate-begin" "$BEGIN_MARK\n$BEGIN_MARK\n$END_MARK\n"
assert_malformed "duplicate-end" "$BEGIN_MARK\n$END_MARK\n$END_MARK\n"
assert_malformed "crlf-orphan-begin" "$BEGIN_MARK\r\n"
assert_malformed "indented-begin" "  $BEGIN_MARK\n"
assert_malformed "trailing-space-end" "$END_MARK \n"
assert_malformed "lowercase-markers" "<!-- begin design-language (dl-apply, 勿手改本区块) -->\nstale\n<!-- end design-language -->\n"
assert_malformed "mixed-case-marker" "<!-- Begin Design-Language (dl-apply, 勿手改本区块) -->\n"
assert_malformed "no-space-marker" "<!--BEGIN design-language (dl-apply, 勿手改本区块) -->\n"
assert_malformed "tight-begin-marker" "<!--BEGINdesign-language (dl-apply, 勿手改本区块) -->\n"
assert_malformed "tight-end-marker" "<!--ENDdesign-language-->\n"
assert_malformed "tight-mixed-case-marker" "<!--BeginDesign-Language (dl-apply, 勿手改本区块) -->\n"

INVALID_PROJECT="$(make_project invalid)"
printf 'unchanged\n' > "$INVALID_PROJECT/AGENTS.md"
cp "$INVALID_PROJECT/AGENTS.md" "$INVALID_PROJECT/original"
assert_status 1 "unknown option is a usage error" bash "$DL_APPLY" "$INVALID_PROJECT" --unknown
assert_status 1 "unknown module is a usage error" bash "$DL_APPLY" --modules motion,unknown "$INVALID_PROJECT"
assert_status 1 "missing modules value is a usage error" bash "$DL_APPLY" "$INVALID_PROJECT" --modules
assert_status 1 "empty equals-form modules value is a usage error" bash "$DL_APPLY" "$INVALID_PROJECT" --modules=
assert_status 1 "empty separate modules value is a usage error" bash "$DL_APPLY" "$INVALID_PROJECT" --modules ""
if cmp -s "$INVALID_PROJECT/AGENTS.md" "$INVALID_PROJECT/original"; then pass "usage errors do not modify target"; else fail "usage errors do not modify target"; fi

[ "$FAILURES" -eq 0 ] || exit 1
printf 'test-dl-apply: passed\n'
