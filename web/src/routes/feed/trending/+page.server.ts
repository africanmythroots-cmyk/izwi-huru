// src/routes/feed/trending/+page.server.ts
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, url }) => {
  const spaceSlug = url.searchParams.get('space') ?? undefined;
  const window    = url.searchParams.get('window') ?? '24';

  const params = new URLSearchParams({ window });
  if (spaceSlug) params.set('spaceSlug', spaceSlug);

  try {
    const res = await fetch(`/feed/trending?${params}`, { credentials: 'include' });
    if (!res.ok) return { posts: [], spaceSlug };

    const data = await res.json();
    return { posts: data.trending ?? [], spaceSlug };
  } catch {
    return { posts: [], spaceSlug };
  }
};
