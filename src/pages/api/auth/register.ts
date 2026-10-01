import type { APIRoute } from 'astro';
import { registerWithInvite } from '../../../server/invites.mjs';
import { checkRateLimit, clientIp, handle, json, readJson, recordFailure } from '../../../server/api';
import { setSessionCookie } from './login';

export const POST: APIRoute = (context) =>
  handle(async () => {
    const { code = '', username = '', displayName = '', password = '' } = await readJson(context.request);
    const key = `register|${clientIp(context)}`;
    checkRateLimit(key);
    try {
      const user = registerWithInvite({
        code: String(code),
        username: String(username).trim(),
        displayName: String(displayName),
        password: String(password),
      });
      setSessionCookie(context, user.id);
      return json({ user: { name: user.display_name, role: user.role } }, 201);
    } catch (err) {
      recordFailure(key);
      throw err;
    }
  });
