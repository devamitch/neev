#!/usr/bin/env bash
# Wires this clone to the committed hooks in .githooks/. Idempotent; safe to re-run.
#
#   pnpm setup:hooks
#
set -eu

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [ ! -d .githooks ]; then
  exit 0
fi

if [ ! -d .git ]; then
  # In CI / EAS build tarball environments, .git does not exist.
  exit 0
fi

git config core.hooksPath .githooks || true
chmod +x .githooks/* || true
for h in .githooks/*; do
  [ -f "$h" ] && sh -n "$h" || true
done
echo "core.hooksPath = $(git config --get core.hooksPath 2>/dev/null || echo '.githooks')"
