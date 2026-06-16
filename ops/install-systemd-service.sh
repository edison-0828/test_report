#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${1:-/opt/test-report}"
SERVICE_NAME="${2:-test-report}"
DATA_DIR="${3:-/var/lib/test-report}"
SERVICE_TEMPLATE="$APP_DIR/ops/test-report.service"
SERVICE_TARGET="/etc/systemd/system/${SERVICE_NAME}.service"

if ! command -v systemctl >/dev/null 2>&1; then
  echo "systemctl unavailable, cannot install systemd service."
  exit 1
fi

if [ ! -f "$SERVICE_TEMPLATE" ]; then
  echo "Service template not found: $SERVICE_TEMPLATE"
  exit 1
fi

NODE_BIN="$(command -v node || true)"
if [ -z "$NODE_BIN" ]; then
  echo "Node.js not found. Please install Node.js first."
  exit 1
fi

mkdir -p "$DATA_DIR"

if [ -f "$APP_DIR/app-state.json" ] && [ ! -f "$DATA_DIR/app-state.json" ]; then
  cp "$APP_DIR/app-state.json" "$DATA_DIR/app-state.json"
fi

if [ -f "$APP_DIR/team-members.json" ] && [ ! -f "$DATA_DIR/team-members.json" ]; then
  cp "$APP_DIR/team-members.json" "$DATA_DIR/team-members.json"
fi

sed \
  -e "s|__APP_DIR__|$APP_DIR|g" \
  -e "s|__NODE_BIN__|$NODE_BIN|g" \
  -e "s|__DATA_DIR__|$DATA_DIR|g" \
  "$SERVICE_TEMPLATE" > "$SERVICE_TARGET"

systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl restart "$SERVICE_NAME"

echo "systemd service installed and started: $SERVICE_NAME"
systemctl status "$SERVICE_NAME" --no-pager || true
