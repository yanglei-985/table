// 公共底座 · 历史版本：每次保存前把旧内容存一份，误改时可以找回
import { getDb, now } from './db.mjs';

const KEEP_REVISIONS = 30;

/** kind：'settings'（某个部的配置，ref = 部的 id）或 'tutorial'（ref = 教程网址标识） */
export function saveRevision(kind: 'tutorial' | 'settings', ref: string, data: string, userId: number) {
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
