// src/routes/spaces/+page.server.ts
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
  try {
    const res = await fetch('/spaces', { credentials: 'include' });
    if (!res.ok) return { spaces: [] };
    const { spaces } = await res.json();
    return { spaces: spaces ?? [] };
  } catch {
    return { spaces: [] };
  }
};
