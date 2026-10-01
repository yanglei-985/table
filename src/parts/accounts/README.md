# 成员部

负责账号与成员。

| 文件 | 作用 |
| --- | --- |
| `part.ts` | 可编辑的配置：邀请文案 |
| `auth.mjs` | 账号、密码哈希、登录会话、首次启动自动创建管理员（命令行工具 `scripts/admin.mjs` 也用它） |
| `invites.mjs` | 邀请链接：生成、撤销、凭邀请注册（名额在同一事务里占用） |
| `components/LoginPage.astro` / `JoinPage.astro` | 登录页、邀请注册页 |
| `components/AccountCenter.astro` | 账号中心：我的账号、修改密码；管理员另有邀请成员、成员列表 |
| `components/SiteStructure.astro` | 账号中心里的「网站结构」：各部职责、最近修改、每篇教程单元 |

角色只有两种：管理员（命令行或环境变量创建）和成员（凭邀请注册，只能浏览）。
