#!/usr/bin/env bash
set -euo pipefail

TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REQUIRED_CHROME_VERSION="144.0.7559.109"

if [[ -z "${CHROME_PATH:-}" ]]; then
  if [[ -x /usr/bin/google-chrome ]]; then
    export CHROME_PATH=/usr/bin/google-chrome
  else
    printf 'tests: CHROME_PATH must name Chrome %s\n' "$REQUIRED_CHROME_VERSION" >&2
    exit 1
  fi
fi
if [[ ! -x "$CHROME_PATH" ]]; then
  printf 'tests: CHROME_PATH is not executable: %s\n' "$CHROME_PATH" >&2
  exit 1
fi
chrome_version="$("$CHROME_PATH" --version)"
chrome_version="${chrome_version#"${chrome_version%%[![:space:]]*}"}"
chrome_version="${chrome_version%"${chrome_version##*[![:space:]]}"}"
case "$chrome_version" in
  "Google Chrome $REQUIRED_CHROME_VERSION"|"Google Chrome for Testing $REQUIRED_CHROME_VERSION") ;;
  *)
    printf 'tests: expected Chrome %s at CHROME_PATH\n' "$REQUIRED_CHROME_VERSION" >&2
    exit 1
    ;;
esac

bash "$TEST_DIR/test-doc-sync.sh"
bash "$TEST_DIR/test-dl-apply.sh"
node --test "$TEST_DIR"/dl-preview-*.test.mjs

printf 'tests: all passed\n'
