# 新手上手站

一个给新朋友看的教程分享网站：深色渐变卡片风格，教程用 Markdown 写，推送后自动发布到 GitHub Pages。

- **首页**：大标题 → 三步学习路线 → 教程卡片（分类筛选 + 搜索）→ 常见问题 → 联系方式
- **教程页**：难度 / 时长 / 更新日期、自动目录、阅读进度条、代码一键复制、上一篇 / 下一篇
- **写作增强**：有序列表自动显示为步骤编号；支持 `> [!TIP]`、`> [!CHECK]` 等提示框

## 快速开始

需要 Node.js 22 或更高版本。

```bash
npm install
npm run dev        # 本地预览：http://localhost:4321
npm run build      # 构建到 dist/
npm run check      # 类型与内容格式检查
```

## 新增一篇教程

在 `src/content/tutorials/` 下新建 `xxx.md`（文件名即网址），开头写上：

```markdown
---
title: 教程标题
description: 一两句话说明学完能做到什么
category: skills        # 对应 src/site.config.ts 里的分类 key
level: 入门             # 入门 / 进阶 / 高级
duration: 15            # 预计分钟数
order: 2                # 同分类内排序，越小越靠前
featured: false         # true 显示「新手推荐」角标
tags: [标签一, 标签二]
updated: 2026-10-01
draft: false            # true 时不发布
---
```

提示框写法：

```markdown
> [!TIP] 可选标题      小技巧（绿色）
> [!CHECK]             检查点（绿色 ✅）
> [!NOTE]              补充说明（青色）
> [!WARNING]           注意（橙色）
> [!DANGER]            危险操作（红色）
```

站内的《如何写一篇新教程》有完整模板和写作建议。

## 改成你自己的

所有文案都集中在 `src/site.config.ts`：站名、首页标题、作者、联系方式、教程分类、学习路线、常见问题。配色在 `src/styles/global.css` 顶部的 `:root` 变量里。

## 发布到 GitHub Pages

1. 仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
2. 把代码推送到 `main` 分支（或在 Actions 页手动运行「部署到 GitHub Pages」）。
3. 部署完成后访问 `https://<用户名>.github.io/<仓库名>/`。

工作流会自动设置子路径，无需修改配置。

## 目录结构

```text
src/
├── content/tutorials/   # ✍️ 教程都放这里
├── site.config.ts       # ⚙️ 站点文案与分类
├── content.config.ts    # 教程开头信息的格式校验
├── pages/               # 首页、教程页、404
├── components/          # 教程卡片、难度标签
├── layouts/Base.astro   # 顶栏与页脚
├── plugins/             # 提示框 Markdown 插件
└── styles/global.css    # 设计变量与通用样式
```
