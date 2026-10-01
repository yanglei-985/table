import type { APIRoute } from 'astro';
import { createTutorial } from '../../../server/content';
import { handle, json, requireUser } from '../../../server/api';

export const POST: APIRoute = (context) =>
  handle(() => {
    const user = requireUser(context, 'admin');
    return json({ slug: createTutorial(user.id) }, 201);
  });
