import type { APIRoute } from 'astro';
import { deleteTutorial, updateTutorial } from '../../../parts/tutorials/store';
import { handle, json, readJson, requireUser } from '../../../core/http';

export const PUT: APIRoute = (context) =>
  handle(async () => {
    const user = requireUser(context, 'admin');
    const tutorial = updateTutorial(context.params.slug!, await readJson(context.request), user.id);
    return json({ tutorial });
  });

export const DELETE: APIRoute = (context) =>
  handle(() => {
    const user = requireUser(context, 'admin');
    deleteTutorial(context.params.slug!, user.id);
    return json({ ok: true });
  });
