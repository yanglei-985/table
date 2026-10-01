# 新手上手站

给新朋友看的教程分享网站。管理员在网页上直接编辑内容；新成员凭邀请链接注册。

- **内容在线编辑**：管理员打开「编辑模式」，首页文案、学习路线、常见问题、教程正文都能在页面上直接改，保存即生效
- **账号与邀请**：SQLite（SQL 数据库）存储账号；管理员生成邀请链接 / 二维码，被邀请的人注册为普通成员
- **教程页**：难度 / 时长 / 更新日期、自动目录、阅读进度条、代码一键复制、上一篇 / 下一篇
- **三套主题**：星夜 / 宣纸 / 青瓷；中文宋体、西文 Times New Roman

技术栈：Astro（服务端渲染）+ Node.js 内置 SQLite（`node:sqlite`），无需单独安装数据库。

## 角色与权限

| 角色 | 怎么来的 | 能做什么 |
| --- | --- | --- |
| 访客 | 未登录 | 浏览已发布的教程 |
| 成员 | 凭邀请链接注册 | 登录、浏览、修改自己的密码 |
| 管理员 | 命令行或环境变量创建 | 以上全部 + 编辑模式（改文案和教程）+ 生成邀请 + 停用 / 删除成员 |

## 快速开始（本地）

需要 Node.js **22.13 或更高版本**。

```bash
npm install
npm run admin -- create admin '你的密码' 站长   # 创建第一个管理员
npm run dev                                     # 打开 http://localhost:4321
```

数据库会自动建在 `data/site.db`。第一次启动时会写入示例文案和 4 篇示例教程，之后所有修改都存在数据库里。

## 日常使用

1. **登录**：右上角「登录」，用管理员账号登录。
2. **编辑内容**：点页面底部的「编辑模式」。
   - 带虚线框的文字直接点进去改：顶栏的图标和站名、导航、首页各区块、页脚都可以
   - 按钮和链接（首页按钮、导航、底部联系方式、页脚链接）：文字直接改；点右上角 ⚙ 修改「点击后去哪」、按钮样式或删除；「＋ 按钮」「＋ 联系方式」「＋ 底部链接」新增
   - 每个首页区块顶部有「↑ ↓ 隐藏」：调整顺序，或暂时对访客隐藏（管理员仍能看到，可再点「显示」恢复）
   - 列表（卖点、学习路线、常见问题）可以「＋ 添加」或「×」删除
   - 「站点设置」里改浏览器标签副标题、教程分类、邀请文案
   - 「＋ 新建教程」：新教程默认是草稿，写完取消勾选「草稿」再保存才会公开
   - 改完点「保存」（或 `Ctrl + S`）；「放弃」撤销本次所有修改
3. **邀请成员**：右上角头像进入「账号中心」，生成邀请链接（可设有效期和可用人数），复制链接 / 邀请文案或下载二维码发出去。
4. **管理成员**：账号中心的成员列表里可以看到谁邀请了谁，可以停用（立即退出登录）或删除成员。

每次保存前的旧版本会自动存进 `revisions` 表（每篇教程 / 站点文案保留最近 30 次），误改时可以找回。

## 管理员命令行

```bash
npm run admin -- create <用户名> <密码> [昵称]   # 新增管理员
npm run admin -- password <用户名> <新密码>       # 重置任何人的密码（忘记密码时用）
npm run admin -- list                             # 列出所有账号
npm run admin -- backup [文件路径]                 # 备份数据库，网站运行中也可以执行
```

也可以不用命令行：启动时设置环境变量 `ADMIN_USERNAME` 和 `ADMIN_PASSWORD`，如果数据库里还没有管理员就会自动创建（之后再改这两个变量不会影响已有账号）。

## 部署到服务器

网站需要一直运行的 Node.js 服务和一块能保存数据库文件的磁盘。**GitHub Pages 只能放静态网页，不能运行这个网站。**
国内访问推荐腾讯云 / 阿里云的轻量应用服务器（Ubuntu），也可以用 Zeabur、Railway 等支持持久化存储的平台。

### 方式一：一键脚本（推荐，适合已有其他服务的 VPS）

用 SSH 登录服务器后执行：

```bash
curl -fsSLO https://raw.githubusercontent.com/yanglei-985/table/refs/heads/claude/relaxed-rubin-encwsr/deploy/install.sh
sudo bash install.sh
```

脚本会先只读地列出服务器上已有的服务和端口，然后**只新增自己的东西**：

| 新增 | 位置 |
| --- | --- |
| 程序和独立的 Node.js | `/opt/tutorial-site`（不安装、不升级系统的 Node） |
| 数据库 | `/var/lib/tutorial-site/site.db` |
| 配置 | `/etc/tutorial-site.env`（端口、对外地址等） |
| 服务 | systemd 服务 `tutorial-site`，以专用系统用户 `tutorial-site` 运行，只能写自己的数据目录 |
| 管理命令 | `/usr/local/bin/tutorial-site` |

- 自动选一个空闲端口（默认从 4321 开始找），不修改 Nginx / Docker 等已有服务的配置
- 防火墙（ufw / firewalld）启用时只新增放行这个端口；云服务商的安全组需要自己在控制面板放行
- 首次安装会生成管理员账号和随机密码，只显示一次
- `tutorial-site update` 更新：先备份数据库，新版本启动成功才切换，失败自动回到旧版本
- `tutorial-site uninstall` 卸载：只删除上面这些新增的东西（默认保留数据库，`--purge` 一起删除）

以后绑定域名：把 `/etc/tutorial-site.env` 里的 `PUBLIC_URL` 改成 `https://你的域名`、`TRUST_PROXY=1`，
在你自己的 Nginx 里新增一个反向代理到 `127.0.0.1:端口` 的站点（见下文），然后 `systemctl restart tutorial-site`。

### 方式二：Docker

```bash
git clone https://github.com/yanglei-985/table.git && cd table
docker build -t tutorial-site .
docker run -d --name tutorial-site --restart unless-stopped \
  -p 4321:4321 \
  -v tutorial-data:/data \
  -e ADMIN_USERNAME=admin -e ADMIN_PASSWORD='换成你的密码' \
  -e PUBLIC_URL=https://你的域名 -e TRUST_PROXY=1 \
  tutorial-site
```

数据在 Docker 卷 `tutorial-data` 里，删除重建容器不会丢。容器里执行管理命令：

```bash
docker exec tutorial-site node scripts/admin.mjs list
docker exec tutorial-site node scripts/admin.mjs backup /data/backup.db
```

更新版本：`git pull && docker build -t tutorial-site . && docker rm -f tutorial-site`，再执行上面的 `docker run`。

### 方式三：直接用 Node.js

```bash
npm ci && npm run build
npm run admin -- create admin '你的密码'
PORT=4321 HOST=127.0.0.1 TRUST_PROXY=1 PUBLIC_URL=https://你的域名 npm start
```

可以用 `pm2 start npm --name tutorial-site -- start` 让它在后台常驻、开机自启。

### 配置域名和 HTTPS（Nginx）

```nginx
server {
    server_name 你的域名;
    location / {
        proxy_pass http://127.0.0.1:4321;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

然后用 `certbot --nginx` 申请免费证书。国内服务器绑定域名需要先完成 ICP 备案。

### 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` / `HOST` | `4321` / `localhost` | 监听端口和地址（Docker 里是 `0.0.0.0`） |
| `DATA_DIR` | `./data` | 数据库所在目录（Docker 里是 `/data`） |
| `PUBLIC_URL` | 自动识别 | 网站对外地址，用来生成邀请链接，如 `https://learn.example.com` |
| `TRUST_PROXY` | 未设置 | 放在 Nginx 等反向代理后面时设为 `1`，才会采信 `X-Forwarded-*` 头 |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | 未设置 | 没有管理员时自动创建 |
| `ADMIN_DISPLAY_NAME` | 同用户名 | 自动创建的管理员昵称 |

### 备份

整个网站的数据就是 `DATA_DIR/site.db` 一个文件。用 `npm run admin -- backup` 生成一致的副本（不要在网站运行时直接复制 `site.db`），建议每天定时备份到别的地方，例如：

```bash
# crontab -e，每天凌晨 3 点
0 3 * * * cd /path/to/table && npm run admin -- backup /backups/site-$(date +\%F).db
```

## 安全说明

- 密码用 scrypt 加盐哈希存储；登录凭证是随机令牌，数据库里只存它的哈希
- 登录 Cookie 为 `HttpOnly` + `SameSite=Lax`，HTTPS 下自动加 `Secure`
- 所有修改接口只接受本站页面发出的 JSON 请求，拒绝跨站请求
- 同一 IP 15 分钟内输错密码 10 次会被暂时限制
- 修改密码后其他设备需要重新登录；停用账号会立即让对方在所有设备上退出
- 教程正文允许 HTML，只有管理员能写；请只把管理员权限交给信任的人

## 测试

```bash
npm run build
npm test            # 接口测试：账号、邀请、权限、编辑、跨站防护、频率限制
npm run test:e2e    # 浏览器里把管理员和新成员的完整流程走一遍（需要 Playwright 的 Chromium）
SHOTS=./shots npm run test:e2e   # 同时保存每一步的截图
```

GitHub Actions 会在每次推送时自动运行类型检查、构建和这两套测试。

## 主题与字体

| 主题 | key | 风格 |
| --- | --- | --- |
| 星夜 | `night` | 深色底，紫青渐变（默认） |
| 宣纸 | `paper` | 米黄纸面，朱砂红 + 赭石金 |
| 青瓷 | `celadon` | 冷调浅青，青绿 + 靛蓝 |

- 访客点顶栏右侧的三个色块切换，选择记在浏览器里。
- 默认主题：`src/site.config.ts` 的 `defaultTheme`；配色：`src/styles/global.css` 里对应的 `[data-theme='...']` 块。
- 字体：`global.css` 的 `--font`。中文显示为宋体（Windows「宋体」、macOS / iPhone「宋体-简」），部分安卓手机没有宋体会显示为系统默认字体。

## 目录结构：按「部」划分

网站分成几个部，每个部只管自己的内容和配置（详见 [`src/parts/README.md`](src/parts/README.md)）：

| 部 | 目录 | 负责 |
| --- | --- | --- |
| 设计部 | `src/parts/design/` | 页面骨架、三套主题、字体、站名 / 作者 / 页脚 |
| 落地部 | `src/parts/landing/` | 首页大标题、介绍、卖点、学习路线、常见问题、联系方式 |
| 教程部 | `src/parts/tutorials/` | 教程分类和列表；**每篇教程是独立单元**，有自己的内容、草稿状态和历史版本 |
| 成员部 | `src/parts/accounts/` | 账号、登录、邀请、成员管理、账号中心 |
| 编辑部 | `src/parts/editor/` | 管理员的编辑模式工具栏和「站点设置」，把修改交给对应的部保存 |

- 每个部的配置在数据库里各占一行，保存一个部不会改动其他部；某个部的数据损坏只会让它自己退回默认值。
- 新增、修改、删除教程只动那一篇的记录，不需要重新构建或重启网站；某一篇写坏了只影响它自己的页面。
- 管理员在「账号中心 → 网站结构」可以看到各部最近谁改过，以及每篇教程单元的状态和历史版本数。

```text
src/
├── core/          # 公共底座：数据库与升级、「部」的定义与读写、历史版本、接口工具
├── parts/         # 各个部（见上表），每个部有自己的 README
├── pages/         # 路由：只负责把请求交给对应的部
│   └── api/       # 接口：/api/parts/<部>、/api/tutorials、登录注册、邀请、成员
└── middleware.ts  # 识别登录用户、拦截跨站请求
scripts/admin.mjs  # 管理员命令行工具
deploy/            # 服务器一键安装 / 更新 / 卸载脚本
tests/             # 接口测试、数据库升级测试、浏览器流程测试
```
