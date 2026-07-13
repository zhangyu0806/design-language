#!/usr/bin/env bash

MODULE_REGISTRY="ui-patterns:UI_PATTERNS.md motion:MOTION.md data-vis:DATA_VIS.md preferences:PREFERENCES.md"
MODULES_LIST=""

for MODULE_ENTRY in $MODULE_REGISTRY; do
  MODULE_ID="${MODULE_ENTRY%%:*}"
  MODULES_LIST="${MODULES_LIST:+$MODULES_LIST }$MODULE_ID"
done

module_file() {
  for MODULE_ENTRY in $MODULE_REGISTRY; do
    [ "${MODULE_ENTRY%%:*}" = "$1" ] || continue
    printf '%s/references/%s\n' "$DL_ROOT" "${MODULE_ENTRY#*:}"
    return 0
  done
  return 1
}
