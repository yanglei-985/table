import type { APIRoute } from 'astro';
import { checkCredentials, setPassword } from '../../../parts/accounts/auth.mjs';
import { handle, HttpError, json, readJson, requireUser } from '../../../core/http';
import { setSessionCookie } from './login';

// 修改自己的密码；成功后其他设备上的登录会失效
export const POST: APIRoute = (context) =>
  handle(async () => {
    const user = requireUser(context);
    const { current = '', next = '' } = await readJson(context.request);
    if (!checkCredentials(user.username, String(current))) throw new HttpError(400, '当前密码不正确');
    setPassword(user.username, String(next));
    setSessionCookie(context, user.id);
    return json({ ok: true });
  });
