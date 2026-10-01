import type { APIRoute } from 'astro';
import { revokeInvite } from '../../../parts/accounts/invites.mjs';
import { handle, json, requireUser } from '../../../core/http';

export const DELETE: APIRoute = (context) =>
  handle(() => {
    requireUser(context, 'admin');
    revokeInvite(context.params.code!);
    return json({ ok: true });
  });
