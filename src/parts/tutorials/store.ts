// 教程部 · 教程存储
//
// 每篇教程是一个独立单元：tutorials 表里的一行（内容 + 信息 + 草稿状态）加上它自己的历史版本。
// 新增、修改、删除一篇只动这一行，不需要重新构建或重启网站；
// 某一篇的数据出问题时只跳过它自己，其他教程照常显示。
import { z } from 'astro/zod';
import { parseFrontmatter } from '@astrojs/markdown-remark';
import { getDb, now, transaction } from '../../core/db.mjs';
import { saveRevision } from '../../core/revisions';
import { line, text } from '../../core/part';
import { NotFoundError } from '../../core/http';
import { levels } from './part';
import { tutorialsConfig } from '../index';

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

// ---------------------------------------------------------------- 示例教程

const seedFiles = import.meta.glob('./seed/*.md', { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>;

let seeded = false;

/** 全新数据库里导入 seed/ 下的示例教程；管理员删光教程后不会再自动出现。 */
function ensureSeeded() {
  if (seeded) return;
  seeded = true;
  const db = getDb();
  const { n } = db.prepare('SELECT COUNT(*) AS n FROM tutorials').get() as { n: number };
  const { m } = db.prepare("SELECT COUNT(*) AS m FROM revisions WHERE kind = 'tutorial'").get() as { m: number };
  if (n > 0 || m > 0) return;
  transaction(() => {
    for (const [file, raw] of Object.entries(seedFiles)) {
      const { frontmatter, content } = parseFrontmatter(raw);
      const parsed = tutorialSchema.parse({
        slug: file.split('/').pop()!.replace(/\.md$/, ''),
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
      insertTutorial(parsed, null, frontmatter.updated ? new Date(frontmatter.updated).toISOString() : now());
    }
  });
}

// ---------------------------------------------------------------- 读取

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

/** 按「分类顺序 → order → 标题」排序；默认不含草稿。单篇数据损坏时跳过它并记录日志。 */
export function listTutorials({ includeDrafts = false } = {}): Tutorial[] {
  ensureSeeded();
  const { categories } = tutorialsConfig();
  const rank = new Map<string, number>(categories.map((c, i) => [c.key, i]));
  const rows = getDb()
    .prepare(`SELECT * FROM tutorials ${includeDrafts ? '' : 'WHERE draft = 0'}`)
    .all() as unknown as TutorialRow[];
  const list: Tutorial[] = [];
  for (const row of rows) {
    try {
      list.push(fromRow(row));
    } catch (err) {
      console.error(`[教程部] 教程「${row.slug}」数据损坏，已暂时隐藏：`, err);
    }
  }
  return list.sort(
    (a, b) =>
      (rank.get(a.category) ?? 99) - (rank.get(b.category) ?? 99) ||
      a.order - b.order ||
      a.title.localeCompare(b.title, 'zh'),
  );
}

export function getTutorial(slug: string): Tutorial | undefined {
  ensureSeeded();
  const row = getDb().prepare('SELECT * FROM tutorials WHERE slug = ?').get(slug) as TutorialRow | undefined;
  if (!row) return undefined;
  try {
    return fromRow(row);
  } catch (err) {
    console.error(`[教程部] 教程「${slug}」数据损坏：`, err);
    return undefined;
  }
}

// ---------------------------------------------------------------- 写入

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
  if (!tutorialsConfig().categories.some((c) => c.key === category)) throw new Error(`分类「${category}」不存在`);
}

/** 新建一篇草稿教程，返回它的网址标识。 */
export function createTutorial(userId: number): string {
  const { categories } = tutorialsConfig();
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
    saveRevision('tutorial', slug, JSON.stringify(old), userId);
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
    saveRevision('tutorial', slug, JSON.stringify(old), userId);
    db.prepare('DELETE FROM tutorials WHERE slug = ?').run(slug);
  });
}

/** 每篇教程的状态（账号中心「网站结构」用） */
export function tutorialActivity() {
  ensureSeeded();
  return getDb()
    .prepare(
      `SELECT t.slug, t.title, t.draft, t.updated_at AS updatedAt, u.display_name AS updatedBy,
              (SELECT COUNT(*) FROM revisions r WHERE r.kind = 'tutorial' AND r.ref = t.slug) AS revisions
       FROM tutorials t LEFT JOIN users u ON u.id = t.updated_by ORDER BY t.updated_at DESC`,
    )
    .all() as { slug: string; title: string; draft: number; updatedAt: string; updatedBy: string | null; revisions: number }[];
}
