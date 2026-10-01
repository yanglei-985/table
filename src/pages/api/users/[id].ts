import type { APIRoute } from 'astro';
import { getDb } from '../../../server/db.mjs';
import { getUserById } from '../../../server/auth.mjs';
import { handle, HttpError, json, readJson, requireUser } from '../../../server/api';

function target(context: Parameters<APIRoute>[0]) {
  const admin = requireUser(context, 'admin');
  const user = getUserById(Number(context.params.id));
  if (!user) throw new HttpError(404, '用户不存在');
  if (user.id === admin.id) throw new HttpError(400, '不能对自己的账号进行这个操作');
  if (user.role === 'admin') throw new HttpError(400, '管理员账号请用命令行工具管理');
  return user;
}

// 停用 / 恢复成员
export const PATCH: APIRoute = (context) =>
  handle(async () => {
    const user = target(context);
    const { disabled } = await readJson(context.request);
    const db = getDb();
    db.prepare('UPDATE users SET disabled = ? WHERE id = ?').run(disabled ? 1 : 0, user.id);
    if (disabled) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
    return json({ ok: true });
  });

export const DELETE: APIRoute = (context) =>
  handle(() => {
    const user = target(context);
    getDb().prepare('DELETE FROM users WHERE id = ?').run(user.id);
    return json({ ok: true });
  });
