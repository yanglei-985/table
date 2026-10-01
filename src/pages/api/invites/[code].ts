import type { APIRoute } from 'astro';
import { revokeInvite } from '../../../server/invites.mjs';
import { handle, json, requireUser } from '../../../server/api';

export const DELETE: APIRoute = (context) =>
  handle(() => {
    requireUser(context, 'admin');
    revokeInvite(context.params.code!);
    return json({ ok: true });
  });
