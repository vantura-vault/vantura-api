import { prisma } from '../db.js';

export type ScrapeJobStatus = 'pending' | 'in_progress' | 'completed' | 'failed';
export type ScrapeType = 'company' | 'profile' | 'posts';

export interface CreateScrapeJobInput {
  companyId: string;    // User's company initiating the scrape
  targetId: string;     // Competitor company being scraped
  targetUrl: string;    // LinkedIn URL
  platform: string;     // e.g., "LinkedIn"
  scrapeType: ScrapeType;
}

export interface UpdateScrapeJobInput {
  status?: ScrapeJobStatus;
  progress?: number;
  errorMessage?: string;
  postsScraped?: number;
  startedAt?: Date;
  completedAt?: Date;
}

/**
 * Create a new scrape job
 */
export async function createScrapeJob(input: CreateScrapeJobInput) {
  const job = await prisma.scrapeJob.create({
    data: {
      companyId: input.companyId,
      targetId: input.targetId,
      targetUrl: input.targetUrl,
      platform: input.platform,
      scrapeType: input.scrapeType,
      status: 'pending',
      progress: 0,
    },
    include: {
      targetCompany: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  console.log(`[ScrapeJob] Created job ${job.id} for ${job.targetCompany.name}`);
  return job;
}

/**
 * Update a scrape job's status
 */
export async function updateScrapeJob(jobId: string, updates: UpdateScrapeJobInput) {
  const job = await prisma.scrapeJob.update({
    where: { id: jobId },
    data: updates,
    include: {
      targetCompany: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  console.log(`[ScrapeJob] Updated job ${jobId}: ${JSON.stringify(updates)}`);
  return job;
}

/**
 * Get a scrape job by ID
 */
export async function getScrapeJobById(jobId: string) {
  return prisma.scrapeJob.findUnique({
    where: { id: jobId },
    include: {
      targetCompany: {
        select: {
          id: true,
          name: true,
          profilePictureUrl: true,
        },
      },
      initiatingCompany: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });
}

/**
 * Get all scrape jobs for a company
 */
export async function getScrapeJobsByCompany(companyId: string, options?: {
  status?: ScrapeJobStatus;
  limit?: number;
}) {
  return prisma.scrapeJob.findMany({
    where: {
      companyId,
      ...(options?.status && { status: options.status }),
    },
    include: {
      targetCompany: {
        select: {
          id: true,
          name: true,
          profilePictureUrl: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: options?.limit,
  });
}

/**
 * Get pending scrape jobs for a specific target (to avoid duplicates)
 */
export async function getPendingScrapeJobForTarget(companyId: string, targetId: string) {
  return prisma.scrapeJob.findFirst({
    where: {
      companyId,
      targetId,
      status: {
        in: ['pending', 'in_progress'],
      },
    },
  });
}

/**
 * Mark a job as started
 */
export async function markJobStarted(jobId: string) {
  return updateScrapeJob(jobId, {
    status: 'in_progress',
    startedAt: new Date(),
    progress: 10,
  });
}

/**
 * Mark a job as completed
 */
export async function markJobCompleted(jobId: string, postsScraped: number) {
  return updateScrapeJob(jobId, {
    status: 'completed',
    completedAt: new Date(),
    progress: 100,
    postsScraped,
  });
}

/**
 * Mark a job as failed
 */
export async function markJobFailed(jobId: string, errorMessage: string) {
  return updateScrapeJob(jobId, {
    status: 'failed',
    completedAt: new Date(),
    errorMessage,
  });
}

/**
 * Cleanup old completed/failed jobs (older than specified days)
 */
export async function cleanupOldJobs(olderThanDays: number = 7) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  const result = await prisma.scrapeJob.deleteMany({
    where: {
      status: {
        in: ['completed', 'failed'],
      },
      completedAt: {
        lt: cutoffDate,
      },
    },
  });

  console.log(`[ScrapeJob] Cleaned up ${result.count} old jobs`);
  return result.count;
}
