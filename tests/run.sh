#!/usr/bin/env bash
set -euo pipefail

TEST_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

bash "$TEST_DIR/test-doc-sync.sh"
bash "$TEST_DIR/test-dl-apply.sh"

printf 'tests: all passed\n'
