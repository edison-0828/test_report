#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${1:-/opt/test-report}"
SERVICE_NAME="${2:-test-report}"
SERVICE_TEMPLATE="$APP_DIR/ops/test-report.service"
SERVICE_TARGET="/etc/systemd/system/${SERVICE_NAME}.service"

if ! command -v systemctl >/dev/null 2>&1; then
  echo "systemctl 不可用，当前系统无法安装 systemd 服务。"
  exit 1
fi

if [ ! -f "$SERVICE_TEMPLATE" ]; then
  echo "未找到服务模板: $SERVICE_TEMPLATE"
  exit 1
fi

NODE_BIN="$(command -v node || true)"
if [ -z "$NODE_BIN" ]; then
  echo "未找到 node，请先安装 Node.js。"
  exit 1
fi

sed \
  -e "s|__APP_DIR__|$APP_DIR|g" \
  -e "s|__NODE_BIN__|$NODE_BIN|g" \
  "$SERVICE_TEMPLATE" > "$SERVICE_TARGET"

systemctl daemon-reload
systemctl enable "$SERVICE_NAME"
systemctl restart "$SERVICE_NAME"

echo "systemd 服务已安装并启动: $SERVICE_NAME"
systemctl status "$SERVICE_NAME" --no-pager || true
