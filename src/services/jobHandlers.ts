/**
 * Job Handlers for BullMQ Workers
 *
 * Contains the actual processing logic for each job type.
 */

import { Job } from 'bullmq';
import { prisma } from '../db.js';
import { brightdataQueue } from './brightdataQueue.js';
import { BrightDataLinkedInPost, extractLinkedInCompanySlug, extractLinkedInProfileSlug } from './brightdata.js';
import { ensureS3Image } from './imageStorage.js';
import { emitToCompany } from '../websocket/wsServer.js';
import { cache, CacheKeys } from './cache.js';
import {
  JobTypes,
  ScrapeProfileJobData,
  ScrapePostsJobData,
  RetrySnapshotJobData,
  addScrapePostsJob,
  addRetrySnapshotJob,
} from './jobQueue.js';
import { createScrapeJob, markJobStarted, markJobCompleted, markJobFailed, getPendingScrapeJobForTarget } from './scrapeJobService.js';
import { createPendingSnapshot } from './snapshotChecker.js';

const MAX_RETRY_ATTEMPTS = 3;

/**
 * Determine the discover_by type by inspecting the URL
 * This is the same approach used by the working asyncScraper.ts
 */
function getDiscoverType(url: string): 'company_url' | 'profile_url' {
  if (extractLinkedInCompanySlug(url)) {
    return 'company_url';
  } else if (extractLinkedInProfileSlug(url)) {
    return 'profile_url';
  }
  return 'company_url';
}

/**
 * Main job processor - routes to specific handlers
 */
export async function processScrapeJob(job: Job): Promise<any> {
  switch (job.name) {
    case JobTypes.SCRAPE_PROFILE:
      return handleScrapeProfile(job);
    case JobTypes.SCRAPE_POSTS:
      return handleScrapePosts(job);
    case JobTypes.RETRY_ASYNC_SNAPSHOT:
      return handleRetrySnapshot(job);
    default:
      throw new Error(`Unknown job type: ${job.name}`);
  }
}

/**
 * Handle profile/company scraping
 */
async function handleScrapeProfile(job: Job<ScrapeProfileJobData>): Promise<void> {
  const { companyId, competitorId, competitorName, url, type } = job.data;

  console.log(`🔍 [Job] Scraping ${type} for ${competitorName}: ${url}`);

  try {
    let followerCount = 0;
    let profilePictureUrl: string | null = null;
    let gotAsyncSnapshot = false;

    // Scrape via BrightData queue
    if (type === 'company') {
      const results = await brightdataQueue.scrapeCompany(url);

      if (results && results.length > 0) {
        const data = results[0];
        if ((data as unknown as { snapshot_id?: string }).snapshot_id) {
          console.log(`⏳ [Job] BrightData returned async snapshot for company`);
          gotAsyncSnapshot = true;
        } else {
          followerCount = data.followers || 0;
          profilePictureUrl = await ensureS3Image(data.logo, competitorId, 'logo');
          console.log(`✅ [Job] Scraped company: ${followerCount} followers`);
        }
      }
    } else {
      const results = await brightdataQueue.scrapeProfile(url);

      if (results && results.length > 0) {
        const data = results[0];
        if ((data as unknown as { snapshot_id?: string }).snapshot_id) {
          console.log(`⏳ [Job] BrightData returned async snapshot for profile`);
          gotAsyncSnapshot = true;
        } else {
          followerCount = data.followers || data.connections || 0;
          profilePictureUrl = await ensureS3Image(data.avatar, competitorId, 'profile');
          console.log(`✅ [Job] Scraped profile: ${followerCount} followers`);
        }
      }
    }

    // If BrightData returned async snapshot, schedule retry
    if (gotAsyncSnapshot) {
      await addRetrySnapshotJob({
        companyId,
        competitorId,
        competitorName,
        url,
        type,
        attemptNumber: 1,
      }, 60000); // Retry in 60s
      return;
    }

    // Update company with scraped data
    if (profilePictureUrl) {
      await prisma.company.update({
        where: { id: competitorId },
        data: { profilePictureUrl },
      });
    }

    // Update platform snapshot with real follower count
    if (followerCount > 0) {
      await updateFollowerSnapshot(competitorId, 'LinkedIn', followerCount);
    }

    // Invalidate cache
    await cache.del(CacheKeys.competitors(companyId));

    // Notify frontend
    emitToCompany(companyId, 'competitor:profileReady', {
      competitorId,
      name: competitorName,
      profilePictureUrl,
      followers: followerCount,
    });

    // Schedule posts scrape
    const existingJob = await getPendingScrapeJobForTarget(companyId, competitorId);
    if (!existingJob) {
      const scrapeJob = await createScrapeJob({
        companyId,
        targetId: competitorId,
        targetUrl: url,
        platform: 'LinkedIn',
        scrapeType: type,
      });

      await addScrapePostsJob({
        companyId,
        targetId: competitorId,
        targetName: competitorName,
        targetUrl: url,
        platform: 'LinkedIn',
        scrapeType: type,
        scrapeJobId: scrapeJob.id,
      }, 5000); // 5s delay

      emitToCompany(companyId, 'scrape:scheduled', {
        jobId: scrapeJob.id,
        targetId: competitorId,
        targetName: competitorName,
        delaySeconds: 5,
      });
    }

  } catch (error) {
    console.error(`❌ [Job] Profile scrape failed:`, error);

    emitToCompany(companyId, 'competitor:syncFailed', {
      competitorId,
      name: competitorName,
      error: error instanceof Error ? error.message : 'Scrape failed',
    });

    throw error; // Let BullMQ handle retries
  }
}

/**
 * Handle posts scraping
 */
async function handleScrapePosts(job: Job<ScrapePostsJobData>): Promise<void> {
  const { companyId, targetId, targetName, targetUrl, platform, scrapeType, scrapeJobId } = job.data;

  console.log(`📝 [Job] Scraping posts for ${targetName}: ${targetUrl}`);

  try {
    await markJobStarted(scrapeJobId);

    emitToCompany(companyId, 'scrape:started', {
      jobId: scrapeJobId,
      targetId,
      targetName,
    });

    // Update progress
    await job.updateProgress(10);

    // Scrape posts - use URL inspection like asyncScraper.ts does
    const discoverBy = getDiscoverType(targetUrl);
    console.log(`📡 [Job] Using discover_by: ${discoverBy} for URL: ${targetUrl}`);
    const results = await brightdataQueue.scrapePosts(targetUrl, discoverBy);

    console.log(`📊 [Job] Got ${results?.length || 0} results from BrightData`);
    if (results && results.length > 0) {
      const sample = results[0] as unknown as Record<string, unknown>;
      console.log(`📊 [Job] First result keys: ${Object.keys(sample).slice(0, 10).join(', ')}`);
      console.log(`📊 [Job] Has snapshot_id: ${!!sample.snapshot_id}, Has url: ${!!sample.url}, Has id: ${!!sample.id}`);
    }

    await job.updateProgress(50);

    if (!results || results.length === 0) {
      console.log(`⚠️ [Job] No posts found for ${targetName}`);
      await markJobCompleted(scrapeJobId, 0);

      emitToCompany(companyId, 'scrape:completed', {
        jobId: scrapeJobId,
        targetId,
        targetName,
        postsScraped: 0,
      });
      return;
    }

    // Check for async snapshot
    const snapshotResult = results[0] as unknown as { snapshot_id?: string };
    console.log(`🔍 [Job] Checking for snapshot_id: ${snapshotResult.snapshot_id || 'none'}`);
    if (snapshotResult.snapshot_id) {
      console.log(`⏳ [Job] BrightData returned async snapshot: ${snapshotResult.snapshot_id}`);

      // Save to pending snapshots - background checker will poll it
      await createPendingSnapshot({
        snapshotId: snapshotResult.snapshot_id,
        scrapeJobId,
        companyId,
        targetId,
        targetUrl,
        platform,
      });

      // Update progress and notify frontend
      await job.updateProgress(30);
      emitToCompany(companyId, 'scrape:progress', {
        jobId: scrapeJobId,
        progress: 30,
        message: 'Data processing started, will complete in background...',
      });

      // Job completes - background checker will handle the rest
      return;
    }

    await job.updateProgress(70);

    // Get platform ID
    const platformRecord = await prisma.platform.upsert({
      where: { name: platform },
      update: {},
      create: { name: platform },
    });

    // Process and store posts
    const postsStored = await storePosts(targetId, platformRecord.id, results);

    await job.updateProgress(90);

    // Update post count in snapshot
    await updatePostCountSnapshot(targetId, platform, postsStored);

    // Mark complete
    await markJobCompleted(scrapeJobId, postsStored);

    // Invalidate caches
    await cache.del(CacheKeys.competitors(companyId));
    await cache.del(CacheKeys.competitorDetails(targetId));
    // Invalidate analytics cache for the competitor (all platforms/ranges)
    await cache.delPattern(`analytics:${targetId}:*`);

    await job.updateProgress(100);

    emitToCompany(companyId, 'scrape:completed', {
      jobId: scrapeJobId,
      targetId,
      targetName,
      postsScraped: postsStored,
    });

    console.log(`✅ [Job] Stored ${postsStored} posts for ${targetName}`);

  } catch (error) {
    console.error(`❌ [Job] Posts scrape failed:`, error);

    await markJobFailed(scrapeJobId, error instanceof Error ? error.message : 'Unknown error');

    emitToCompany(companyId, 'scrape:failed', {
      jobId: scrapeJobId,
      targetId,
      targetName,
      error: error instanceof Error ? error.message : 'Scrape failed',
    });

    throw error;
  }
}

/**
 * Handle retry for BrightData async snapshots
 */
async function handleRetrySnapshot(job: Job<RetrySnapshotJobData>): Promise<void> {
  const { companyId, competitorId, competitorName, url, type, attemptNumber } = job.data;

  console.log(`🔄 [Job] Retry attempt ${attemptNumber} for ${competitorName}`);

  if (attemptNumber >= MAX_RETRY_ATTEMPTS) {
    console.log(`⚠️ [Job] Max retries reached for ${competitorName}`);
    emitToCompany(companyId, 'competitor:syncFailed', {
      competitorId,
      name: competitorName,
      error: 'Max retry attempts reached',
    });
    return;
  }

  try {
    let followerCount = 0;
    let profilePictureUrl: string | null = null;
    let stillAsync = false;

    if (type === 'company') {
      const results = await brightdataQueue.scrapeCompany(url);
      if (results && results.length > 0) {
        const data = results[0] as any;
        if (data.snapshot_id) {
          stillAsync = true;
        } else {
          followerCount = data.followers || 0;
          profilePictureUrl = await ensureS3Image(data.logo, competitorId, 'logo');
        }
      }
    } else {
      const results = await brightdataQueue.scrapeProfile(url);
      if (results && results.length > 0) {
        const data = results[0] as any;
        if (data.snapshot_id) {
          stillAsync = true;
        } else {
          followerCount = data.followers || data.connections || 0;
          profilePictureUrl = await ensureS3Image(data.avatar, competitorId, 'profile');
        }
      }
    }

    if (stillAsync) {
      // Schedule another retry
      await addRetrySnapshotJob({
        companyId,
        competitorId,
        competitorName,
        url,
        type,
        attemptNumber: attemptNumber + 1,
      }, 60000);
      return;
    }

    // Success - update data
    if (profilePictureUrl) {
      await prisma.company.update({
        where: { id: competitorId },
        data: { profilePictureUrl },
      });
    }

    if (followerCount > 0) {
      await updateFollowerSnapshot(competitorId, 'LinkedIn', followerCount);
    }

    // Invalidate cache
    await cache.del(CacheKeys.competitors(companyId));

    // Notify frontend
    emitToCompany(companyId, 'competitor:profileReady', {
      competitorId,
      name: competitorName,
      profilePictureUrl,
      followers: followerCount,
    });

    console.log(`✅ [Job] Retry successful for ${competitorName}: ${followerCount} followers`);

  } catch (error) {
    console.error(`❌ [Job] Retry failed:`, error);

    // Schedule another retry if we haven't maxed out
    if (attemptNumber < MAX_RETRY_ATTEMPTS - 1) {
      await addRetrySnapshotJob({
        companyId,
        competitorId,
        competitorName,
        url,
        type,
        attemptNumber: attemptNumber + 1,
      }, 60000);
    } else {
      emitToCompany(companyId, 'competitor:syncFailed', {
        competitorId,
        name: competitorName,
        error: error instanceof Error ? error.message : 'Retry failed',
      });
    }
  }
}

/**
 * Helper: Update follower count snapshot
 */
async function updateFollowerSnapshot(companyId: string, platformName: string, followerCount: number): Promise<void> {
  const platform = await prisma.platform.findUnique({
    where: { name: platformName },
  });

  if (!platform) return;

  const companyPlatform = await prisma.companyPlatform.findFirst({
    where: { companyId, platformId: platform.id },
  });

  if (!companyPlatform) return;

  await prisma.platformSnapshot.create({
    data: {
      companyId,
      platformId: companyPlatform.id,
      followerCount,
      postCount: 0,
      capturedAt: new Date(),
    },
  });
}

/**
 * Helper: Update post count in snapshot
 */
async function updatePostCountSnapshot(companyId: string, platformName: string, postCount: number): Promise<void> {
  const platform = await prisma.platform.findUnique({
    where: { name: platformName },
  });

  if (!platform) return;

  const companyPlatform = await prisma.companyPlatform.findFirst({
    where: { companyId, platformId: platform.id },
  });

  if (!companyPlatform) return;

  // Update the most recent snapshot with post count
  const latestSnapshot = await prisma.platformSnapshot.findFirst({
    where: { platformId: companyPlatform.id },
    orderBy: { capturedAt: 'desc' },
  });

  if (latestSnapshot) {
    await prisma.platformSnapshot.update({
      where: { id: latestSnapshot.id },
      data: { postCount },
    });
  }
}

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
 * Helper: Store posts from BrightData results
 * Uses correct BrightData field names: url, id, post_text, date_posted, num_likes, num_comments
 */
async function storePosts(companyId: string, platformId: string, posts: BrightDataLinkedInPost[]): Promise<number> {
  let stored = 0;
  console.log(`📦 [StorePosts] Starting to store ${posts.length} posts for ${companyId}`);

  // Sort by date (newest first) and take top 20
  const sortedPosts = [...posts]
    .sort((a, b) => new Date(b.date_posted).getTime() - new Date(a.date_posted).getTime())
    .slice(0, 20);

  console.log(`📦 [StorePosts] Processing ${sortedPosts.length} posts (sorted, sliced to 20)`);
  let skippedNoId = 0;
  let existingUpdated = 0;

  for (const post of sortedPosts) {
    try {
      // Extract post ID - handle both Posts Discovery format (id) and Company/Profile format (post_id)
      const postId = post.id || (post as unknown as { post_id?: string }).post_id || extractPostIdFromUrl(post.url);
      if (!postId) {
        skippedNoId++;
        continue;
      }

      // Check if post already exists for THIS company (unique per company)
      const existingPost = await prisma.post.findUnique({
        where: {
          companyId_platformId_platformPostId: {
            companyId,
            platformId,
            platformPostId: postId,
          },
        },
      });

      // Cast to handle both API formats
      const altFormat = post as unknown as {
        text?: string;
        post_url?: string;
        date?: string;
        likes_count?: number;
        comments_count?: number;
      };

      if (existingPost) {
        // Handle both formats for metrics update
        const likeCount = post.num_likes ?? altFormat.likes_count ?? 0;
        const commentCount = post.num_comments ?? altFormat.comments_count ?? 0;

        // Update metrics with new snapshot
        await prisma.postSnapshot.create({
          data: {
            postId: existingPost.id,
            likeCount,
            commentCount,
          },
        });
        existingUpdated++;
        continue;
      }

      // Extract fields from whichever format we have
      const captionText = post.post_text || altFormat.text || null;
      const postUrl = post.url || altFormat.post_url || '';
      const datePosted = post.date_posted || altFormat.date;
      const likeCount = post.num_likes ?? altFormat.likes_count ?? 0;
      const commentCount = post.num_comments ?? altFormat.comments_count ?? 0;

      // Create new post
      const createdPost = await prisma.post.create({
        data: {
          companyId,
          platformId,
          platformPostId: postId,
          captionText,
          postUrl,
          mediaType: determineMediaType(post),
          postedAt: datePosted ? new Date(datePosted) : new Date(),
        },
      });

      // Create initial snapshot
      await prisma.postSnapshot.create({
        data: {
          postId: createdPost.id,
          likeCount,
          commentCount,
        },
      });

      // Create post analysis
      const totalEngagement = likeCount + commentCount;
      const impressions = post.user_followers || 1000;

      await prisma.postAnalysis.create({
        data: {
          postId: createdPost.id,
          modelVersion: 'brightdata-posts-scrape-v1',
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
      console.error(`⚠️ [StorePosts] Failed to store post:`, error);
    }
  }

  console.log(`📊 [StorePosts] Summary: ${stored} new, ${existingUpdated} updated, ${skippedNoId} skipped (no ID)`);
  return stored;
}
