import { prisma } from '../db.js';
import { emitToCompany } from '../websocket/wsServer.js';

const STUCK_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes
const HEALTH_CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

let healthCheckInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Find and recover stuck jobs (pending/in_progress for more than threshold)
 * Marks them as failed so users can retry manually via "Refresh All"
 */
export async function recoverStuckJobs(): Promise<number> {
  const stuckThreshold = new Date(Date.now() - STUCK_THRESHOLD_MS);

  try {
    // Find all stuck jobs
    const stuckJobs = await prisma.scrapeJob.findMany({
      where: {
        status: { in: ['pending', 'in_progress'] },
        createdAt: { lt: stuckThreshold },
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

    if (stuckJobs.length === 0) {
      return 0;
    }

    console.log(`[JobRecovery] Found ${stuckJobs.length} stuck jobs`);

    // Mark each job as failed and notify via WebSocket
    for (const job of stuckJobs) {
      await prisma.scrapeJob.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          completedAt: new Date(),
          errorMessage: 'Job timed out (server restart recovery)',
        },
      });

      console.log(`[JobRecovery] Marked job ${job.id} as failed (${job.targetCompany?.name || job.targetUrl})`);

      // Notify connected clients
      try {
        emitToCompany(job.companyId, 'scrape:failed', {
          jobId: job.id,
          targetId: job.targetId,
          error: 'Job timed out during server restart',
        });
      } catch {
        // WebSocket might not be initialized yet during startup
        // This is fine - clients will see the failed status on next fetch
      }
    }

    return stuckJobs.length;
  } catch (error) {
    console.error('[JobRecovery] Error recovering stuck jobs:', error);
    return 0;
  }
}

/**
 * Start periodic health checker that runs every 5 minutes
 * Catches jobs that got stuck during normal operation
 */
export function startJobHealthChecker(): void {
  if (healthCheckInterval) {
    console.warn('[JobRecovery] Health checker already running');
    return;
  }

  healthCheckInterval = setInterval(async () => {
    const recovered = await recoverStuckJobs();
    if (recovered > 0) {
      console.log(`[JobRecovery] Health check recovered ${recovered} stuck jobs`);
    }
  }, HEALTH_CHECK_INTERVAL_MS);

  console.log('[JobRecovery] Health checker started (runs every 5 minutes)');
}

/**
 * Stop the health checker (for graceful shutdown)
 */
export function stopJobHealthChecker(): void {
  if (healthCheckInterval) {
    clearInterval(healthCheckInterval);
    healthCheckInterval = null;
    console.log('[JobRecovery] Health checker stopped');
  }
}
