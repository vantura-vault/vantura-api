import { prisma } from '../db.js';
import {
  extractLinkedInCompanySlug,
  extractLinkedInProfileSlug,
  BrightDataLinkedInPost,
} from './brightdata.js';
import { brightdataQueue } from './brightdataQueue.js';
import {
  markJobStarted,
  markJobCompleted,
  markJobFailed,
  updateScrapeJob,
} from './scrapeJobService.js';
import { emitToCompany } from '../websocket/wsServer.js';

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 5000;

/**
 * Helper function to sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extract post ID from LinkedIn post URL
 * Example: https://www.linkedin.com/posts/openai_...activity-7400624294864801792-xxx
 */
function extractPostIdFromUrl(url: string): string | null {
  if (!url) return null;
  // Match activity ID from URL (e.g., activity-7400624294864801792)
  const activityMatch = url.match(/activity-(\d+)/);
  if (activityMatch) return activityMatch[1];
  // Match URN format (e.g., urn:li:activity:7400624294864801792)
  const urnMatch = url.match(/urn:li:activity:(\d+)/);
  if (urnMatch) return urnMatch[1];
  return null;
}

/**
 * Determine the discover_by type based on URL
 */
function getDiscoverType(url: string): 'company_url' | 'profile_url' {
  if (extractLinkedInCompanySlug(url)) {
    return 'company_url';
  } else if (extractLinkedInProfileSlug(url)) {
    return 'profile_url';
  }
  // Default to company_url
  return 'company_url';
}

/**
 * Determine media type from post data
 */
function determineMediaType(post: BrightDataLinkedInPost): string {
  if (post.videos && post.videos.length > 0) {
    return 'video';
  }
  if (post.images && post.images.length > 1) {
    return 'carousel';
  }
  if (post.images && post.images.length === 1) {
    return 'image';
  }
  if (post.document_cover_image) {
    return 'document';
  }
  return 'text';
}

/**
 * Check if the response is an async snapshot response instead of actual data
 */
function isAsyncSnapshotResponse(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  const obj = data as Record<string, unknown>;
  return 'snapshot_id' in obj && typeof obj.snapshot_id === 'string';
}

/**
 * Store scraped posts in the database
 */
async function storePosts(
  competitorId: string,
  platformId: string,
  posts: BrightDataLinkedInPost[]
): Promise<number> {
  let storedCount = 0;
  console.log(`\n📦 [StorePosts] Starting to store ${posts.length} posts for competitor ${competitorId}`);

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    console.log(`\n📝 [StorePosts] Processing post ${i + 1}/${posts.length}`);

    try {
      // Check if this is an async snapshot response instead of actual post data
      if (isAsyncSnapshotResponse(post)) {
        console.warn(`  ⏳ Skipping async snapshot response:`, (post as unknown as { snapshot_id: string }).snapshot_id);
        continue;
      }

      // Extract post ID - BrightData may use different field names
      // Try: id, post_id, or extract from URL
      const postId = post.id || (post as unknown as { post_id?: string }).post_id || extractPostIdFromUrl(post.url);
      console.log(`  🔑 Post ID: ${postId || 'NOT FOUND'}`);
      console.log(`  🔗 URL: ${post.url?.substring(0, 80)}...`);
      console.log(`  📅 Date: ${post.date_posted}`);

      if (!postId) {
        console.error(`  ❌ Cannot determine post ID. Raw post data:`, JSON.stringify(post, null, 2).substring(0, 500));
        continue;
      }

      // Check if post already exists
      console.log(`  🔍 Checking if post exists in DB...`);
      const existingPost = await prisma.post.findUnique({
        where: {
          platformId_platformPostId: {
            platformId,
            platformPostId: postId,
          },
        },
      });

      if (existingPost) {
        console.log(`  ⏭️  Post already exists (${existingPost.id}), updating snapshot`);
        // Update metrics with a new snapshot
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
      console.log(`  ✨ Creating new post record...`);
      console.log(`    - Caption: ${post.post_text?.substring(0, 60) || 'null'}...`);
      console.log(`    - Media type: ${determineMediaType(post)}`);
      console.log(`    - Likes: ${post.num_likes}, Comments: ${post.num_comments}`);

      const createdPost = await prisma.post.create({
        data: {
          companyId: competitorId,
          platformId,
          platformPostId: postId,
          captionText: post.post_text || null,
          postUrl: post.url,
          mediaType: determineMediaType(post),
          postedAt: new Date(post.date_posted),
        },
      });
      console.log(`  ✅ Post created: ${createdPost.id}`);

      // Create initial snapshot
      await prisma.postSnapshot.create({
        data: {
          postId: createdPost.id,
          likeCount: post.num_likes || 0,
          commentCount: post.num_comments || 0,
        },
      });
      console.log(`  ✅ PostSnapshot created`);

      // Create post analysis for engagement calculation
      const totalEngagement = (post.num_likes || 0) + (post.num_comments || 0);
      const impressions = post.user_followers || 1000; // Use follower count as proxy for impressions

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
      console.log(`  ✅ PostAnalysis created (engagement: ${totalEngagement}, impressions: ${impressions})`);

      storedCount++;
    } catch (error) {
      console.error(`  ❌ Failed to store post:`, error);
      // Continue with other posts
    }
  }

  console.log(`\n📊 [StorePosts] Finished. Stored ${storedCount} new posts out of ${posts.length} total`);
  return storedCount;
}

/**
 * Execute the scrape with retry logic
 */
async function executeWithRetry(
  jobId: string,
  companyId: string,
  fn: () => Promise<BrightDataLinkedInPost[]>
): Promise<BrightDataLinkedInPost[]> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      console.error(`[AsyncScraper] Attempt ${attempt}/${MAX_RETRIES} failed:`, error);

      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS * attempt);
        emitToCompany(companyId, 'scrape:progress', {
          jobId,
          progress: 20 + (attempt * 10),
          message: `Retrying... (attempt ${attempt + 1}/${MAX_RETRIES})`,
        });
      }
    }
  }

  throw lastError;
}

/**
 * Start an async scrape job
 * This function runs in the background and emits WebSocket events
 */
export async function startAsyncScrape(jobId: string): Promise<void> {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🚀 [AsyncScraper] STARTING JOB: ${jobId}`);
  console.log(`${'='.repeat(60)}`);

  const job = await prisma.scrapeJob.findUnique({
    where: { id: jobId },
    include: {
      targetCompany: true,
      initiatingCompany: true,
    },
  });

  if (!job) {
    console.error(`❌ [AsyncScraper] Job ${jobId} not found`);
    return;
  }

  const { companyId, targetId, targetUrl } = job;
  const targetName = job.targetCompany.name;

  console.log(`📋 Job Details:`);
  console.log(`   - Target: ${targetName} (${targetId})`);
  console.log(`   - URL: ${targetUrl}`);
  console.log(`   - Initiating Company: ${companyId}`);

  try {
    // Mark job as started
    await markJobStarted(jobId);
    emitToCompany(companyId, 'scrape:started', {
      jobId,
      targetId,
      targetName,
    });

    // Determine discover type
    const discoverType = getDiscoverType(targetUrl);
    console.log(`[AsyncScraper] Using discover_by: ${discoverType} for ${targetUrl}`);

    // Update progress
    await updateScrapeJob(jobId, { progress: 30 });
    emitToCompany(companyId, 'scrape:progress', {
      jobId,
      progress: 30,
      message: 'Fetching posts from LinkedIn...',
    });

    // Execute scrape with retries (via queue to avoid rate limiting)
    console.log(`\n📡 [AsyncScraper] Queuing BrightData Posts Discovery API call...`);
    const allPosts = await executeWithRetry(jobId, companyId, () =>
      brightdataQueue.scrapePosts(targetUrl, discoverType)
    );

    console.log(`\n📥 [AsyncScraper] BrightData Response:`);
    console.log(`   - Total items received: ${allPosts.length}`);

    // Log first post sample for debugging
    if (allPosts.length > 0) {
      const sample = allPosts[0];
      console.log(`   - First item sample:`);
      console.log(`     - id: ${sample.id || 'undefined'}`);
      console.log(`     - url: ${sample.url?.substring(0, 60) || 'undefined'}...`);
      console.log(`     - date_posted: ${sample.date_posted || 'undefined'}`);
      console.log(`     - num_likes: ${sample.num_likes}`);
      console.log(`     - snapshot_id: ${(sample as unknown as { snapshot_id?: string }).snapshot_id || 'none'}`);
    }

    // Check if BrightData returned async snapshot responses instead of actual data
    let postsToProcess = allPosts;
    const asyncSnapshots = allPosts.filter(p => isAsyncSnapshotResponse(p));
    if (asyncSnapshots.length > 0) {
      console.warn(`\n⚠️  [AsyncScraper] ${asyncSnapshots.length} async snapshot responses detected`);
      if (asyncSnapshots.length === allPosts.length) {
        // All responses are async snapshots - retry after delay
        console.log(`⏳ [AsyncScraper] ALL responses are async snapshots - will retry in 60 seconds...`);

        await updateScrapeJob(jobId, { progress: 40 });
        emitToCompany(companyId, 'scrape:progress', {
          jobId,
          progress: 40,
          message: 'BrightData is processing... retrying in 60s',
        });

        // Wait 60 seconds and retry
        await sleep(60000);

        console.log(`🔄 [AsyncScraper] Retrying posts scrape after delay...`);
        emitToCompany(companyId, 'scrape:progress', {
          jobId,
          progress: 45,
          message: 'Retrying posts fetch...',
        });

        try {
          const retryPosts = await brightdataQueue.scrapePosts(targetUrl, discoverType);
          const retryAsyncSnapshots = retryPosts.filter(p => isAsyncSnapshotResponse(p));

          if (retryAsyncSnapshots.length === retryPosts.length) {
            // Still all async snapshots after retry - give up
            console.warn(`❌ [AsyncScraper] Retry still returned async snapshots - giving up`);
            await markJobFailed(jobId, 'BrightData data not ready after retry. Please try again later.');
            emitToCompany(companyId, 'scrape:failed', {
              jobId,
              targetId,
              error: 'Posts data still processing. Please try again in a few minutes.',
            });
            return;
          }

          // Use retry results
          postsToProcess = retryPosts;
          console.log(`✅ [AsyncScraper] Retry succeeded with ${retryPosts.length} posts`);
        } catch (retryError) {
          console.error(`❌ [AsyncScraper] Retry failed:`, retryError);
          await markJobFailed(jobId, 'Retry failed: ' + (retryError instanceof Error ? retryError.message : 'Unknown error'));
          emitToCompany(companyId, 'scrape:failed', {
            jobId,
            targetId,
            error: 'Failed to fetch posts after retry.',
          });
          return;
        }
      }
    }

    // Filter out async snapshot responses to get actual posts
    const validPosts = postsToProcess.filter(p => !isAsyncSnapshotResponse(p));
    console.log(`\n✅ [AsyncScraper] Valid posts after filtering: ${validPosts.length}`);

    // Sort by date (most recent first) and take only the 20 most recent
    const MAX_POSTS = 20;
    const posts = validPosts
      .sort((a, b) => new Date(b.date_posted).getTime() - new Date(a.date_posted).getTime())
      .slice(0, MAX_POSTS);

    console.log(`[AsyncScraper] Processing ${posts.length} most recent posts (limit: ${MAX_POSTS})`);

    // Update progress
    await updateScrapeJob(jobId, { progress: 60 });
    emitToCompany(companyId, 'scrape:progress', {
      jobId,
      progress: 60,
      message: `Processing ${posts.length} posts...`,
    });

    // Get LinkedIn platform ID
    let linkedInPlatform = await prisma.platform.findUnique({
      where: { name: 'LinkedIn' },
    });

    if (!linkedInPlatform) {
      linkedInPlatform = await prisma.platform.create({
        data: { name: 'LinkedIn' },
      });
    }

    // Store posts
    const storedCount = await storePosts(targetId, linkedInPlatform.id, posts);

    console.log(`[AsyncScraper] Stored ${storedCount} new posts for ${targetName}`);

    // Update progress
    await updateScrapeJob(jobId, { progress: 90 });
    emitToCompany(companyId, 'scrape:progress', {
      jobId,
      progress: 90,
      message: 'Finalizing...',
    });

    // Update platform snapshot with new post count
    const companyPlatform = await prisma.companyPlatform.findFirst({
      where: {
        companyId: targetId,
        platformId: linkedInPlatform.id,
      },
    });

    if (companyPlatform) {
      const totalPosts = await prisma.post.count({
        where: {
          companyId: targetId,
          platformId: linkedInPlatform.id,
        },
      });

      // Get the existing follower count from the most recent snapshot
      // Don't overwrite with unreliable data from posts API
      const existingSnapshot = await prisma.platformSnapshot.findFirst({
        where: {
          companyId: targetId,
          platformId: companyPlatform.id,
        },
        orderBy: { capturedAt: 'desc' },
      });

      const followerCount = existingSnapshot?.followerCount || 0;

      // Only create a new snapshot if the post count changed
      if (!existingSnapshot || existingSnapshot.postCount !== totalPosts) {
        await prisma.platformSnapshot.create({
          data: {
            companyId: targetId,
            platformId: companyPlatform.id,
            followerCount, // Preserve existing follower count
            postCount: totalPosts,
          },
        });
        console.log(`✅ [AsyncScraper] Created snapshot with ${followerCount} followers, ${totalPosts} posts`);
      }
    }

    // Mark job as completed
    await markJobCompleted(jobId, storedCount);
    emitToCompany(companyId, 'scrape:completed', {
      jobId,
      targetId,
      postsScraped: storedCount,
    });

    console.log(`[AsyncScraper] Job ${jobId} completed: ${storedCount} posts scraped`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    console.error(`[AsyncScraper] Job ${jobId} failed:`, error);

    await markJobFailed(jobId, errorMessage);
    emitToCompany(companyId, 'scrape:failed', {
      jobId,
      targetId,
      error: errorMessage,
    });
  }
}

/**
 * Trigger an async scrape job (non-blocking)
 * This schedules the scrape to run in the background using setImmediate
 */
export function triggerAsyncScrape(jobId: string): void {
  setImmediate(() => {
    startAsyncScrape(jobId).catch((error) => {
      console.error(`[AsyncScraper] Unhandled error in async scrape:`, error);
    });
  });
}
