#!/usr/bin/env bash
# 新手上手站 · 卸载：只删除 install.sh 新增的东西，不碰其他服务
#   bash uninstall.sh            卸载程序，保留数据库（/var/lib/tutorial-site）
#   bash uninstall.sh --purge    连数据库和系统用户一起删除
set -euo pipefail

APP=tutorial-site
PREFIX=/opt/$APP
DATA=/var/lib/$APP
ENV_FILE=/etc/$APP.env
UNIT=/etc/systemd/system/$APP.service
PURGE=0
[ "${1:-}" = "--purge" ] && PURGE=1

[ "$(id -u)" -eq 0 ] || { echo "请用 root 运行"; exit 1; }

PORT=$(sed -n 's/^PORT=//p' "$ENV_FILE" 2>/dev/null || true)

systemctl disable --now "$APP" >/dev/null 2>&1 || true
rm -f "$UNIT"
systemctl daemon-reload

if [ -n "$PORT" ]; then
  if command -v ufw >/dev/null && ufw status 2>/dev/null | grep -q "Status: active"; then
    ufw delete allow "$PORT/tcp" >/dev/null 2>&1 || true
  elif command -v firewall-cmd >/dev/null && firewall-cmd --state >/dev/null 2>&1; then
    firewall-cmd --quiet --permanent --remove-port="$PORT/tcp" 2>/dev/null && firewall-cmd --quiet --reload || true
  fi
fi

# 本脚本可能就在 $PREFIX 里；删除后 bash 仍能继续执行完已打开的脚本
rm -rf "$PREFIX" "/usr/local/bin/$APP" "$ENV_FILE"

if [ "$PURGE" -eq 1 ]; then
  rm -rf "$DATA"
  userdel "$APP" 2>/dev/null || true
  echo "✓ 已完全卸载（包括数据库）"
else
  echo "✓ 已卸载程序。数据库保留在 $DATA，重新安装会自动沿用；彻底删除请加 --purge"
fi
