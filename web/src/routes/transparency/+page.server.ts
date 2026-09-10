// src/routes/transparency/+page.server.ts
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch }) => {
  const [reportsRes, requestsRes, eventsRes] = await Promise.all([
    fetch('/transparency/reports'),
    fetch('/transparency/requests'),
    fetch('/transparency/events'),
  ]);

  const { reports }  = reportsRes.ok  ? await reportsRes.json()  : { reports: [] };
  const { summary }  = requestsRes.ok ? await requestsRes.json() : { summary: [] };
  const { events }   = eventsRes.ok   ? await eventsRes.json()   : { events: [] };

  return { reports, requestSummary: summary, events };
};
