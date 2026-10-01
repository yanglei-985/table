import type { APIRoute } from 'astro';
import { renderMarkdown } from '../../parts/tutorials/render';
import { handle, json, readJson, requireUser } from '../../core/http';

// 编辑教程时的实时预览
export const POST: APIRoute = (context) =>
  handle(async () => {
    requireUser(context, 'admin');
    const { body = '' } = await readJson(context.request);
    const { html } = await renderMarkdown(String(body).slice(0, 200_000));
    return json({ html });
  });
