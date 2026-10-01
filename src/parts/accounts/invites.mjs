// 邀请链接：管理员生成，被邀请的人凭链接注册为普通成员
import crypto from 'node:crypto';
import { getDb, now, transaction } from '../../core/db.mjs';
import { createUser } from './auth.mjs';

/** @typedef {{ code: string, created_by: number | null, creator_name: string | null, note: string, max_uses: number | null, uses: number, expires_at: string | null, revoked: number, created_at: string }} Invite */

/**
 * @param {{ createdBy: number, note?: string, maxUses?: number | null, expiresInDays?: number | null }} input
 * @returns {Invite}
 */
export function createInvite({ createdBy, note = '', maxUses = null, expiresInDays = null }) {
  // 去掉易混淆字符，方便口头或手抄传递
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(10);
  const code = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
  const expires = expiresInDays ? new Date(Date.now() + expiresInDays * 86400_000).toISOString() : null;
  getDb()
    .prepare('INSERT INTO invites (code, created_by, note, max_uses, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(code, createdBy, note.slice(0, 60), maxUses, expires, now());
  return /** @type {Invite} */ (getInvite(code));
}

/** @param {string} code @returns {Invite | undefined} */
export function getInvite(code) {
  return /** @type {Invite | undefined} */ (
    getDb()
      .prepare(
        `SELECT i.*, u.display_name AS creator_name FROM invites i
         LEFT JOIN users u ON u.id = i.created_by WHERE i.code = ?`,
      )
      .get(code.toUpperCase())
  );
}

/** @returns {Invite[]} */
export function listInvites() {
  return /** @type {Invite[]} */ (
    getDb()
      .prepare(
        `SELECT i.*, u.display_name AS creator_name FROM invites i
         LEFT JOIN users u ON u.id = i.created_by ORDER BY i.created_at DESC`,
      )
      .all()
  );
}

/** @param {Invite} invite @returns {'有效' | '已撤销' | '已过期' | '已用完'} */
export function inviteStatus(invite) {
  if (invite.revoked) return '已撤销';
  if (invite.expires_at && invite.expires_at <= now()) return '已过期';
  if (invite.max_uses !== null && invite.uses >= invite.max_uses) return '已用完';
  return '有效';
}

/** @param {string} code */
export function revokeInvite(code) {
  getDb().prepare('UPDATE invites SET revoked = 1 WHERE code = ?').run(code);
}

/**
 * 用邀请码注册。校验邀请码与占用名额在同一事务里完成，避免多人同时用最后一个名额。
 * @param {{ code: string, username: string, displayName: string, password: string }} input
 */
export function registerWithInvite({ code, username, displayName, password }) {
  return transaction(() => {
    const invite = getInvite(code);
    if (!invite || inviteStatus(invite) !== '有效') throw new Error('邀请链接无效或已失效，请联系管理员重新获取');
    const user = createUser({
      username,
      displayName,
      password,
      role: 'member',
      invitedBy: invite.created_by,
      inviteCode: invite.code,
    });
    getDb().prepare('UPDATE invites SET uses = uses + 1 WHERE code = ?').run(invite.code);
    return user;
  });
}
