// src/routes/mod/+page.server.ts
import type { PageServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ fetch, url }) => {
  const spaceSlug = url.searchParams.get('space') ?? undefined;

  // Fetch the mod queue; backend enforces moderator role
  const params = new URLSearchParams();
  if (spaceSlug) params.set('spaceSlug', spaceSlug);

  const [queueRes, govRes] = await Promise.all([
    fetch(`/mod/queue?${params}`, { credentials: 'include' }),
    fetch('/mod/government-requests', { credentials: 'include' }),
  ]);

  // 403 = not a moderator — redirect to feed
  if (queueRes.status === 403 || queueRes.status === 401) {
    throw redirect(302, '/feed');
  }

  const { queue }    = queueRes.ok    ? await queueRes.json()    : { queue: [] };
  const { requests } = govRes.ok ? await govRes.json() : { requests: [] };

  return { queue, govRequests: requests, spaceSlug };
};
