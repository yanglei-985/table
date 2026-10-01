// 站点文案与教程的读写（数据库）+ Markdown 渲染
import { z } from 'astro/zod';
import { createMarkdownProcessor, parseFrontmatter, type MarkdownHeading } from '@astrojs/markdown-remark';
import { getDb, now, transaction } from './db.mjs';
import { remarkCallout } from '../plugins/remark-callout.mjs';
import { defaultSettings, levels, type Settings } from '../site.config';

// ---------------------------------------------------------------- 校验规则

const text = (max: number) => z.string().trim().max(max);
const line = (max: number) => z.string().trim().min(1, '不能为空').max(max);

export const settingsSchema = z.object({
  name: line(30),
  logo: line(6),
  author: line(30),
  tagline: text(80),
  heroBadge: text(40),
  heroTitle: line(40),
  heroHighlight: text(40),
  description: text(300),
  heroPoints: z.array(line(30)).max(6),
  roadmapTitle: line(40),
  roadmapDesc: text(120),
  roadmap: z.array(z.object({ title: line(30), desc: text(200) })).max(8),
  tutorialsTitle: line(40),
  tutorialsDesc: text(120),
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
  faq: z.array(z.object({ q: line(80), a: text(600) })).max(30),
  contactTitle: line(40),
  contactDesc: text(200),
  contacts: z
    .array(
      z.object({
        label: line(20),
        href: z
          .string()
          .trim()
          .regex(/^(https?:\/\/|mailto:|tel:)/, '链接需以 https://、mailto: 或 tel: 开头')
          .max(300),
      }),
    )
    .max(8),
  footerNote: text(80),
  inviteMessage: text(300),
});

export const slugSchema = z.string().regex(/^[a-z0-9][a-z0-9-]{0,59}$/, '网址标识只能用小写字母、数字和短横线');

export const tutorialSchema = z.object({
  slug: slugSchema,
  title: line(80),
  description: text(200),
  category: z.string().min(1),
  level: z.enum(levels),
  duration: z.coerce.number().int().min(1).max(600),
  order: z.coerce.number().int().min(0).max(9999),
  featured: z.boolean(),
  draft: z.boolean(),
  tags: z.array(line(20)).max(8),
  body: z.string().max(200_000),
});

export type TutorialInput = z.infer<typeof tutorialSchema>;

export interface Tutorial extends TutorialInput {
  createdAt: string;
  updatedAt: string;
}

/** 把 zod 错误整理成一句中文提示 */
export function describeError(error: z.ZodError) {
  const first = error.issues[0];
  const where = first.path.join('.');
  return where ? `${where}：${first.message}` : first.message;
}

// ---------------------------------------------------------------- 初始化

const seedFiles = import.meta.glob('/seed/tutorials/*.md', { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>;

let seeded = false;

/** 数据库为空时，写入 site.config.ts 的默认文案和 seed/tutorials 里的示例教程。 */
export function ensureSeeded() {
  if (seeded) return;
  const db = getDb();
  transaction(() => {
    if (!db.prepare("SELECT 1 FROM settings WHERE key = 'site'").get()) {
      db.prepare("INSERT INTO settings (key, value, updated_at) VALUES ('site', ?, ?)").run(
        JSON.stringify(defaultSettings),
        now(),
      );
    }
    const { n } = db.prepare('SELECT COUNT(*) AS n FROM tutorials').get() as { n: number };
    const { m } = db.prepare("SELECT COUNT(*) AS m FROM revisions WHERE kind = 'tutorial'").get() as { m: number };
    // 只在全新数据库里导入示例；管理员删光教程后不会再自动出现
    if (n === 0 && m === 0) {
      for (const [file, raw] of Object.entries(seedFiles)) {
        const { frontmatter, content } = parseFrontmatter(raw);
        const slug = file.split('/').pop()!.replace(/\.md$/, '');
        const parsed = tutorialSchema.parse({
          slug,
          title: frontmatter.title,
          description: frontmatter.description ?? '',
          category: frontmatter.category,
          level: frontmatter.level ?? '入门',
          duration: frontmatter.duration ?? 10,
          order: frontmatter.order ?? 100,
          featured: frontmatter.featured ?? false,
          draft: frontmatter.draft ?? false,
          tags: frontmatter.tags ?? [],
          body: content.trim() + '\n',
        });
        const updated = frontmatter.updated ? new Date(frontmatter.updated).toISOString() : now();
        insertTutorial(parsed, null, updated);
      }
    }
  });
  seeded = true;
}

// ---------------------------------------------------------------- 站点文案

export function getSettings(): Settings {
  ensureSeeded();
  const row = getDb().prepare("SELECT value FROM settings WHERE key = 'site'").get() as { value: string } | undefined;
  // 与默认值合并：以后新增的配置项在老数据库里也有值
  return { ...defaultSettings, ...(row ? JSON.parse(row.value) : {}) };
}

export function saveSettings(input: unknown, userId: number): Settings {
  const settings = settingsSchema.parse(input) as Settings;
  const keys = new Set(settings.categories.map((c) => c.key));
  const orphans = listTutorials({ includeDrafts: true }).filter((t) => !keys.has(t.category));
  if (orphans.length > 0) {
    const names = orphans.slice(0, 3).map((t) => `《${t.title}》`).join('、');
    throw new Error(`还有教程在使用被删除的分类：${names}${orphans.length > 3 ? ' 等' : ''}，请先给它们换个分类`);
  }
  transaction(() => {
    const db = getDb();
    const old = db.prepare("SELECT value FROM settings WHERE key = 'site'").get() as { value: string } | undefined;
    if (old) saveRevision('settings', 'site', old.value, userId);
    db.prepare(
      `INSERT INTO settings (key, value, updated_at, updated_by) VALUES ('site', ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
    ).run(JSON.stringify(settings), now(), userId);
  });
  return settings;
}

// ---------------------------------------------------------------- 教程

interface TutorialRow {
  slug: string;
  title: string;
  description: string;
  category: string;
  level: (typeof levels)[number];
  duration: number;
  sort_order: number;
  featured: number;
  draft: number;
  tags: string;
  body: string;
  created_at: string;
  updated_at: string;
}

function fromRow(r: TutorialRow): Tutorial {
  return {
    slug: r.slug,
    title: r.title,
    description: r.description,
    category: r.category,
    level: r.level,
    duration: r.duration,
    order: r.sort_order,
    featured: !!r.featured,
    draft: !!r.draft,
    tags: JSON.parse(r.tags),
    body: r.body,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** 按「分类顺序 → order → 标题」排序；默认不含草稿。 */
export function listTutorials({ includeDrafts = false } = {}): Tutorial[] {
  ensureSeeded();
  const { categories } = getSettings();
  const rank = new Map<string, number>(categories.map((c, i) => [c.key, i]));
  const rows = getDb()
    .prepare(`SELECT * FROM tutorials ${includeDrafts ? '' : 'WHERE draft = 0'}`)
    .all() as unknown as TutorialRow[];
  return rows
    .map(fromRow)
    .sort(
      (a, b) =>
        (rank.get(a.category) ?? 99) - (rank.get(b.category) ?? 99) ||
        a.order - b.order ||
        a.title.localeCompare(b.title, 'zh'),
    );
}

export function getTutorial(slug: string): Tutorial | undefined {
  ensureSeeded();
  const row = getDb().prepare('SELECT * FROM tutorials WHERE slug = ?').get(slug) as TutorialRow | undefined;
  return row && fromRow(row);
}

function insertTutorial(t: TutorialInput, userId: number | null, at = now()) {
  getDb()
    .prepare(
      `INSERT INTO tutorials (slug, title, description, category, level, duration, sort_order, featured, tags, body, draft, created_at, updated_at, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      t.slug,
      t.title,
      t.description,
      t.category,
      t.level,
      t.duration,
      t.order,
      t.featured ? 1 : 0,
      JSON.stringify(t.tags),
      t.body,
      t.draft ? 1 : 0,
      at,
      at,
      userId,
    );
}

function assertCategory(category: string) {
  if (!getSettings().categories.some((c) => c.key === category)) throw new Error(`分类「${category}」不存在`);
}

/** 新建一篇草稿教程，返回它的网址标识。 */
export function createTutorial(userId: number): string {
  const { categories } = getSettings();
  const slug = `tutorial-${Date.now().toString(36)}`;
  insertTutorial(
    {
      slug,
      title: '未命名教程',
      description: '一两句话说明学完能做到什么。',
      category: categories[categories.length - 1].key,
      level: '入门',
      duration: 10,
      order: 100,
      featured: false,
      draft: true,
      tags: [],
      body: '开头一段：这篇教程解决什么问题，学完能得到什么。\n\n## 第一步\n\n1. 具体操作一\n2. 具体操作二\n\n> [!CHECK]\n> 看到什么结果就说明这一步成功了。\n',
    },
    userId,
  );
  return slug;
}

/** 保存教程（可同时修改网址标识），返回保存后的教程。 */
export function updateTutorial(slug: string, input: unknown, userId: number): Tutorial {
  const t = tutorialSchema.parse(input);
  assertCategory(t.category);
  return transaction(() => {
    const db = getDb();
    const old = db.prepare('SELECT * FROM tutorials WHERE slug = ?').get(slug) as TutorialRow | undefined;
    if (!old) throw new NotFoundError('教程不存在');
    if (t.slug !== slug && db.prepare('SELECT 1 FROM tutorials WHERE slug = ?').get(t.slug))
      throw new Error('这个网址标识已被其他教程使用');
    saveRevision('tutorial', slug, JSON.stringify(fromRow(old)), userId);
    db.prepare(
      `UPDATE tutorials SET slug = ?, title = ?, description = ?, category = ?, level = ?, duration = ?, sort_order = ?,
         featured = ?, tags = ?, body = ?, draft = ?, updated_at = ?, updated_by = ? WHERE slug = ?`,
    ).run(
      t.slug,
      t.title,
      t.description,
      t.category,
      t.level,
      t.duration,
      t.order,
      t.featured ? 1 : 0,
      JSON.stringify(t.tags),
      t.body,
      t.draft ? 1 : 0,
      now(),
      userId,
      slug,
    );
    if (t.slug !== slug) db.prepare("UPDATE revisions SET ref = ? WHERE kind = 'tutorial' AND ref = ?").run(t.slug, slug);
    return getTutorial(t.slug)!;
  });
}

export function deleteTutorial(slug: string, userId: number) {
  transaction(() => {
    const db = getDb();
    const old = db.prepare('SELECT * FROM tutorials WHERE slug = ?').get(slug) as TutorialRow | undefined;
    if (!old) throw new NotFoundError('教程不存在');
    saveRevision('tutorial', slug, JSON.stringify(fromRow(old)), userId);
    db.prepare('DELETE FROM tutorials WHERE slug = ?').run(slug);
  });
}

const KEEP_REVISIONS = 30;

function saveRevision(kind: 'tutorial' | 'settings', ref: string, data: string, userId: number) {
  const db = getDb();
  db.prepare('INSERT INTO revisions (kind, ref, data, saved_by, saved_at) VALUES (?, ?, ?, ?, ?)').run(
    kind,
    ref,
    data,
    userId,
    now(),
  );
  db.prepare(
    `DELETE FROM revisions WHERE kind = ? AND ref = ? AND id NOT IN
       (SELECT id FROM revisions WHERE kind = ? AND ref = ? ORDER BY id DESC LIMIT ?)`,
  ).run(kind, ref, kind, ref, KEEP_REVISIONS);
}

export class NotFoundError extends Error {}

// ---------------------------------------------------------------- Markdown

let processor: ReturnType<typeof createMarkdownProcessor> | undefined;
const cache = new Map<string, { html: string; headings: MarkdownHeading[] }>();

export async function renderMarkdown(body: string, cacheKey?: string) {
  if (cacheKey && cache.has(cacheKey)) return cache.get(cacheKey)!;
  processor ??= createMarkdownProcessor({
    remarkPlugins: [remarkCallout],
    shikiConfig: { themes: { dark: 'github-dark-dimmed', light: 'github-light' }, defaultColor: false, wrap: true },
  });
  const { code, metadata } = await (await processor).render(body);
  const result = { html: code, headings: metadata.headings };
  if (cacheKey) {
    if (cache.size > 200) cache.clear();
    cache.set(cacheKey, result);
  }
  return result;
}
