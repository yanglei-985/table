// 公共底座 · 「部」的定义
//
// 网站由几个部组成，每个部只管自己那一块：
//   - 自己的配置：settings 表里独立的一行（key = 部的 id），有自己的校验规则和默认值
//   - 自己的页面组件、样式、浏览器脚本，都放在 src/parts/<部的 id>/ 下
// 一个部的数据出错只会让它自己退回默认值，不会拖垮其他部；保存一个部也不会改动其他部。
import { z } from 'astro/zod';
import { getDb, now, transaction } from './db.mjs';
import { saveRevision } from './revisions';

export type PartSchema = z.ZodObject<any>;

export interface Part<S extends PartSchema = PartSchema> {
  /** 英文标识，也是数据库里的 key 和接口路径 /api/parts/<id> */
  id: string;
  /** 中文名称，如「设计部」 */
  name: string;
  /** 一句话说明它负责什么 */
  duty: string;
  schema: S;
  defaults: z.infer<S>;
  /** 保存前的额外检查，不通过时抛出带中文说明的错误 */
  validate?: (data: z.infer<S>) => void;
}

export function definePart<S extends PartSchema>(part: Part<S>): Part<S> {
  return part;
}

/** 读取一个部的配置。数据缺失或损坏时退回默认值，只影响这个部自己。 */
export function loadPart<S extends PartSchema>(part: Part<S>): z.infer<S> {
  const db = getDb();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(part.id) as { value: string } | undefined;
  if (!row) {
    db.prepare('INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES (?, ?, ?)').run(
      part.id,
      JSON.stringify(part.defaults),
      now(),
    );
    return part.defaults;
  }
  try {
    // 与默认值合并：以后新增的配置项在老数据库里也有值
    const result = part.schema.safeParse({ ...part.defaults, ...JSON.parse(row.value) });
    if (result.success) return result.data;
    console.error(`[${part.name}] 配置未通过校验，已临时使用默认值：`, result.error.issues[0]);
  } catch (err) {
    console.error(`[${part.name}] 配置无法解析，已临时使用默认值：`, err);
  }
  return part.defaults;
}

/** 校验并保存一个部的配置，旧内容存入历史版本。 */
export function savePart<S extends PartSchema>(part: Part<S>, input: unknown, userId: number): z.infer<S> {
  const data = part.schema.parse(input);
  part.validate?.(data);
  transaction(() => {
    const db = getDb();
    const old = db.prepare('SELECT value FROM settings WHERE key = ?').get(part.id) as { value: string } | undefined;
    if (old) saveRevision('settings', part.id, old.value, userId);
    db.prepare(
      `INSERT INTO settings (key, value, updated_at, updated_by) VALUES (?, ?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at, updated_by = excluded.updated_by`,
    ).run(part.id, JSON.stringify(data), now(), userId);
  });
  return data;
}

/** 各部最近一次修改的时间和修改人（账号中心「网站结构」用） */
export function partActivity(): Record<string, { updatedAt: string; updatedBy: string | null }> {
  const rows = getDb()
    .prepare(
      `SELECT s.key, s.updated_at, u.display_name FROM settings s LEFT JOIN users u ON u.id = s.updated_by`,
    )
    .all() as { key: string; updated_at: string; display_name: string | null }[];
  return Object.fromEntries(rows.map((r) => [r.key, { updatedAt: r.updated_at, updatedBy: r.display_name }]));
}

// ---------------------------------------------------------------- 常用校验规则

export const text = (max: number) => z.string().trim().max(max);
export const line = (max: number) => z.string().trim().min(1, '不能为空').max(max);

/** 把 zod 错误整理成一句中文提示 */
export function describeError(error: z.ZodError) {
  const first = error.issues[0];
  const where = first.path.join('.');
  return where ? `${where}：${first.message}` : first.message;
}
