import { defineMiddleware } from 'astro:middleware';
import { SESSION_COOKIE, bootstrapAdminFromEnv, getSessionUser, purgeExpiredSessions } from './server/auth.mjs';

let booted = false;

/** Origin 头里的主机名；沙箱页面会发送 "null" 等无法解析的值，视为跨站 */
function originHost(origin: string) {
  try {
    return new URL(origin).host;
  } catch {
    return null;
  }
}

export const onRequest = defineMiddleware(async (context, next) => {
  if (!booted) {
    booted = true;
    const message = bootstrapAdminFromEnv();
    if (message) console.log(`[admin] ${message}`);
    purgeExpiredSessions();
  }

  const { request, url } = context;
  const isWrite = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);

  if (isWrite && url.pathname.startsWith('/api/')) {
    // 防跨站请求伪造：写操作只接受本站页面发出的 JSON 请求
    const contentType = request.headers.get('content-type') ?? '';
    if (!contentType.startsWith('application/json')) {
      return Response.json({ error: '请求格式不正确' }, { status: 415 });
    }
    const origin = request.headers.get('origin');
    const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host');
    if (origin && host && originHost(origin) !== host) {
      return Response.json({ error: '拒绝跨站请求' }, { status: 403 });
    }
  }

  context.locals.user = getSessionUser(context.cookies.get(SESSION_COOKIE)?.value);
  const response = await next();
  // 页面内容会随登录状态变化，不让浏览器或代理缓存 HTML
  if (response.headers.get('content-type')?.includes('text/html')) {
    response.headers.set('cache-control', 'private, no-store');
  }
  return response;
});
