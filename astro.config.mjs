// @ts-check
import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import { remarkCallout } from './src/plugins/remark-callout.mjs';

// 部署到 GitHub Pages 时，工作流会注入 SITE_URL / BASE_PATH；本地开发保持默认即可。
export default defineConfig({
  site: process.env.SITE_URL || 'http://localhost:4321',
  base: process.env.BASE_PATH || '/',
  trailingSlash: 'ignore',
  markdown: {
    processor: unified({ remarkPlugins: [remarkCallout] }),
    // 代码高亮同时生成深色、浅色两套配色，由当前主题决定显示哪套（见 global.css）
    shikiConfig: {
      themes: { dark: 'github-dark-dimmed', light: 'github-light' },
      defaultColor: false,
      wrap: true,
    },
  },
});
