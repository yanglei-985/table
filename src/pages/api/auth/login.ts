import type { APIRoute } from 'astro';
import { SESSION_COOKIE, checkCredentials, createSession } from '../../../server/auth.mjs';
import { checkRateLimit, clearFailures, clientIp, handle, HttpError, isHttps, json, readJson, recordFailure } from '../../../server/api';

export const POST: APIRoute = (context) =>
  handle(async () => {
    const { username = '', password = '' } = await readJson(context.request);
    const key = `${clientIp(context)}|${String(username).toLowerCase()}`;
    checkRateLimit(key);
    const user = checkCredentials(String(username), String(password));
    if (!user) {
      recordFailure(key);
      throw new HttpError(401, '用户名或密码不正确');
    }
    clearFailures(key);
    setSessionCookie(context, user.id);
    return json({ user: { name: user.display_name, role: user.role } });
  });

export function setSessionCookie(context: Parameters<APIRoute>[0], userId: number) {
  const { token, expires } = createSession(userId);
  context.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isHttps(context),
    path: '/',
    expires,
  });
}
