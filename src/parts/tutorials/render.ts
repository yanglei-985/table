// 教程部 · Markdown 渲染
// 每篇教程单独渲染、单独缓存；某一篇写坏了只影响它自己的页面。
import { createMarkdownProcessor, type MarkdownHeading } from '@astrojs/markdown-remark';
import { remarkCallout } from './remark-callout.mjs';
import type { Tutorial } from './store';

let processor: ReturnType<typeof createMarkdownProcessor> | undefined;
const cache = new Map<string, { html: string; headings: MarkdownHeading[] }>();

export async function renderMarkdown(body: string) {
  processor ??= createMarkdownProcessor({
    remarkPlugins: [remarkCallout],
    shikiConfig: { themes: { dark: 'github-dark-dimmed', light: 'github-light' }, defaultColor: false, wrap: true },
  });
  const { code, metadata } = await (await processor).render(body);
  return { html: code, headings: metadata.headings };
}

/** 渲染一篇教程；按「网址 + 更新时间」缓存，出错时返回提示而不是让整页报错。 */
export async function renderTutorial(t: Tutorial) {
  const key = `${t.slug}@${t.updatedAt}`;
  const hit = cache.get(key);
  if (hit) return hit;
  try {
    const result = await renderMarkdown(t.body);
    if (cache.size > 200) cache.clear();
    cache.set(key, result);
    return result;
  } catch (err) {
    console.error(`[教程部] 教程「${t.slug}」渲染失败：`, err);
    return {
      html: '<aside class="callout callout-warning"><p class="callout-title">这篇教程暂时无法显示</p><p>内容格式有误，管理员可以在编辑模式里修正后重新保存。</p></aside>',
      headings: [],
    };
  }
}
