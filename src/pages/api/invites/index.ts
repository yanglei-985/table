import type { APIRoute } from 'astro';
import { createInvite } from '../../../parts/accounts/invites.mjs';
import { handle, HttpError, json, readJson, requireUser } from '../../../core/http';

export const POST: APIRoute = (context) =>
  handle(async () => {
    const user = requireUser(context, 'admin');
    const { note = '', maxUses = null, expiresInDays = null } = await readJson(context.request);
    const uses = maxUses === null ? null : Number(maxUses);
    const days = expiresInDays === null ? null : Number(expiresInDays);
    if (uses !== null && !(Number.isInteger(uses) && uses >= 1 && uses <= 1000)) throw new HttpError(400, '可用次数需为 1–1000');
    if (days !== null && !(Number.isInteger(days) && days >= 1 && days <= 365)) throw new HttpError(400, '有效期需为 1–365 天');
    const invite = createInvite({ createdBy: user.id, note: String(note).trim(), maxUses: uses, expiresInDays: days });
    return json({ invite }, 201);
  });
