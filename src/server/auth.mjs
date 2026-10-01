// 账号、密码与登录会话
import crypto from 'node:crypto';
import { getDb, now, transaction } from './db.mjs';

export const SESSION_COOKIE = 'sid';
export const SESSION_DAYS = 30;

const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

/** @typedef {{ id: number, username: string, display_name: string, role: 'admin' | 'member', disabled: number, created_at: string, last_login_at: string | null, invited_by: number | null }} User */

/** @param {string} password */
export function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, SCRYPT.keylen, SCRYPT);
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), hash.toString('base64')].join('$');
}

/** @param {string} password @param {string} stored */
export function verifyPassword(password, stored) {
  const [algo, N, r, p, salt, hash] = stored.split('$');
  if (algo !== 'scrypt') return false;
  const expected = Buffer.from(hash, 'base64');
  const actual = crypto.scryptSync(password, Buffer.from(salt, 'base64'), expected.length, {
    N: Number(N),
    r: Number(r),
    p: Number(p),
  });
  return crypto.timingSafeEqual(expected, actual);
}

// 用户名：3–20 位字母、数字、下划线；显示名 1–20 字；密码至少 8 位
export const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;

/** @param {{ username?: string, displayName?: string, password?: string }} input */
export function validateAccount({ username, displayName, password }) {
  if (username !== undefined && !USERNAME_RE.test(username)) return '用户名需为 3–20 位字母、数字或下划线';
  if (displayName !== undefined && (displayName.trim().length < 1 || displayName.trim().length > 20))
    return '昵称需为 1–20 个字';
  if (password !== undefined && password.length < 8) return '密码至少 8 位';
  if (password !== undefined && password.length > 200) return '密码太长了';
  return null;
}

const USER_COLUMNS = 'id, username, display_name, role, disabled, created_at, last_login_at, invited_by';

/**
 * @param {{ username: string, displayName: string, password: string, role: 'admin' | 'member', invitedBy?: number | null, inviteCode?: string | null }} input
 * @returns {User}
 */
export function createUser({ username, displayName, password, role, invitedBy = null, inviteCode = null }) {
  const error = validateAccount({ username, displayName, password });
  if (error) throw new Error(error);
  const db = getDb();
  if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) throw new Error('这个用户名已被使用');
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO users (username, display_name, password_hash, role, invited_by, invite_code, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(username, displayName.trim(), hashPassword(password), role, invitedBy, inviteCode, now());
  return /** @type {User} */ (getUserById(Number(lastInsertRowid)));
}

/** @param {number} id @returns {User | undefined} */
export function getUserById(id) {
  return /** @type {User | undefined} */ (getDb().prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`).get(id));
}

/** @param {string} username @param {string} password */
export function setPassword(username, password) {
  const error = validateAccount({ password });
  if (error) throw new Error(error);
  const db = getDb();
  const user = /** @type {{ id: number } | undefined} */ (db.prepare('SELECT id FROM users WHERE username = ?').get(username));
  if (!user) throw new Error(`用户 ${username} 不存在`);
  transaction(() => {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(password), user.id);
    // 改密码后让所有已登录设备重新登录
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
  });
}

/**
 * 校验用户名和密码，成功返回用户。
 * @param {string} username @param {string} password
 * @returns {User | null}
 */
export function checkCredentials(username, password) {
  const row = /** @type {(User & { password_hash: string }) | undefined} */ (
    getDb().prepare(`SELECT ${USER_COLUMNS}, password_hash FROM users WHERE username = ?`).get(username)
  );
  // 用户不存在时也做一次哈希，避免通过响应时间猜出用户名是否存在
  if (!row) {
    verifyPassword(password, DUMMY_HASH);
    return null;
  }
  if (!verifyPassword(password, row.password_hash) || row.disabled) return null;
  const { password_hash: _, ...user } = row;
  return user;
}
const DUMMY_HASH = hashPassword(crypto.randomBytes(16).toString('hex'));

const sha256 = (/** @type {string} */ s) => crypto.createHash('sha256').update(s).digest('hex');

/** @param {number} userId @returns {{ token: string, expires: Date }} */
export function createSession(userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000);
  const db = getDb();
  db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)').run(
    sha256(token),
    userId,
    now(),
    expires.toISOString(),
  );
  db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(now(), userId);
  return { token, expires };
}

/** @param {string | undefined} token @returns {User | null} */
export function getSessionUser(token) {
  if (!token) return null;
  const row = /** @type {User | undefined} */ (
    getDb()
      .prepare(
        `SELECT u.id, u.username, u.display_name, u.role, u.disabled, u.created_at, u.last_login_at, u.invited_by
         FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.token_hash = ? AND s.expires_at > ? AND u.disabled = 0`,
      )
      .get(sha256(token), now())
  );
  return row ?? null;
}

/** @param {string | undefined} token */
export function deleteSession(token) {
  if (token) getDb().prepare('DELETE FROM sessions WHERE token_hash = ?').run(sha256(token));
}

export function purgeExpiredSessions() {
  getDb().prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now());
}

export function adminCount() {
  const { n } = /** @type {{ n: number }} */ (getDb().prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin'").get());
  return n;
}

/**
 * 首次启动时，如果还没有管理员且设置了 ADMIN_USERNAME / ADMIN_PASSWORD 环境变量，就自动创建。
 * @returns {string | null} 创建结果说明
 */
export function bootstrapAdminFromEnv() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password || adminCount() > 0) return null;
  createUser({ username, displayName: process.env.ADMIN_DISPLAY_NAME || username, password, role: 'admin' });
  return `已根据环境变量创建管理员 ${username}`;
}
