#!/usr/bin/env bash
# =============================================================================
# 新手上手站 · 服务器一键安装 / 更新
#
#   curl -fsSLO https://raw.githubusercontent.com/yanglei-985/table/refs/heads/claude/relaxed-rubin-encwsr/deploy/install.sh
#   sudo bash install.sh
#
# 不打扰已有服务：
#   - 只新增自己的东西：/opt/tutorial-site（程序）、/var/lib/tutorial-site（数据库）、
#     /etc/tutorial-site.env（配置）、systemd 服务 tutorial-site、系统用户 tutorial-site、
#     命令 /usr/local/bin/tutorial-site
#   - 自带独立的 Node.js（放在 /opt/tutorial-site 里），不安装、不升级系统的 Node / npm
#   - 不修改 Nginx / Apache / Caddy / Docker 等已有配置；自动选一个空闲端口
#   - 防火墙（ufw / firewalld）启用时只“新增放行”这个端口，不改其他规则
#
# 再次运行就是更新：先备份数据库，新版本启动成功后才切换，失败自动回到旧版本。
# 可选环境变量：PORT、BRANCH、PUBLIC_URL、HOST、NODE_MIRROR、NPM_REGISTRY、SOURCE_TARBALL
# =============================================================================
set -euo pipefail
umask 022   # 程序文件要让服务用户能读

APP=tutorial-site
REPO=yanglei-985/table
BRANCH=${BRANCH:-claude/relaxed-rubin-encwsr}
PREFIX=/opt/$APP
DATA=/var/lib/$APP
ENV_FILE=/etc/$APP.env
UNIT=/etc/systemd/system/$APP.service
CLI=/usr/local/bin/$APP
NODE_MAJOR=22
NODE_MIRROR=${NODE_MIRROR:-https://nodejs.org/dist}
NPM_REGISTRY=${NPM_REGISTRY:-https://registry.npmjs.org}
KEEP_RELEASES=3

say()  { printf '\033[1;36m==>\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m ✓\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m !\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m ✗ %s\033[0m\n' "$*" >&2; exit 1; }

# ----------------------------------------------------------------------------- 0. 环境检查
[ "$(id -u)" -eq 0 ] || die "请用 root 运行：sudo bash install.sh"
command -v systemctl >/dev/null || die "需要 systemd（Ubuntu / Debian / CentOS 等常见系统都有）"
for cmd in curl tar ss; do command -v "$cmd" >/dev/null || die "缺少命令 $cmd，请先安装"; done

case "$(uname -m)" in
  x86_64 | amd64) NODE_ARCH=x64 ;;
  aarch64 | arm64) NODE_ARCH=arm64 ;;
  *) die "不支持的 CPU 架构：$(uname -m)" ;;
esac

FRESH=1
[ -f "$UNIT" ] && FRESH=0

# ----------------------------------------------------------------------------- 1. 只读检查：看看服务器上已有什么
say "检查服务器现状（只读，不做任何修改）"
. /etc/os-release 2>/dev/null && ok "系统：${PRETTY_NAME:-未知}，架构 $(uname -m)"
MEM_MB=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
SWAP_MB=$(awk '/SwapTotal/ {print int($2/1024)}' /proc/meminfo)
ok "内存 ${MEM_MB}MB，交换分区 ${SWAP_MB}MB，/opt 剩余 $(df -h /opt | awk 'NR==2 {print $4}')"
echo "    正在监听的端口（这些都不会被改动）："
ss -ltnH 2>/dev/null | awk '{print $4}' | sed 's/.*://' | sort -n | uniq | tr '\n' ' ' | sed 's/^/      /'
echo
for svc in nginx apache2 httpd caddy docker; do
  if systemctl is-active --quiet "$svc" 2>/dev/null; then ok "发现正在运行的 $svc —— 不会修改它的任何配置"; fi
done
if [ $((MEM_MB + SWAP_MB)) -lt 900 ]; then
  warn "内存加交换分区不足 1GB，构建时可能内存不够。如果失败，可以先添加交换分区再重试。"
fi

# ----------------------------------------------------------------------------- 2. 端口
port_in_use() { ss -ltnH "( sport = :$1 )" 2>/dev/null | grep -q .; }

if [ "$FRESH" -eq 0 ] && [ -f "$ENV_FILE" ]; then
  PORT=$(sed -n 's/^PORT=//p' "$ENV_FILE")
  ok "已安装过，沿用端口 $PORT"
else
  if [ -n "${PORT:-}" ]; then
    port_in_use "$PORT" && die "端口 $PORT 已被其他服务占用，请换一个：PORT=xxxx bash install.sh"
  else
    for p in $(seq 4321 4399); do
      if ! port_in_use "$p"; then PORT=$p; break; fi
    done
    [ -n "${PORT:-}" ] || die "4321–4399 之间没有空闲端口，请手动指定：PORT=xxxx bash install.sh"
  fi
  ok "使用空闲端口 $PORT"
fi

# ----------------------------------------------------------------------------- 3. 独立的 Node.js
mkdir -p "$PREFIX/releases"
say "准备独立的 Node.js $NODE_MAJOR（装在 $PREFIX 里，不影响系统）"
INDEX=$(curl -fsSL "$NODE_MIRROR/index.json") || die "无法获取 Node.js 版本列表（$NODE_MIRROR），可设置 NODE_MIRROR=https://npmmirror.com/mirrors/node 重试"
NODE_VERSION=$(printf '%s' "$INDEX" | grep -o "\"version\":\"v$NODE_MAJOR\.[0-9]*\.[0-9]*\"" | sed -n 1p | cut -d'"' -f4 || true)
[ -n "$NODE_VERSION" ] || die "无法获取 Node.js 版本列表（$NODE_MIRROR），可设置 NODE_MIRROR=https://npmmirror.com/mirrors/node 重试"
NODE_DIR="$PREFIX/node-$NODE_VERSION"
if [ ! -x "$NODE_DIR/bin/node" ]; then
  tmp=$(mktemp -d)
  curl -fsSL "$NODE_MIRROR/$NODE_VERSION/node-$NODE_VERSION-linux-$NODE_ARCH.tar.gz" -o "$tmp/node.tgz"
  mkdir -p "$NODE_DIR"
  tar -xzf "$tmp/node.tgz" -C "$NODE_DIR" --strip-components=1
  rm -rf "$tmp"
fi
ln -sfn "$NODE_DIR" "$PREFIX/node"
NODE="$PREFIX/node/bin/node"
NPM="$PREFIX/node/bin/npm"
ok "Node.js $("$NODE" -v)"

# ----------------------------------------------------------------------------- 4. 下载代码并构建
RELEASE="$PREFIX/releases/$(date +%Y%m%d-%H%M%S)"
say "下载网站代码（$REPO · $BRANCH）并构建，需要一两分钟"
mkdir -p "$RELEASE"
if [ -n "${SOURCE_TARBALL:-}" ]; then
  tar -xzf "$SOURCE_TARBALL" -C "$RELEASE" --strip-components=1
else
  curl -fsSL "https://codeload.github.com/$REPO/tar.gz/refs/heads/$BRANCH" | tar -xz -C "$RELEASE" --strip-components=1
fi
(
  cd "$RELEASE"
  export PATH="$PREFIX/node/bin:$PATH" PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm_config_update_notifier=false npm_config_fund=false npm_config_audit=false
  "$NPM" ci --registry "$NPM_REGISTRY" --no-progress --loglevel=error
  "$NPM" run build --silent
  "$NPM" prune --omit=dev --loglevel=error
) > "$RELEASE.build.log" 2>&1 || { tail -30 "$RELEASE.build.log"; rm -rf "$RELEASE"; die "构建失败，完整日志：$RELEASE.build.log"; }
rm -f "$RELEASE.build.log"
ok "构建完成：$RELEASE"

# ----------------------------------------------------------------------------- 5. 专用用户、数据目录、配置
if ! id "$APP" >/dev/null 2>&1; then
  useradd --system --home-dir "$DATA" --no-create-home --shell /usr/sbin/nologin "$APP" 2>/dev/null ||
    useradd --system --home-dir "$DATA" --no-create-home --shell /sbin/nologin "$APP"
  ok "创建系统用户 $APP（不能登录，只用来运行网站）"
fi
mkdir -p "$DATA/backups"
chown -R "$APP:$APP" "$DATA"
chmod 750 "$DATA"

if [ ! -f "$ENV_FILE" ]; then
  if [ -z "${PUBLIC_URL:-}" ]; then
    IP=$(curl -fsS --max-time 5 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')
    PUBLIC_URL="http://$IP:$PORT"
  fi
  cat > "$ENV_FILE" <<EOF
# 新手上手站的配置；修改后执行 systemctl restart $APP
PORT=$PORT
HOST=${HOST:-0.0.0.0}
DATA_DIR=$DATA
# 网站对外地址，用来生成邀请链接；以后绑定域名后改成 https://你的域名
PUBLIC_URL=$PUBLIC_URL
# 放在 Nginx 等反向代理后面时改成 1
TRUST_PROXY=0
NODE_ENV=production
EOF
  chmod 600 "$ENV_FILE"
  ok "写入配置 $ENV_FILE"
fi

# 管理命令：tutorial-site admin list / backup / password ...
cat > "$CLI" <<EOF
#!/usr/bin/env bash
# 新手上手站的管理命令（由 install.sh 生成）
set -e
case "\${1:-}" in
  admin)  shift; cd $PREFIX/current && exec runuser -u $APP -- env DATA_DIR=$DATA $PREFIX/node/bin/node --disable-warning=ExperimentalWarning scripts/admin.mjs "\$@" ;;
  status) exec systemctl status $APP --no-pager ;;
  logs)   exec journalctl -u $APP -n "\${2:-100}" --no-pager ;;
  restart) exec systemctl restart $APP ;;
  update) exec bash $PREFIX/current/deploy/install.sh ;;
  uninstall) shift; exec bash $PREFIX/current/deploy/uninstall.sh "\$@" ;;
  *) echo "用法：$APP admin <list|create|password|backup> | status | logs [行数] | restart | update | uninstall [--purge]"; exit 1 ;;
esac
EOF
chmod 755 "$CLI"

# ----------------------------------------------------------------------------- 6. 更新前备份
PREVIOUS=$(readlink "$PREFIX/current" 2>/dev/null || true)
if [ -n "$PREVIOUS" ] && [ -f "$DATA/site.db" ]; then
  BACKUP="$DATA/backups/before-update-$(date +%Y%m%d-%H%M%S).db"
  (cd "$PREVIOUS" && runuser -u "$APP" -- env DATA_DIR="$DATA" "$NODE" --disable-warning=ExperimentalWarning scripts/admin.mjs backup "$BACKUP" >/dev/null)
  ok "已备份数据库：$BACKUP"
fi

# ----------------------------------------------------------------------------- 7. systemd 服务
cat > "$UNIT" <<EOF
[Unit]
Description=新手上手站 (tutorial-site)
After=network.target

[Service]
Type=simple
User=$APP
Group=$APP
EnvironmentFile=$ENV_FILE
WorkingDirectory=$PREFIX/current
ExecStart=$PREFIX/node/bin/node --disable-warning=ExperimentalWarning dist/server/entry.mjs
Restart=on-failure
RestartSec=3
# 只允许写自己的数据目录
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=$DATA
MemoryMax=512M

[Install]
WantedBy=multi-user.target
EOF

ln -sfn "$RELEASE" "$PREFIX/current"
systemctl daemon-reload
systemctl enable "$APP" >/dev/null 2>&1
systemctl restart "$APP"

wait_healthy() {
  for _ in $(seq 1 30); do
    curl -fs -o /dev/null "http://127.0.0.1:$PORT/" 2>/dev/null && return 0
    sleep 1
  done
  return 1
}

say "等待网站启动"
if ! wait_healthy; then
  journalctl -u "$APP" -n 30 --no-pager || true
  if [ -n "$PREVIOUS" ] && [ -d "$PREVIOUS" ]; then
    warn "新版本启动失败，正在回到旧版本"
    ln -sfn "$PREVIOUS" "$PREFIX/current"
    systemctl restart "$APP"
    rm -rf "$RELEASE"
    wait_healthy && die "新版本有问题，已自动回到旧版本，网站照常运行。新版本的错误日志见上方。"
  fi
  die "网站没有正常启动，日志见上方（也可执行 $APP logs）"
fi
ok "网站已在端口 $PORT 运行"

# ----------------------------------------------------------------------------- 8. 首次安装：创建管理员
ADMIN_INFO=""
if [ "$FRESH" -eq 1 ]; then
  ADMIN_USER=${ADMIN_USERNAME:-admin}
  ADMIN_PASS=${ADMIN_PASSWORD:-$(head -c 18 /dev/urandom | base64 | tr -d '/+=' | cut -c1-16)}
  if "$CLI" admin list 2>/dev/null | grep -q "'admin'"; then
    ADMIN_INFO="已有管理员账号，沿用原来的密码"
  else
    "$CLI" admin create "$ADMIN_USER" "$ADMIN_PASS" 站长 >/dev/null
    ADMIN_INFO="用户名 $ADMIN_USER    密码 $ADMIN_PASS    （只显示这一次，登录后请到「账号中心」修改）"
  fi
fi

# ----------------------------------------------------------------------------- 9. 防火墙（只新增放行这个端口）
if command -v ufw >/dev/null && ufw status 2>/dev/null | grep -q "Status: active"; then
  ufw allow "$PORT/tcp" comment "$APP" >/dev/null && ok "ufw：已放行 $PORT/tcp（其他规则未改动）"
elif command -v firewall-cmd >/dev/null && firewall-cmd --state >/dev/null 2>&1; then
  firewall-cmd --quiet --permanent --add-port="$PORT/tcp" && firewall-cmd --quiet --reload && ok "firewalld：已放行 $PORT/tcp（其他规则未改动）"
fi

# ----------------------------------------------------------------------------- 10. 清理旧版本
{ ls -1dt "$PREFIX"/releases/*/ 2>/dev/null | tail -n +$((KEEP_RELEASES + 1)) | xargs -r rm -rf; } || true
for d in "$PREFIX"/node-v*; do [ "$d" = "$NODE_DIR" ] || rm -rf "$d"; done

URL=$(sed -n 's/^PUBLIC_URL=//p' "$ENV_FILE")
echo
say "完成 🎉"
echo "  网站地址：  $URL"
[ -n "$ADMIN_INFO" ] && echo "  管理员：    $ADMIN_INFO"
echo
echo "  常用命令："
echo "    $APP status            查看运行状态"
echo "    $APP logs              查看最近日志"
echo "    $APP admin backup      备份数据库（存到 $DATA/backups）"
echo "    $APP admin password admin 新密码   重置密码"
echo "    $APP update            更新到 GitHub 上的最新版本"
echo "    $APP uninstall         卸载（默认保留数据库；加 --purge 连数据一起删除）"
echo
echo "  如果浏览器打不开，请到 VPS 服务商的控制面板确认放行了 TCP $PORT 端口。"
