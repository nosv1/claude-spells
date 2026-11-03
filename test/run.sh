#!/usr/bin/env bash
# Headless smoke test: builds a copy of index.html with test/smoke.js appended,
# runs it in Edge (or Chrome), and prints the PASS/FAIL lines.
set -euo pipefail
cd "$(dirname "$0")/.."

BROWSER="${BROWSER:-/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe}"
PAGE="smoke-test.html"
trap 'rm -f "$PAGE"' EXIT

sed 's|</body>|<pre id="out">RUNNING</pre><script src="test/smoke.js"></script></body>|' index.html > "$PAGE"

"$BROWSER" --headless=new --disable-gpu --virtual-time-budget=3000 --dump-dom \
  "file:///$(pwd -W 2>/dev/null || pwd)/$PAGE" 2>/dev/null \
  | sed -n '/<pre id="out">/,/<\/pre>/p' | sed 's/<[^>]*>//g'
