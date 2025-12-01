import { prisma } from '../db.js';
import {
  scrapeLinkedInPosts,
  extractLinkedInCompanySlug,
  extractLinkedInProfileSlug,
  BrightDataLinkedInPost,
} from './brightdata.js';
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
 * Store scraped posts in the database
 */
async function storePosts(
  competitorId: string,
  platformId: string,
  posts: BrightDataLinkedInPost[]
): Promise<number> {
  let storedCount = 0;

  for (const post of posts) {
    try {
      // Extract post ID - BrightData may use different field names
      // Try: id, post_id, or extract from URL
      const postId = post.id || (post as unknown as { post_id?: string }).post_id || extractPostIdFromUrl(post.url);

      if (!postId) {
        console.error(`[AsyncScraper] Cannot determine post ID. Post data:`, JSON.stringify(post, null, 2));
        continue;
      }

      // Check if post already exists
      const existingPost = await prisma.post.findUnique({
        where: {
          platformId_platformPostId: {
            platformId,
            platformPostId: postId,
          },
        },
      });

      if (existingPost) {
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

      // Create initial snapshot
      await prisma.postSnapshot.create({
        data: {
          postId: createdPost.id,
          likeCount: post.num_likes || 0,
          commentCount: post.num_comments || 0,
        },
      });

      storedCount++;
    } catch (error) {
      console.error(`[AsyncScraper] Failed to store post ${post.url}:`, error);
      // Continue with other posts
    }
  }

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
  const job = await prisma.scrapeJob.findUnique({
    where: { id: jobId },
    include: {
      targetCompany: true,
      initiatingCompany: true,
    },
  });

  if (!job) {
    console.error(`[AsyncScraper] Job ${jobId} not found`);
    return;
  }

  const { companyId, targetId, targetUrl } = job;
  const targetName = job.targetCompany.name;

  console.log(`[AsyncScraper] Starting scrape job ${jobId} for ${targetName}`);

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

    // Execute scrape with retries
    const allPosts = await executeWithRetry(jobId, companyId, () =>
      scrapeLinkedInPosts(targetUrl, discoverType)
    );

    console.log(`[AsyncScraper] Received ${allPosts.length} posts from BrightData`);

    // Sort by date (most recent first) and take only the 20 most recent
    const MAX_POSTS = 20;
    const posts = allPosts
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

      // Get follower count from scraped data or existing snapshot
      const followerCount = posts[0]?.user_followers || 0;

      await prisma.platformSnapshot.create({
        data: {
          companyId: targetId,
          platformId: companyPlatform.id,
          followerCount,
          postCount: totalPosts,
        },
      });
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
