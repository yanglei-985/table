---
title: 如何写一篇新教程（附模板）
description: 给分享者看的：新建一个 Markdown 文件、填好开头信息、用提示框和步骤列表把教程写清楚。
category: guide
level: 入门
duration: 10
order: 1
tags: [写作, Markdown, 模板]
updated: 2026-10-01
---

本站的每篇教程就是 `src/content/tutorials/` 文件夹里的一个 `.md` 文件。**新建文件 → 写内容 → 推送**，网站会自动更新。

## 第一步：新建文件

在 `src/content/tutorials/` 下新建文件，文件名就是网址的一部分，建议用**英文小写加短横线**：

```text
src/content/tutorials/my-new-tutorial.md
→ 网址：/tutorials/my-new-tutorial/
```

## 第二步：复制这份模板

```markdown
---
title: 教程标题
description: 一两句话说明学完能做到什么
category: skills        # start / env / skills / guide
level: 入门             # 入门 / 进阶 / 高级
duration: 15            # 预计分钟数
order: 2                # 同分类内的排序，越小越靠前
featured: false         # true 会显示「新手推荐」角标
tags: [标签一, 标签二]
updated: 2026-10-01
draft: false            # true 时不会发布
---

开头一段：这篇教程解决什么问题，学完能得到什么。

## 第一步：……

1. 具体操作一
2. 具体操作二

> [!CHECK]
> 看到什么结果就说明这一步成功了。
```

> [!TIP] 分类不够用？
> 打开 `src/site.config.ts`，在 `categories` 里加一项，`key` 填英文，`name` 填显示的中文名即可。

## 第三步：用好这几种写法

- **步骤用有序列表**（`1.` `2.` `3.`），网站会自动显示成带圆形数字的步骤。
- **命令放进代码块**，读者可以一键复制。
- **提示框**有五种，按需使用：

```markdown
> [!TIP] 可选的标题
> 小技巧

> [!NOTE]
> 补充说明

> [!CHECK]
> 检查点：看到什么结果说明这一步成功了

> [!WARNING]
> 容易出错的地方

> [!DANGER]
> 不可撤销的危险操作
```

## 写给新手的三条原则

1. **一步只做一件事**，并告诉读者做完应该看到什么。
2. **把报错写出来**：你踩过的坑，就是读者最需要的内容。
3. **写完自己照着做一遍**，能跑通再发布。

## 第四步：本地预览并发布

```bash
npm install      # 第一次需要
npm run dev      # 打开 http://localhost:4321 预览
```

确认没问题后提交并推送，GitHub Actions 会自动构建并发布网站。
