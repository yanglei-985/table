import type { APIRoute } from 'astro';
import { createTutorial } from '../../../parts/tutorials/store';
import { handle, json, requireUser } from '../../../core/http';

export const POST: APIRoute = (context) =>
  handle(() => {
    const user = requireUser(context, 'admin');
    return json({ slug: createTutorial(user.id) }, 201);
  });
