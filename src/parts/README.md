# 网站的各个部

每个部只管自己那一块：自己的配置（数据库 `settings` 表里独立的一行）、页面组件、样式和浏览器脚本。
一个部的数据出错只让它自己退回默认值；保存一个部不会改动其他部。

| 部 | 目录 | 负责 | 保存接口 |
| --- | --- | --- | --- |
| 设计部 | `design/` | 页面骨架、主题配色、字体、站名 / 图标 / 作者 / 页脚 | `PUT /api/parts/design` |
| 落地部 | `landing/` | 首页的大标题、介绍、卖点、学习路线、常见问题、联系方式 | `PUT /api/parts/landing` |
| 教程部 | `tutorials/` | 教程分类和列表；每篇教程是独立单元 | `PUT /api/parts/tutorials`，单篇：`/api/tutorials/<网址>` |
| 成员部 | `accounts/` | 账号、登录、邀请、成员管理、账号中心；邀请文案 | `PUT /api/parts/accounts` |
| 编辑部 | `editor/` | 管理员的编辑模式工具栏和「站点设置」；自己不存数据 | — |

公共底座在 `src/core/`：数据库（`db.mjs`）、「部」的定义与读写（`part.ts`）、历史版本、接口工具。

## 新增一个部

1. 建目录 `src/parts/<id>/`，写 `part.ts`：用 `definePart({ id, name, duty, schema, defaults })` 定义它的配置。
2. 在 `src/parts/index.ts` 的 `parts` 里登记。
3. 组件里用 `loadPart()` 读自己的配置；需要就地编辑的区块加上 `data-part="<id>"` 和 `data-field` / `data-list` 标记（见 `editor/client/inline-fields.ts`）。
