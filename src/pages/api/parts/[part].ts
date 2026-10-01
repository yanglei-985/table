import type { APIRoute } from 'astro';
import { parts } from '../../../parts';
import { savePart, type Part } from '../../../core/part';
import { handle, HttpError, json, readJson, requireUser } from '../../../core/http';

// 保存某一个部的配置：/api/parts/design、/api/parts/landing……只改这一个部
export const PUT: APIRoute = (context) =>
  handle(async () => {
    const user = requireUser(context, 'admin');
    const part: Part | undefined = parts[context.params.part as keyof typeof parts];
    if (!part) throw new HttpError(404, '没有这个部');
    return json({ data: savePart(part, await readJson(context.request), user.id) });
  });
