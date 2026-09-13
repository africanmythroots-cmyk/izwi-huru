// src/routes/feed/+page.server.ts
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, url, cookies }) => {
  const spaceSlug = url.searchParams.get('space') ?? undefined;
  const cursor    = url.searchParams.get('cursor') ?? undefined;

  const params = new URLSearchParams();
  if (spaceSlug) params.set('spaceSlug', spaceSlug);
  if (cursor)    params.set('cursor', cursor);

  try {
    const res = await fetch(`/feed?${params}`, { credentials: 'include' });
    if (!res.ok) return { posts: [], nextCursor: null, spaceSlug };

    const data = await res.json();
    return { posts: data.feed ?? [], nextCursor: data.nextCursor ?? null, spaceSlug };
  } catch {
    return { posts: [], nextCursor: null, spaceSlug };
  }
};
