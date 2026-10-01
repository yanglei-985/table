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
    shikiConfig: { theme: 'github-dark-dimmed', wrap: true },
  },
});
