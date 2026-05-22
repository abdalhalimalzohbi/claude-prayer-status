#!/bin/sh
# Convenience installer for adhanline.
set -e

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required (Node.js >= 18). Install Node first." >&2
  exit 1
fi

echo "Installing adhanline globally…"
npm install -g adhanline

echo "Wiring it into Claude Code…"
adhanline install

echo "Done. Restart Claude Code to see the prayer line."
