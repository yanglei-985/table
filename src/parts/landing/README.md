# 落地部

负责首页（落地页）的文案，配置见 `part.ts`。首页由这几个区块组成，每块一个组件：

| 组件 | 内容 |
| --- | --- |
| `sections/Hero.astro` | 小标签、大标题、介绍、按钮（可增删、改链接和样式）、卖点、统计说明 |
| `sections/Roadmap.astro` | 学习路线 |
| `sections/Faq.astro` | 常见问题（浏览时折叠，编辑时展开） |
| `sections/Contact.astro` | 联系方式按钮（可增删、改链接） |

`components/SectionFrame.astro` 是每个区块的外框：编辑模式下可以上移、下移、隐藏 / 显示，顺序和显示状态存在落地部的 `sections` 里。

中间的教程列表归教程部（`tutorials/components/TutorialGrid.astro`）。
每个区块用 `data-part="landing"` 声明归属，编辑后只会保存落地部。
