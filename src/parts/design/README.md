# 设计部

负责网站的外观与品牌。

- `part.ts`：站名、图标文字、作者、导航链接、页脚说明和页脚链接、浏览器标题副标题；主题列表和默认主题
- `Layout.astro`：所有页面共用的骨架（顶栏、页脚、主题初始化）；管理员在可编辑页面上会挂上编辑部的工具栏
- `ThemeSwitcher.astro`：顶栏右侧的三个主题色块
- `styles/global.css`：三套主题的颜色变量（星夜 / 宣纸 / 青瓷）、宋体 + Times New Roman 字体、按钮卡片等通用样式

改配色：编辑 `styles/global.css` 里对应的 `[data-theme='...']` 块。加主题：复制一个块改色值，再在 `part.ts` 的 `themes` 里加一项。
