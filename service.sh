#!/bin/bash
# 🧩 Mollage — webbservern som launchd-tjänst (startar vid inloggning, startas om om den dör).
#
#   bash service.sh install     Kopiera plist + ladda (startar direkt)
#   bash service.sh uninstall   Stoppa + ta bort tjänsten
#   bash service.sh status      Visa om tjänsten kör och svarar
#   bash service.sh restart     Starta om processen (efter ny serverkod)
#   bash service.sh reload      Kopiera plist på nytt + ladda om (efter plist-ändring)
#   bash service.sh logs        Visa slutet av loggen
set -euo pipefail

cd "$(dirname "$0")"

LABEL="com.user.mollage"
PLIST="${LABEL}.plist"
DEST="$HOME/Library/LaunchAgents/${PLIST}"
DOMAIN="gui/$(id -u)"
PORT="${PORT:-80}"

usage() {
  cat <<EOF
🧩 Mollage — webbtjänst

Användning: bash service.sh <kommando>

  install     Kopiera plist till LaunchAgents och starta tjänsten
  uninstall   Stoppa tjänsten och ta bort plist från LaunchAgents
  status      Visa om tjänsten kör och svarar på port ${PORT}
  restart     Starta om processen (efter ny serverkod)
  reload      Kopiera plist på nytt och ladda om (efter plist-ändring)
  logs        Visa de senaste raderna i logs/server.log
EOF
}

load_job() {
  mkdir -p logs "$HOME/Library/LaunchAgents"
  cp "$PLIST" "$DEST"
  launchctl bootout "${DOMAIN}/${LABEL}" 2>/dev/null || true
  if ! launchctl bootstrap "$DOMAIN" "$DEST" 2>/dev/null; then
    launchctl unload "$DEST" 2>/dev/null || true
    launchctl load -w "$DEST"
  fi
}

is_loaded() {
  launchctl list 2>/dev/null | grep -q "$LABEL"
}

responds() {
  curl -fsS -o /dev/null --max-time 3 "http://127.0.0.1:${PORT}/"
}

case "${1:-}" in
  install|reload)
    [ -f "$PLIST" ] || { echo "❌ Hittar inte $PLIST i $(pwd)"; exit 1; }
    load_job
    sleep 1
    if responds; then
      echo "✅ Mollage kör: http://mollage.local  (eller http://$(scutil --get LocalHostName).local)"
    else
      echo "⚠️  Tjänsten är laddad men svarar inte än — kolla: bash service.sh logs"
    fi
    ;;
  uninstall|remove)
    launchctl bootout "${DOMAIN}/${LABEL}" 2>/dev/null || launchctl unload "$DEST" 2>/dev/null || true
    rm -f "$DEST"
    echo "🗑️  Tjänsten ${LABEL} är stoppad och borttagen."
    ;;
  restart)
    is_loaded || { echo "❌ Tjänsten är inte laddad. Kör först: bash service.sh install"; exit 1; }
    launchctl kickstart -k "${DOMAIN}/${LABEL}"
    sleep 1
    if responds; then echo "🔄 Omstartad och svarar."; else echo "⚠️  Omstartad men svarar inte — kolla: bash service.sh logs"; fi
    ;;
  status)
    if is_loaded; then
      echo "✅ Laddad (PID · senaste exitstatus · namn):"
      launchctl list | grep "$LABEL" || true
      if responds; then echo "🌐 Svarar på port ${PORT}."; else echo "⚠️  Svarar INTE på port ${PORT}."; fi
    else
      echo "❌ Inte laddad. Kör: bash service.sh install"
    fi
    ;;
  logs)
    tail -n 40 logs/server.log 2>/dev/null || echo "ℹ️  Ingen logg än."
    ;;
  ""|-h|--help|help)
    usage
    ;;
  *)
    echo "Okänt kommando: ${1}" >&2
    echo >&2
    usage >&2
    exit 1
    ;;
esac
