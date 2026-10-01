---
title: 准备开发环境：安装 VS Code、Node.js 和 Git
description: 一次性装好后续教程都会用到的三件套，Windows / macOS 都适用，每步都有检查点。
category: env
level: 入门
duration: 20
order: 1
featured: true
tags: [VS Code, Node.js, Git, 安装]
updated: 2026-10-01
---

这篇教程结束时，你的电脑上会有：

- **VS Code**：写代码、看文件用的编辑器
- **Node.js**：运行 JavaScript 工具（比如本站就是用它构建的）
- **Git**：保存代码的每一个版本，和别人协作

## 第一步：安装 VS Code

1. 打开官网 [code.visualstudio.com](https://code.visualstudio.com/)，点击下载按钮，网站会自动识别你的系统。
2. 运行安装包，一路「下一步」即可。Windows 用户建议勾选 **「添加到 PATH」** 和 **「通过 Code 打开」**。
3. 打开 VS Code，点左侧的扩展图标（四个方块），搜索 `Chinese`，安装简体中文语言包后按提示重启。

> [!CHECK]
> 打开 VS Code，菜单变成中文，说明安装成功。

## 第二步：安装 Node.js

1. 打开 [nodejs.org](https://nodejs.org/zh-cn)，下载标有 **LTS**（长期支持）的版本。
2. 运行安装包，保持默认选项一路安装。
3. 安装完成后，**关掉所有终端窗口再重新打开**，新装的命令才会生效。

在 VS Code 中按 `` Ctrl + ` ``（macOS 是 `` Cmd + ` ``）打开终端，输入：

```bash
node -v
npm -v
```

> [!CHECK]
> 两条命令都输出了版本号（例如 `v22.x.x` 和 `10.x.x`），就说明装好了。

> [!WARNING] 提示「不是内部或外部命令」？
> 九成是因为终端是在安装之前打开的。关掉 VS Code 重新打开再试一次。

## 第三步：安装 Git

- **Windows**：到 [git-scm.com](https://git-scm.com/download/win) 下载安装包，选项全部保持默认。
- **macOS**：在终端输入 `git --version`，系统会弹窗提示安装开发者工具，点「安装」即可。

装好后告诉 Git 你是谁（换成你自己的名字和邮箱）：

```bash
git config --global user.name "你的名字"
git config --global user.email "you@example.com"
```

> [!CHECK]
> 运行 `git --version` 能看到版本号，运行 `git config --global user.name` 能看到你刚设置的名字。

## 小结

三件套已经就位 🎉 下一篇我们用 Git 完成你的第一次提交。
