---
title: Git 入门：10 分钟完成你的第一次提交
description: 理解「工作区 → 暂存区 → 仓库」三个概念，亲手创建仓库、提交、查看历史和撤销修改。
category: skills
level: 入门
duration: 15
order: 1
tags: [Git, 版本管理]
updated: 2026-10-01
---

Git 就像游戏里的**存档**：每次提交（commit）都会保存一份完整的快照，改坏了随时可以回到任何一个存档。

## 先理解三个区域

| 区域 | 比喻 | 对应命令 |
| --- | --- | --- |
| 工作区 | 你正在编辑的文件 | 直接改文件 |
| 暂存区 | 准备放进这次存档的东西 | `git add` |
| 仓库 | 已经保存好的存档 | `git commit` |

记住这个流程：**改文件 → `add` 挑选 → `commit` 存档**。

## 动手：创建第一个仓库

1. 新建一个练习文件夹并进入：

   ```bash
   mkdir git-practice
   cd git-practice
   ```

2. 把它初始化成 Git 仓库：

   ```bash
   git init
   ```

3. 新建一个 `hello.txt`，随便写一句话保存（可以用 VS Code 打开文件夹：`code .`）。

4. 查看状态，你会看到 `hello.txt` 显示为红色的「未跟踪」：

   ```bash
   git status
   ```

5. 放入暂存区，再提交：

   ```bash
   git add hello.txt
   git commit -m "第一次提交：添加 hello.txt"
   ```

> [!CHECK]
> 运行 `git log --oneline`，能看到一行带编号的「第一次提交」记录。

## 再改一次，体会「存档」

1. 修改 `hello.txt`，加一行字并保存。
2. 用 `git diff` 看看改了什么，绿色是新增，红色是删除。
3. 再次提交：

   ```bash
   git add .
   git commit -m "补充第二行内容"
   ```

> [!TIP] `git add .` 是什么意思？
> `.` 代表「当前文件夹下所有改动」，文件多的时候比一个个写文件名方便。

## 改坏了怎么办

还没 `add` 的修改，想直接丢掉：

```bash
git restore hello.txt
```

> [!DANGER] 这个操作无法撤销
> `git restore` 会直接丢弃你还没提交的修改，执行前确认那些内容你真的不要了。

## 常用命令速查

| 命令 | 作用 |
| --- | --- |
| `git status` | 查看当前状态（最常用，不确定时就敲它） |
| `git add <文件>` | 把改动放进暂存区 |
| `git commit -m "说明"` | 提交一次存档 |
| `git log --oneline` | 查看存档历史 |
| `git diff` | 查看具体改了什么 |
| `git restore <文件>` | 丢弃未暂存的修改 |

学会这几个命令，日常 80% 的场景都够用了。
