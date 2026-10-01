import type { APIRoute } from 'astro';
import { saveSettings } from '../../server/content';
import { handle, json, readJson, requireUser } from '../../server/api';

export const PUT: APIRoute = (context) =>
  handle(async () => {
    const user = requireUser(context, 'admin');
    const settings = saveSettings(await readJson(context.request), user.id);
    return json({ settings });
  });
