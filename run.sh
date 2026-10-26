#!/bin/bash
# 🧩 Mollage — startar webbservern. Körs av launchd (KeepAlive) på servern.
#
#   bash run.sh                 # port 80, publicerar http://mollage.local
#   PORT=8080 bash run.sh       # annan port (t.ex. för att testa lokalt)

cd "$(dirname "$0")" || exit 1

# launchd kör med minimal PATH och hittar inte nvm-installerad node.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

set -euo pipefail

[ -f dist/index.html ] || { echo "❌ dist/index.html saknas — kör deploy.sh (som bygger) först." >&2; exit 1; }

exec node server/serve.mjs
