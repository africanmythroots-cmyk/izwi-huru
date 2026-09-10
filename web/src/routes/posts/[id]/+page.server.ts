// src/routes/posts/[id]/+page.server.ts
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, params }) => {
  const [postRes, repliesRes] = await Promise.all([
    fetch(`/posts/${params.id}`, { credentials: 'include' }),
    fetch(`/posts/${params.id}/replies`, { credentials: 'include' }),
  ]);

  if (!postRes.ok) return { post: null, replies: [] };

  const { post } = await postRes.json();
  const { replies } = repliesRes.ok ? await repliesRes.json() : { replies: [] };

  return { post, replies };
};
