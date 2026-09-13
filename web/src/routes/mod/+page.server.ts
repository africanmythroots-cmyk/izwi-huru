// src/routes/mod/+page.server.ts
import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ fetch, url }) => {
  const spaceSlug = url.searchParams.get('space') ?? undefined;

  // Fetch the mod queue; backend enforces moderator role
  const params = new URLSearchParams();
  if (spaceSlug) params.set('spaceSlug', spaceSlug);

  try {
    const [queueRes, govRes] = await Promise.all([
      fetch(`/mod/queue?${params}`, { credentials: 'include' }).catch(() => null),
      fetch('/mod/government-requests', { credentials: 'include' }).catch(() => null),
    ]);

    // 403 = not a moderator — redirect to feed
    if (queueRes && (queueRes.status === 403 || queueRes.status === 401)) {
      throw redirect(302, '/feed');
    }

    const { queue }    = queueRes && queueRes.ok    ? await queueRes.json()    : { queue: [] };
    const { requests } = govRes && govRes.ok ? await govRes.json() : { requests: [] };

    return { queue: queue ?? [], govRequests: requests ?? [], spaceSlug };
  } catch (err: any) {
    if (err?.status === 302) throw err;
    return { queue: [], govRequests: [], spaceSlug };
  }
};
