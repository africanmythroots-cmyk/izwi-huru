// src/transparency/reportJob.ts
// BullMQ job definition for quarterly report generation.
// Scheduled by a cron: 0 9 1 1,4,7,10 * (9am on the 1st of Jan, Apr, Jul, Oct)

import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';
import { generateAndPublishReport, currentQuarter, previousQuarter } from './reportGenerator.js';
import { env } from '../env.js';

const connection = new Redis(env.REDIS_URL, { lazyConnect: true, enableReadyCheck: false });

export const reportQueue = new Queue('transparency-reports', { connection });

/**
 * Schedule the next quarterly report.
 * Called on server startup to ensure the job is always scheduled.
 */
export async function scheduleQuarterlyReport(): Promise<void> {
  // Remove any existing repeat job and reschedule
  const jobs = await reportQueue.getRepeatableJobs();
  for (const job of jobs) {
    await reportQueue.removeRepeatableByKey(job.key);
  }

  await reportQueue.add(
    'generate-quarterly-report',
    { quarter: 'auto' }, // 'auto' = compute from current date
    {
      repeat: {
        // 9am UTC on the first of January, April, July, October
        pattern: '0 9 1 1,4,7,10 *',
      },
      removeOnComplete: { count: 12 }, // keep last 12 job results
      removeOnFail:     { count: 6  },
    }
  );
  console.log('📅 Quarterly transparency report job scheduled');
}

/**
 * Start the report worker.
 */
export function startReportWorker(): Worker {
  const worker = new Worker(
    'transparency-reports',
    async (job) => {
      const quarter = job.data.quarter === 'auto'
        ? previousQuarter(currentQuarter()) // generate for the quarter just ended
        : job.data.quarter as string;

      console.log(`📝 Generating transparency report for ${quarter}…`);
      await generateAndPublishReport(quarter);
    },
    { connection }
  );

  worker.on('completed', (job) => {
    console.log(`✅ Report job ${job.id} completed`);
  });
  worker.on('failed', (job, err) => {
    console.error(`❌ Report job ${job?.id} failed:`, err);
  });

  return worker;
}

/**
 * Manually trigger a report (for admin use, not scheduled).
 */
export async function triggerReportNow(quarter: string): Promise<void> {
  await reportQueue.add('generate-quarterly-report', { quarter }, {
    removeOnComplete: true,
  });
  console.log(`🔄 Manual report triggered for ${quarter}`);
}
