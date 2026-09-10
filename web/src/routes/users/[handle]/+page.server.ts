// src/routes/users/[handle]/+page.server.ts
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, params }) => {
  // Public profile — only exposes handle and reputation.
  // No email, no location, no real name — ever.
  const res = await fetch(`/users/${params.handle}`, { credentials: 'include' });
  if (!res.ok) return { profile: null };
  const { user } = await res.json();
  return { profile: user };
};
