/**
 * Snapshot Checker Service
 *
 * Background cron job that checks all pending BrightData snapshots
 * and processes them when ready. This avoids blocking workers with long polls.
 */

import { prisma } from '../db.js';
import { checkSnapshotStatus, BrightDataLinkedInPost } from './brightdata.js';
import { emitToCompany } from '../websocket/wsServer.js';
import { cache, CacheKeys } from './cache.js';

// Check interval (30 seconds)
const CHECK_INTERVAL_MS = 30000;

// Max age for pending snapshots before giving up (30 minutes)
const MAX_SNAPSHOT_AGE_MS = 30 * 60 * 1000;

let checkerInterval: NodeJS.Timeout | null = null;

/**
 * Extract post ID from LinkedIn post URL
 */
function extractPostIdFromUrl(url: string): string | null {
  if (!url) return null;
  const activityMatch = url.match(/activity-(\d+)/);
  if (activityMatch) return activityMatch[1];
  const urnMatch = url.match(/urn:li:activity:(\d+)/);
  if (urnMatch) return urnMatch[1];
  return null;
}

/**
 * Determine media type from post data
 */
function determineMediaType(post: BrightDataLinkedInPost): string {
  if (post.videos && post.videos.length > 0) return 'video';
  if (post.images && post.images.length > 1) return 'carousel';
  if (post.images && post.images.length === 1) return 'image';
  if (post.document_cover_image) return 'document';
  return 'text';
}

/**
 * Store posts from BrightData results
 */
async function storePosts(companyId: string, platformId: string, posts: BrightDataLinkedInPost[]): Promise<number> {
  let stored = 0;
  console.log(`📦 [SnapshotChecker] Storing ${posts.length} posts for ${companyId}`);

  // Sort by date (newest first) and take top 20
  const sortedPosts = [...posts]
    .sort((a, b) => new Date(b.date_posted).getTime() - new Date(a.date_posted).getTime())
    .slice(0, 20);

  for (const post of sortedPosts) {
    try {
      const postId = post.id || extractPostIdFromUrl(post.url);
      if (!postId) continue;

      // Check if post already exists for THIS company
      const existingPost = await prisma.post.findUnique({
        where: {
          companyId_platformId_platformPostId: {
            companyId,
            platformId,
            platformPostId: postId,
          },
        },
      });

      if (existingPost) {
        // Update metrics with new snapshot
        await prisma.postSnapshot.create({
          data: {
            postId: existingPost.id,
            likeCount: post.num_likes || 0,
            commentCount: post.num_comments || 0,
          },
        });
        continue;
      }

      // Create new post
      const createdPost = await prisma.post.create({
        data: {
          companyId,
          platformId,
          platformPostId: postId,
          captionText: post.post_text || null,
          postUrl: post.url,
          mediaType: determineMediaType(post),
          postedAt: new Date(post.date_posted),
        },
      });

      // Create initial snapshot
      await prisma.postSnapshot.create({
        data: {
          postId: createdPost.id,
          likeCount: post.num_likes || 0,
          commentCount: post.num_comments || 0,
        },
      });

      // Create post analysis
      const totalEngagement = (post.num_likes || 0) + (post.num_comments || 0);
      const impressions = post.user_followers || 1000;

      await prisma.postAnalysis.create({
        data: {
          postId: createdPost.id,
          modelVersion: 'brightdata-snapshot-checker-v1',
          impressions,
          engagement: totalEngagement,
          topics: [],
          summary: post.headline || post.title || 'LinkedIn post',
          entities: [],
          captionSentiment: 0,
          positiveDescription: '',
          imageDescription: '',
          negativeDescription: '',
        },
      });

      stored++;
    } catch (error) {
      console.error(`⚠️ [SnapshotChecker] Failed to store post:`, error);
    }
  }

  return stored;
}

/**
 * Process a single pending snapshot
 */
async function processPendingSnapshot(snapshot: {
  id: string;
  snapshotId: string;
  scrapeJobId: string;
  companyId: string;
  targetId: string;
  targetUrl: string;
  platform: string;
  attempts: number;
  maxAttempts: number;
  createdAt: Date;
}): Promise<void> {
  const { id, snapshotId, scrapeJobId, companyId, targetId, platform, attempts, maxAttempts, createdAt } = snapshot;

  // Check if too old
  const age = Date.now() - createdAt.getTime();
  if (age > MAX_SNAPSHOT_AGE_MS) {
    console.log(`⏰ [SnapshotChecker] Snapshot ${snapshotId} expired (${Math.round(age / 60000)}min old)`);

    await prisma.pendingSnapshot.delete({ where: { id } });
    await prisma.scrapeJob.update({
      where: { id: scrapeJobId },
      data: {
        status: 'failed',
        completedAt: new Date(),
        errorMessage: 'BrightData snapshot timed out after 30 minutes',
      },
    });

    emitToCompany(companyId, 'scrape:failed', {
      jobId: scrapeJobId,
      targetId,
      error: 'Data processing timed out. Please try again.',
    });
    return;
  }

  // Check if max attempts reached
  if (attempts >= maxAttempts) {
    console.log(`🚫 [SnapshotChecker] Snapshot ${snapshotId} reached max attempts (${attempts})`);

    await prisma.pendingSnapshot.delete({ where: { id } });
    await prisma.scrapeJob.update({
      where: { id: scrapeJobId },
      data: {
        status: 'failed',
        completedAt: new Date(),
        errorMessage: 'BrightData snapshot not ready after maximum attempts',
      },
    });

    emitToCompany(companyId, 'scrape:failed', {
      jobId: scrapeJobId,
      targetId,
      error: 'Data processing failed. Please try again.',
    });
    return;
  }

  // Check snapshot status
  try {
    const result = await checkSnapshotStatus(snapshotId);

    // Update attempt count
    await prisma.pendingSnapshot.update({
      where: { id },
      data: {
        attempts: attempts + 1,
        lastCheckedAt: new Date(),
      },
    });

    if (result.status === 'ready' && result.data) {
      console.log(`✅ [SnapshotChecker] Snapshot ${snapshotId} ready with ${result.data.length} items`);

      // Get platform ID
      const platformRecord = await prisma.platform.upsert({
        where: { name: platform },
        update: {},
        create: { name: platform },
      });

      // Store posts
      const posts = result.data as BrightDataLinkedInPost[];
      const postsStored = await storePosts(targetId, platformRecord.id, posts);

      // Update scrape job
      await prisma.scrapeJob.update({
        where: { id: scrapeJobId },
        data: {
          status: 'completed',
          completedAt: new Date(),
          progress: 100,
          postsScraped: postsStored,
        },
      });

      // Delete pending snapshot
      await prisma.pendingSnapshot.delete({ where: { id } });

      // Invalidate caches
      await cache.del(CacheKeys.competitors(companyId));
      await cache.del(CacheKeys.competitorDetails(targetId));

      // Notify frontend
      emitToCompany(companyId, 'scrape:completed', {
        jobId: scrapeJobId,
        targetId,
        postsScraped: postsStored,
      });

      console.log(`✅ [SnapshotChecker] Stored ${postsStored} posts for job ${scrapeJobId}`);
    } else if (result.status === 'error') {
      console.error(`❌ [SnapshotChecker] Snapshot ${snapshotId} returned error`);

      await prisma.pendingSnapshot.delete({ where: { id } });
      await prisma.scrapeJob.update({
        where: { id: scrapeJobId },
        data: {
          status: 'failed',
          completedAt: new Date(),
          errorMessage: 'BrightData returned an error',
        },
      });

      emitToCompany(companyId, 'scrape:failed', {
        jobId: scrapeJobId,
        targetId,
        error: 'Data processing failed',
      });
    } else {
      // Still processing - will check again next interval
      console.log(`⏳ [SnapshotChecker] Snapshot ${snapshotId} still processing (attempt ${attempts + 1}/${maxAttempts})`);

      // Update progress on frontend
      const progress = Math.min(30 + Math.round((attempts / maxAttempts) * 50), 80);
      emitToCompany(companyId, 'scrape:progress', {
        jobId: scrapeJobId,
        progress,
        message: `Processing... (${Math.round(age / 1000)}s)`,
      });
    }
  } catch (error) {
    console.error(`❌ [SnapshotChecker] Error checking snapshot ${snapshotId}:`, error);
    // Will retry on next interval
  }
}

/**
 * Check all pending snapshots
 */
async function checkAllPendingSnapshots(): Promise<void> {
  const pending = await prisma.pendingSnapshot.findMany({
    orderBy: { createdAt: 'asc' },
  });

  if (pending.length === 0) return;

  console.log(`🔍 [SnapshotChecker] Checking ${pending.length} pending snapshots...`);

  for (const snapshot of pending) {
    await processPendingSnapshot(snapshot);
    // Small delay between checks to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

/**
 * Start the snapshot checker cron job
 */
export function startSnapshotChecker(): void {
  if (checkerInterval) {
    console.log('⚠️ [SnapshotChecker] Already running');
    return;
  }

  console.log(`✅ [SnapshotChecker] Started (checking every ${CHECK_INTERVAL_MS / 1000}s)`);

  // Run immediately once
  checkAllPendingSnapshots().catch(console.error);

  // Then run on interval
  checkerInterval = setInterval(() => {
    checkAllPendingSnapshots().catch(console.error);
  }, CHECK_INTERVAL_MS);
}

/**
 * Stop the snapshot checker
 */
export function stopSnapshotChecker(): void {
  if (checkerInterval) {
    clearInterval(checkerInterval);
    checkerInterval = null;
    console.log('🛑 [SnapshotChecker] Stopped');
  }
}

/**
 * Create a pending snapshot record
 */
export async function createPendingSnapshot(data: {
  snapshotId: string;
  scrapeJobId: string;
  companyId: string;
  targetId: string;
  targetUrl: string;
  platform: string;
}): Promise<void> {
  await prisma.pendingSnapshot.create({
    data: {
      snapshotId: data.snapshotId,
      scrapeJobId: data.scrapeJobId,
      companyId: data.companyId,
      targetId: data.targetId,
      targetUrl: data.targetUrl,
      platform: data.platform,
    },
  });

  console.log(`📋 [SnapshotChecker] Created pending snapshot: ${data.snapshotId}`);
}
