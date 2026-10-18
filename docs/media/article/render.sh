#!/usr/bin/env bash
# Renders each src/fig-*.html to a 2400x1350 PNG next to this script.
# Usage: ./render.sh [fig-name ...]   (defaults to every figure)
set -euo pipefail
cd "$(dirname "$0")"

port=8765
python3 -m http.server "$port" --directory src >/dev/null 2>&1 &
server=$!
trap 'kill $server' EXIT
sleep 0.5

names=("$@")
if [ ${#names[@]} -eq 0 ]; then
	for f in src/fig-*.html; do names+=("$(basename "$f" .html)"); done
fi

for name in "${names[@]}"; do
	out="${name#fig-}.png"
	google-chrome --headless=new --disable-gpu --hide-scrollbars \
		--window-size=1600,900 --force-device-scale-factor=1.5 \
		--virtual-time-budget=3000 \
		--screenshot="$PWD/$out" "http://localhost:$port/$name.html" 2>/dev/null
	echo "$out"
done
