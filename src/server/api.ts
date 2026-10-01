// API 接口的公共工具
import { z } from 'astro/zod';
import type { APIContext } from 'astro';
import { describeError, NotFoundError } from './content';
import type { User } from './auth.mjs';

export const json = (data: unknown, status = 200) => Response.json(data, { status });

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** 要求已登录；传入 'admin' 时要求管理员。 */
export function requireUser(context: APIContext, role?: 'admin'): User {
  const user = context.locals.user;
  if (!user) throw new HttpError(401, '请先登录');
  if (role === 'admin' && user.role !== 'admin') throw new HttpError(403, '只有管理员可以进行这个操作');
  return user;
}

export async function readJson(request: Request): Promise<any> {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, '请求内容不是有效的 JSON');
  }
}

/** 统一处理接口错误，返回 { error } 和合适的状态码。 */
export async function handle(fn: () => Promise<Response> | Response): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof HttpError) return json({ error: err.message }, err.status);
    if (err instanceof z.ZodError) return json({ error: describeError(err) }, 400);
    if (err instanceof NotFoundError) return json({ error: err.message }, 404);
    if (err instanceof Error && !(err as any).code) return json({ error: err.message }, 400);
    console.error(err);
    return json({ error: '服务器出错了，请稍后再试' }, 500);
  }
}

// 简单的登录频率限制：同一 IP + 用户名 15 分钟内最多失败 10 次
const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW = 15 * 60_000;
const LIMIT = 10;

/** 部署在 Nginx 等反向代理后面时设置 TRUST_PROXY=1，才会采信 X-Forwarded-* 头。 */
export const trustProxy = process.env.TRUST_PROXY === '1';

export function clientIp(context: APIContext) {
  const forwarded = trustProxy ? context.request.headers.get('x-forwarded-for')?.split(',')[0].trim() : undefined;
  return forwarded || context.clientAddress;
}

export function isHttps(context: APIContext) {
  if (context.url.protocol === 'https:') return true;
  return trustProxy && context.request.headers.get('x-forwarded-proto') === 'https';
}

export function publicOrigin(context: APIContext) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, '');
  if (trustProxy) {
    const host = context.request.headers.get('x-forwarded-host');
    if (host) return `${isHttps(context) ? 'https' : 'http'}://${host}`;
  }
  return context.url.origin;
}

export function checkRateLimit(key: string) {
  const entry = attempts.get(key);
  if (entry && entry.resetAt > Date.now() && entry.count >= LIMIT) {
    const minutes = Math.ceil((entry.resetAt - Date.now()) / 60_000);
    throw new HttpError(429, `尝试次数过多，请 ${minutes} 分钟后再试`);
  }
}

export function recordFailure(key: string) {
  const entry = attempts.get(key);
  if (!entry || entry.resetAt <= Date.now()) attempts.set(key, { count: 1, resetAt: Date.now() + WINDOW });
  else entry.count++;
  if (attempts.size > 10_000) attempts.clear();
}

export function clearFailures(key: string) {
  attempts.delete(key);
}
