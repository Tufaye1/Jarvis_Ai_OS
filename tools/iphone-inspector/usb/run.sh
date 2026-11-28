#!/usr/bin/env bash
# One-time setup + start. Usage: ./run.sh        (real phone)
#                                 ./run.sh --demo (fake data)
set -euo pipefail
cd "$(dirname "$0")"
if [ ! -d .venv ]; then
  echo "First run: creating Python environment and installing pymobiledevice3 (needs internet once)..."
  python3 -m venv .venv
  ./.venv/bin/pip install --quiet --upgrade pip
  ./.venv/bin/pip install --quiet "pymobiledevice3>=11,<12"
fi
exec ./.venv/bin/python3 inspect_server.py "$@"
