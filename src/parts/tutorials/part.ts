// 教程部：教程列表的标题和分类。每篇教程本身是一个独立单元，见 store.ts
import { z } from 'astro/zod';
import { definePart, line, text } from '../../core/part';
import { getDb } from '../../core/db.mjs';

export const levels = ['入门', '进阶', '高级'] as const;

export const tutorialsPart = definePart({
  id: 'tutorials',
  name: '教程部',
  duty: '教程分类和列表标题；每篇教程是独立单元，有自己的内容、草稿状态和历史版本',
  schema: z.object({
    tutorialsTitle: line(40),
    tutorialsDesc: text(120),
    // 教程分类：key 是英文标识，教程用它归类
    categories: z
      .array(
        z.object({
          key: z.string().regex(/^[a-z0-9-]{1,20}$/, '分类标识只能用小写字母、数字和短横线'),
          name: line(20),
          desc: text(60),
        }),
      )
      .min(1, '至少保留一个分类')
      .max(20)
      .refine((list) => new Set(list.map((c) => c.key)).size === list.length, '分类标识不能重复'),
  }),
  defaults: {
    tutorialsTitle: '全部教程',
    tutorialsDesc: '按分类筛选，或直接搜索你想学的内容。',
    categories: [
      { key: 'start', name: '新手必读', desc: '第一次来先看这里' },
      { key: 'env', name: '环境准备', desc: '装好工具，少走弯路' },
      { key: 'skills', name: '核心技能', desc: '日常最常用的操作' },
      { key: 'guide', name: '写作指南', desc: '给分享者：如何写一篇教程' },
    ],
  },
  // 不能删除还有教程在用的分类
  validate({ categories }) {
    const keys = new Set(categories.map((c) => c.key));
    const orphans = (getDb().prepare('SELECT title, category FROM tutorials').all() as { title: string; category: string }[]).filter(
      (t) => !keys.has(t.category),
    );
    if (orphans.length > 0) {
      const names = orphans.slice(0, 3).map((t) => `《${t.title}》`).join('、');
      throw new Error(`还有教程在使用被删除的分类：${names}${orphans.length > 3 ? ' 等' : ''}，请先给它们换个分类`);
    }
  },
});
