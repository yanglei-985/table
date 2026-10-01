import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { categories } from './site.config';

const categoryKeys = categories.map((c) => c.key) as [string, ...string[]];

const tutorials = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/tutorials' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    category: z.enum(categoryKeys),
    level: z.enum(['入门', '进阶', '高级']).default('入门'),
    // 预计阅读 + 动手时间（分钟）
    duration: z.number().int().positive(),
    // 同一分类内的排序，数字越小越靠前
    order: z.number().default(100),
    // 首页卡片上显示「新手推荐」角标
    featured: z.boolean().default(false),
    tags: z.array(z.string()).default([]),
    updated: z.coerce.date(),
    // 草稿不会出现在网站上
    draft: z.boolean().default(false),
  }),
});

export const collections = { tutorials };
