// src/routes/transparency/+page.server.ts
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
  try {
    const [reportsRes, requestsRes, eventsRes] = await Promise.all([
      fetch('/transparency/reports').catch(() => null),
      fetch('/transparency/requests').catch(() => null),
      fetch('/transparency/events').catch(() => null),
    ]);

    const { reports } = reportsRes && reportsRes.ok ? await reportsRes.json() : { reports: [] };
    const { summary } = requestsRes && requestsRes.ok ? await requestsRes.json() : { summary: [] };
    const { events } = eventsRes && eventsRes.ok ? await eventsRes.json() : { events: [] };

    return { reports: reports ?? [], requestSummary: summary ?? [], events: events ?? [] };
  } catch {
    return { reports: [], requestSummary: [], events: [] };
  }
};
