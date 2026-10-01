import type { APIRoute } from 'astro';
import { SESSION_COOKIE, deleteSession } from '../../../parts/accounts/auth.mjs';
import { handle, json } from '../../../core/http';

export const POST: APIRoute = (context) =>
  handle(() => {
    deleteSession(context.cookies.get(SESSION_COOKIE)?.value);
    context.cookies.delete(SESSION_COOKIE, { path: '/' });
    return json({ ok: true });
  });
