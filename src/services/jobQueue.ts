/**
 * BullMQ Job Queue Service
 *
 * Manages background jobs for scraping, retries, and other async tasks.
 * Uses Redis as the backing store (same as caching).
 */

import { Queue, Worker, Job, QueueEvents } from 'bullmq';

// Job types
export const JobTypes = {
  SCRAPE_PROFILE: 'scrape:profile',
  SCRAPE_POSTS: 'scrape:posts',
  RETRY_ASYNC_SNAPSHOT: 'scrape:retry-snapshot',
  WARM_CACHE: 'cache:warm',
} as const;

export type JobType = typeof JobTypes[keyof typeof JobTypes];

// Job data interfaces
export interface ScrapeProfileJobData {
  companyId: string;           // User's company
  competitorId: string;        // Competitor being scraped
  competitorName: string;
  url: string;
  type: 'company' | 'profile';
}

export interface ScrapePostsJobData {
  companyId: string;
  targetId: string;
  targetName: string;
  targetUrl: string;
  platform: string;
  scrapeType: 'company' | 'profile';
  scrapeJobId: string;         // Database ScrapeJob ID
}

export interface RetrySnapshotJobData {
  companyId: string;
  competitorId: string;
  competitorName: string;
  url: string;
  type: 'company' | 'profile';
  attemptNumber: number;
}

export interface WarmCacheJobData {
  companyId: string;
  userId: string;
}

// Redis connection config (reuse from cache service)
function getRedisConnection() {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    console.log('⚠️ [JobQueue] REDIS_URL not set - job queue disabled');
    return null;
  }

  try {
    const url = new URL(redisUrl);
    return {
      host: url.hostname,
      port: parseInt(url.port) || 6379,
      password: url.password || undefined,
    };
  } catch (error) {
    console.error('❌ [JobQueue] Invalid REDIS_URL:', error);
    return null;
  }
}

// Queue instances
let scrapeQueue: Queue | null = null;
let cacheQueue: Queue | null = null;
let queueEvents: QueueEvents | null = null;

// Worker instances
let scrapeWorker: Worker | null = null;
let cacheWorker: Worker | null = null;

/**
 * Initialize job queues
 */
export function initJobQueues() {
  const connection = getRedisConnection();

  if (!connection) {
    console.log('⚠️ [JobQueue] Running without job queue (no Redis)');
    return false;
  }

  try {
    // Create queues
    scrapeQueue = new Queue('scrape', {
      connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000, // 5s, 10s, 20s
        },
        removeOnComplete: {
          count: 100, // Keep last 100 completed jobs
          age: 24 * 3600, // Keep for 24 hours
        },
        removeOnFail: {
          count: 50, // Keep last 50 failed jobs
          age: 7 * 24 * 3600, // Keep for 7 days
        },
      },
    });

    cacheQueue = new Queue('cache', {
      connection,
      defaultJobOptions: {
        attempts: 2,
        removeOnComplete: true,
        removeOnFail: {
          count: 20,
        },
      },
    });

    // Queue events for monitoring
    queueEvents = new QueueEvents('scrape', { connection });

    queueEvents.on('completed', ({ jobId }) => {
      console.log(`✅ [JobQueue] Job ${jobId} completed`);
    });

    queueEvents.on('failed', ({ jobId, failedReason }) => {
      console.error(`❌ [JobQueue] Job ${jobId} failed:`, failedReason);
    });

    console.log('✅ [JobQueue] Queues initialized');
    return true;
  } catch (error) {
    console.error('❌ [JobQueue] Failed to initialize queues:', error);
    return false;
  }
}

/**
 * Start workers to process jobs
 */
export async function startWorkers() {
  const connection = getRedisConnection();

  if (!connection) {
    return false;
  }

  // Import handlers lazily to avoid circular dependencies
  const { processScrapeJob } = await import('./jobHandlers.js');
  const { prewarmCacheForCompany } = await import('./cacheWarmer.js');

  try {
    // Scrape worker - process one job at a time to respect rate limits
    scrapeWorker = new Worker(
      'scrape',
      async (job: Job) => {
        console.log(`🔄 [Worker] Processing job ${job.id}: ${job.name}`);
        return processScrapeJob(job);
      },
      {
        connection,
        concurrency: 1, // Process one scrape at a time
        limiter: {
          max: 1,
          duration: 5000, // 1 job per 5 seconds max
        },
      }
    );

    scrapeWorker.on('completed', (job) => {
      console.log(`✅ [Worker] Scrape job ${job.id} completed`);
    });

    scrapeWorker.on('failed', (job, err) => {
      console.error(`❌ [Worker] Scrape job ${job?.id} failed:`, err.message);
    });

    // Cache worker - can run multiple in parallel
    cacheWorker = new Worker(
      'cache',
      async (job: Job) => {
        if (job.name === JobTypes.WARM_CACHE) {
          const data = job.data as WarmCacheJobData;
          await prewarmCacheForCompany(data.companyId);
        }
      },
      {
        connection,
        concurrency: 5,
      }
    );

    console.log('✅ [JobQueue] Workers started');
    return true;
  } catch (error) {
    console.error('❌ [JobQueue] Failed to start workers:', error);
    return false;
  }
}

/**
 * Add a profile/company scrape job
 */
export async function addScrapeProfileJob(data: ScrapeProfileJobData) {
  if (!scrapeQueue) {
    console.log('⚠️ [JobQueue] Queue not available, using fallback');
    return null;
  }

  const job = await scrapeQueue.add(JobTypes.SCRAPE_PROFILE, data, {
    jobId: `profile-${data.competitorId}-${Date.now()}`,
  });

  console.log(`📋 [JobQueue] Added profile scrape job: ${job.id}`);
  return job;
}

/**
 * Add a posts scrape job (delayed after profile)
 */
export async function addScrapePostsJob(data: ScrapePostsJobData, delayMs: number = 5000) {
  if (!scrapeQueue) {
    console.log('⚠️ [JobQueue] Queue not available, using fallback');
    return null;
  }

  const job = await scrapeQueue.add(JobTypes.SCRAPE_POSTS, data, {
    jobId: `posts-${data.targetId}-${Date.now()}`,
    delay: delayMs,
  });

  console.log(`📋 [JobQueue] Added posts scrape job: ${job.id} (delay: ${delayMs}ms)`);
  return job;
}

/**
 * Add a retry job for BrightData async snapshots
 */
export async function addRetrySnapshotJob(data: RetrySnapshotJobData, delayMs: number = 60000) {
  if (!scrapeQueue) {
    console.log('⚠️ [JobQueue] Queue not available, using fallback');
    return null;
  }

  const job = await scrapeQueue.add(JobTypes.RETRY_ASYNC_SNAPSHOT, data, {
    jobId: `retry-${data.competitorId}-${data.attemptNumber}-${Date.now()}`,
    delay: delayMs,
    attempts: 1, // Don't auto-retry retries
  });

  console.log(`📋 [JobQueue] Added retry job: ${job.id} (delay: ${delayMs}ms)`);
  return job;
}

/**
 * Add a cache warming job
 */
export async function addCacheWarmJob(data: WarmCacheJobData) {
  if (!cacheQueue) {
    // Fallback to direct execution
    const { prewarmCacheForCompany } = await import('./cacheWarmer.js');
    setImmediate(() => prewarmCacheForCompany(data.companyId));
    return null;
  }

  const job = await cacheQueue.add(JobTypes.WARM_CACHE, data, {
    jobId: `warm-${data.companyId}-${Date.now()}`,
  });

  console.log(`📋 [JobQueue] Added cache warm job: ${job.id}`);
  return job;
}

/**
 * Get queue status for monitoring
 */
export async function getQueueStatus() {
  if (!scrapeQueue) {
    return { available: false };
  }

  const [waiting, active, completed, failed, delayed] = await Promise.all([
    scrapeQueue.getWaitingCount(),
    scrapeQueue.getActiveCount(),
    scrapeQueue.getCompletedCount(),
    scrapeQueue.getFailedCount(),
    scrapeQueue.getDelayedCount(),
  ]);

  return {
    available: true,
    scrape: { waiting, active, completed, failed, delayed },
  };
}

/**
 * Check if job queue is available
 */
export function isJobQueueAvailable(): boolean {
  return scrapeQueue !== null;
}

/**
 * Graceful shutdown
 */
export async function closeJobQueues() {
  const closers = [];

  if (scrapeWorker) closers.push(scrapeWorker.close());
  if (cacheWorker) closers.push(cacheWorker.close());
  if (queueEvents) closers.push(queueEvents.close());
  if (scrapeQueue) closers.push(scrapeQueue.close());
  if (cacheQueue) closers.push(cacheQueue.close());

  await Promise.all(closers);
  console.log('✅ [JobQueue] Closed all queues');
}
