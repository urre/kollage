#!/bin/bash
# 🚀 Mollage — bygg och deploya till servern.
#
#   bash deploy.sh --dry-run   Bygg och visa vad som skulle skickas — ändrar ingenting på servern
#   bash deploy.sh             Bygg, synka till servern och starta om tjänsten
#
# Appen byggs HÄR (npm run build) och bara resultatet skickas: dist/ plus den
# lilla Node-servern. Servern behöver alltså varken npm eller node_modules,
# bara node (via nvm).
#
# Servern kör projektet från en ANNAN absolut sökväg än den här maskinen.
# Plisten innehåller hårdkodade sökvägar, så den skrivs om (sed) innan den
# kopieras — kopiera den ALDRIG rakt av. Se CLAUDE.md ("Sökvägsfällan").
set -euo pipefail

cd "$(dirname "$0")"

SERVER="urbansanden@Roon-server-Mac.local"
REMOTE_DIR="/Users/urbansanden/agents/mollage"
LOCAL_DIR="$(pwd)"
PLIST="com.user.mollage.plist"

DRY=0
if [ "${1:-}" = "--dry-run" ]; then
  DRY=1
  echo "🔍 Torrkörning — ingenting skickas."
fi

# 1) Bygg. Typfel stoppar deployen.
echo "🔨 Bygger..."
npm run build --silent

RSYNC_FLAGS=(-avc --itemize-changes --exclude '.DS_Store')
[ "$DRY" = 1 ] && RSYNC_FLAGS+=(--dry-run)

if [ "$DRY" = 0 ]; then
  ssh "$SERVER" "mkdir -p '${REMOTE_DIR}/logs'"
elif ! ssh "$SERVER" "test -d '${REMOTE_DIR}'"; then
  echo "🆕 ${REMOTE_DIR} finns inte på servern än — första deployen skickar allt och installerar tjänsten."
  exit 0
fi

# 2) dist/ speglas exakt (--delete) så gamla hashade assets försvinner.
echo "📦 Synkar dist/ → ${SERVER}:${REMOTE_DIR}/dist/"
rsync "${RSYNC_FLAGS[@]}" --delete dist/ "${SERVER}:${REMOTE_DIR}/dist/"

# 3) Serverkoden och skripten. Aldrig plisten (steg 4), logs/ eller .claude/.
echo "📦 Synkar server/, run.sh, service.sh"
rsync "${RSYNC_FLAGS[@]}" server run.sh service.sh "${SERVER}:${REMOTE_DIR}/"

# 4) Plisten: skriv om de lokala sökvägarna till serverns innan jämförelse.
TMP_PLIST="$(mktemp)"
trap 'rm -f "$TMP_PLIST"' EXIT
sed "s|${LOCAL_DIR}|${REMOTE_DIR}|g" "$PLIST" > "$TMP_PLIST"

if grep -q "$LOCAL_DIR" "$TMP_PLIST"; then
  echo "❌ Plisten innehåller fortfarande lokala sökvägar efter omskrivning — avbryter."
  exit 1
fi

if ssh "$SERVER" "diff -q '${REMOTE_DIR}/${PLIST}' -" < "$TMP_PLIST" >/dev/null 2>&1; then
  PLIST_CHANGED=0
  echo "⏱️  Plisten är oförändrad."
else
  PLIST_CHANGED=1
  echo "⏱️  Plisten är ny eller ändrad."
fi

if [ "$DRY" = 1 ]; then
  echo
  if [ "$PLIST_CHANGED" = 1 ]; then
    echo "Vid skarp deploy: plisten kopieras (med omskrivna sökvägar) och 'service.sh reload' körs."
  else
    echo "Vid skarp deploy: 'service.sh restart' körs på servern."
  fi
  exit 0
fi

# 5) Starta om. Statiska filer läses från disk per request, men serverkoden
# kan ha ändrats — en omstart tar under en sekund.
if [ "$PLIST_CHANGED" = 1 ]; then
  scp -q "$TMP_PLIST" "${SERVER}:${REMOTE_DIR}/${PLIST}"
  ssh "$SERVER" "cd '${REMOTE_DIR}' && bash service.sh reload"
else
  ssh "$SERVER" "cd '${REMOTE_DIR}' && bash service.sh restart"
fi

# 6) Hälsokoll härifrån, via båda namnen.
echo "🩺 Svarar den på nätverket?"
sleep 1
for url in "http://mollage.local/" "http://Roon-server-Mac.local/"; do
  if curl -fsS -o /dev/null --max-time 5 "$url"; then
    echo "   ✅ $url"
  else
    echo "   ⚠️  $url svarar inte (mDNS kan ta några sekunder — prova igen)"
  fi
done
