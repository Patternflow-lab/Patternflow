#!/usr/bin/env bash
# Makes every case model again: web/public/cases/<case>/model.glb.
#
#   tools/case-models/build.sh            # all three
#   tools/case-models/build.sh official   # one
#
# Needs `npm ci` here and the Python packages in requirements.txt (set PYTHON
# to the interpreter that has them; it defaults to .venv/bin/python, then
# python3). See README.md.
set -euo pipefail
cd "$(dirname "$0")"

PYTHON="${PYTHON:-}"
if [[ -z "$PYTHON" ]]; then
  if [[ -x .venv/bin/python ]]; then PYTHON=.venv/bin/python; else PYTHON=python3; fi
fi

cases=("$@")
if [[ ${#cases[@]} -eq 0 ]]; then cases=(official besoiobiy-printed simonepda-lasercut); fi

for id in "${cases[@]}"; do
  echo "== $id"
  case "$id" in
    official)
      node assemble.mjs official
      ;;
    besoiobiy-printed)
      "$PYTHON" besoiobiy.py
      node assemble.mjs besoiobiy-printed build/besoiobiy-printed/shell.glb build/besoiobiy-printed/placement.json
      ;;
    simonepda-lasercut)
      "$PYTHON" simonepda.py
      node assemble.mjs simonepda-lasercut build/simonepda-lasercut/shell.glb build/simonepda-lasercut/placement.json
      ;;
    *)
      echo "unknown case: $id (official, besoiobiy-printed, simonepda-lasercut)" >&2
      exit 1
      ;;
  esac
done
