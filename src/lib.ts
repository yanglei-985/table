import { getCollection, type CollectionEntry } from 'astro:content';
import { categories } from './site.config';

export type Tutorial = CollectionEntry<'tutorials'>;

/** 拼接带 base 的站内链接，兼容部署在子路径（如 GitHub Pages /repo/）。 */
export function url(path = '') {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}/${path.replace(/^\//, '')}`;
}

/** 按「分类顺序 → order → 标题」排好序的已发布教程。 */
export async function getTutorials() {
  const rank = new Map<string, number>(categories.map((c, i) => [c.key, i]));
  const list = await getCollection('tutorials', ({ data }) => !data.draft);
  return list.sort(
    (a, b) =>
      (rank.get(a.data.category) ?? 99) - (rank.get(b.data.category) ?? 99) ||
      a.data.order - b.data.order ||
      a.data.title.localeCompare(b.data.title, 'zh'),
  );
}

export function categoryName(key: string) {
  return categories.find((c) => c.key === key)?.name ?? key;
}

export function formatDate(date: Date) {
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
}
