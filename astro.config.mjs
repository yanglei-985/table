// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

// 网站以 Node.js 服务运行：页面在请求时从 SQLite 数据库读取内容。
export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  site: process.env.PUBLIC_URL || undefined,
  trailingSlash: 'ignore',
  // 跨站检查在 src/middleware.ts 里统一处理（兼容反向代理）
  security: { checkOrigin: false },
  vite: {
    ssr: { external: ['node:sqlite'] },
  },
});
