import { prisma } from '../db.js';
import { emitToCompany } from '../websocket/wsServer.js';
import { cache, CacheKeys, CacheTTL } from './cache.js';
import { addScrapeProfileJob, isJobQueueAvailable } from './jobQueue.js';

// Fallback imports for when job queue is not available
import { brightdataQueue } from './brightdataQueue.js';
import { createScrapeJob, getPendingScrapeJobForTarget } from './scrapeJobService.js';
import { triggerAsyncScrape } from './asyncScraper.js';
import { ensureS3Image } from './imageStorage.js';

interface AddCompetitorInput {
  companyId: string;
  name: string;
  website?: string;
  platforms?: Array<{ platform: string; url: string; type: 'company' | 'profile' }>;
}

export const vaultService = {
  async getCompetitors(companyId: string) {
    const cacheKey = CacheKeys.competitors(companyId);

    // Try cache first
    const cached = await cache.get<{ items: any[] }>(cacheKey);
    if (cached) {
      return cached;
    }

    // Cache miss - fetch from database
    const relationships = await prisma.companyRelationship.findMany({
      where: {
        companyAId: companyId,
        relationshipType: 'competitor'
      },
      include: {
        companyB: {
          include: {
            platforms: {
              include: {
                platform: true,
                snapshots: {
                  orderBy: {
                    capturedAt: 'desc'
                  },
                  take: 1
                }
              }
            },
            posts: {
              include: {
                analysis: true
              },
              orderBy: {
                postedAt: 'desc'
              },
              take: 20 // Get last 20 posts for engagement calculation
            }
          }
        }
      }
    });

    // Transform to expected format
    const competitors = relationships.map(rel => {
      const competitor = rel.companyB;

      const platforms = competitor.platforms.map(cp => {
        const latestSnapshot = cp.snapshots[0];
        console.log(`📊 Platform ${cp.platform.name} for ${competitor.name}:`, {
          hasSnapshot: !!latestSnapshot,
          followerCount: latestSnapshot?.followerCount,
          snapshotDate: latestSnapshot?.capturedAt
        });
        return {
          platform: cp.platform.name,
          url: cp.profileUrl,
          followers: latestSnapshot?.followerCount || 0
        };
      });

      const totalFollowers = platforms.reduce((sum, p) => sum + p.followers, 0);
      const postCount = competitor.posts.length;

      console.log(`📈 Posts for ${competitor.name}:`, {
        totalPosts: postCount,
        profilePictureUrl: competitor.profilePictureUrl || 'NOT SET'
      });

      return {
        id: competitor.id,
        name: competitor.name,
        website: null, // Not in current schema
        logoUrl: competitor.profilePictureUrl,
        platforms,
        totalFollowers,
        postCount
      };
    });

    const result = { items: competitors };

    // Cache the result
    await cache.set(cacheKey, result, CacheTTL.competitors);

    return result;
  },

  async addCompetitor(input: AddCompetitorInput) {
    const { companyId, name, platforms } = input;

    // Create the competitor company immediately (syncing status)
    const competitorCompany = await prisma.company.create({
      data: {
        name,
        industry: null,
        description: null,
        profilePictureUrl: null
      }
    });

    // Link as competitor
    await prisma.companyRelationship.create({
      data: {
        companyAId: companyId,
        companyBId: competitorCompany.id,
        relationshipType: 'competitor'
      }
    });

    // Invalidate competitors cache for this company
    await cache.del(CacheKeys.competitors(companyId));

    // Set up platform records immediately (with 0 followers - will be updated by background scrape)
    if (platforms && platforms.length > 0) {
      for (const platformInput of platforms) {
        // Find or create platform
        const platform = await prisma.platform.upsert({
          where: { name: platformInput.platform },
          update: {},
          create: { name: platformInput.platform }
        });

        // Create company platform
        const companyPlatform = await prisma.companyPlatform.create({
          data: {
            companyId: competitorCompany.id,
            platformId: platform.id,
            profileUrl: platformInput.url
          }
        });

        // Create initial snapshot with 0 followers (will be updated by background scrape)
        await prisma.platformSnapshot.create({
          data: {
            companyId: competitorCompany.id,
            platformId: companyPlatform.id,
            followerCount: 0,
            postCount: 0,
            capturedAt: new Date()
          }
        });
      }
    }

    // Notify frontend that competitor was added (syncing in background)
    emitToCompany(companyId, 'competitor:added', {
      competitorId: competitorCompany.id,
      name: competitorCompany.name,
      syncing: true,
    });

    // Queue background scraping jobs
    if (platforms && platforms.length > 0) {
      for (const platformInput of platforms) {
        if (platformInput.platform !== 'LinkedIn' || !platformInput.url) continue;

        // Use BullMQ job queue if available, otherwise fall back to legacy approach
        if (isJobQueueAvailable()) {
          console.log(`📋 [VaultService] Queuing scrape job for competitor: ${name}`);
          await addScrapeProfileJob({
            companyId,
            competitorId: competitorCompany.id,
            competitorName: name,
            url: platformInput.url,
            type: platformInput.type,
          });
        } else {
          // Fallback: use legacy setImmediate approach when Redis not available
          console.log(`⚠️ [VaultService] Job queue not available, using legacy approach`);
          this._legacyScrapeCompetitor(
            companyId,
            competitorCompany.id,
            name,
            platformInput
          );
        }
      }
    }

    // Return immediately - don't wait for scraping
    return {
      id: competitorCompany.id,
      name: competitorCompany.name,
      website: null,
      platforms: platforms || [],
      syncing: true, // Indicate that background sync is in progress
    };
  },

  async getCompetitorDetails(competitorId: string, companyId: string) {
    const cacheKey = CacheKeys.competitorDetails(competitorId);

    // Try cache first
    const cached = await cache.get<any>(cacheKey);
    if (cached) {
      return cached;
    }

    // Verify the competitor relationship exists
    const relationship = await prisma.companyRelationship.findFirst({
      where: {
        companyAId: companyId,
        companyBId: competitorId,
        relationshipType: 'competitor'
      }
    });

    if (!relationship) {
      throw new Error('Competitor not found');
    }

    // Get competitor company with platforms and posts
    const competitor = await prisma.company.findUnique({
      where: { id: competitorId },
      include: {
        platforms: {
          include: {
            platform: true,
            snapshots: {
              orderBy: { capturedAt: 'desc' },
              take: 90 // Last 90 days
            }
          }
        },
        posts: {
          include: {
            platform: true,
            analysis: true,
            metricsSnapshots: {
              orderBy: { capturedAt: 'desc' },
              take: 1
            }
          },
          orderBy: { postedAt: 'desc' },
          take: 20
        }
      }
    });

    if (!competitor) {
      throw new Error('Competitor not found');
    }

    // Transform platforms with snapshots
    const platforms = competitor.platforms.map(cp => ({
      platform: cp.platform.name,
      profileUrl: cp.profileUrl,
      currentFollowers: cp.snapshots[0]?.followerCount || 0,
      snapshots: cp.snapshots.map(s => ({
        date: s.capturedAt,
        followers: s.followerCount,
        posts: s.postCount || 0
      }))
    }));

    // Transform posts
    const posts = competitor.posts.map(post => {
      const latestSnapshot = post.metricsSnapshots[0];
      return {
        id: post.id,
        platform: post.platform.name,
        content: post.captionText || '',
        postedAt: post.postedAt,
        impressions: post.analysis?.impressions || 0,
        likes: latestSnapshot?.likeCount || 0,
        comments: latestSnapshot?.commentCount || 0,
        engagement: post.analysis?.engagement || 0,
        engagementRate: post.analysis ?
          ((post.analysis.engagement / post.analysis.impressions) * 100).toFixed(2) : '0'
      };
    });

    const result = {
      id: competitor.id,
      name: competitor.name,
      description: competitor.description,
      industry: competitor.industry,
      platforms,
      posts
    };

    // Cache the result
    await cache.set(cacheKey, result, CacheTTL.competitorDetails);

    return result;
  },

  async deleteCompetitor(competitorId: string, companyId: string) {
    console.log('🔍 Searching for relationship:', {
      companyAId: companyId,
      companyBId: competitorId,
      relationshipType: 'competitor'
    });

    // Verify the relationship exists before deleting
    const relationship = await prisma.companyRelationship.findFirst({
      where: {
        companyAId: companyId,
        companyBId: competitorId,
        relationshipType: 'competitor'
      }
    });

    console.log('🔍 Relationship found:', relationship);

    if (!relationship) {
      // Check if relationship exists in reverse
      const reverseRelationship = await prisma.companyRelationship.findFirst({
        where: {
          companyAId: competitorId,
          companyBId: companyId,
          relationshipType: 'competitor'
        }
      });
      console.log('🔍 Reverse relationship:', reverseRelationship);

      throw new Error('Competitor relationship not found');
    }

    // Delete the competitor Company record
    // This cascades to delete: Posts, PostAnalysis, PostSnapshots,
    // CompanyPlatforms, PlatformSnapshots, CompanyRelationships, ScrapeJobs
    await prisma.company.delete({
      where: { id: competitorId }
    });

    // Invalidate competitors cache and competitor details cache
    await cache.del(CacheKeys.competitors(companyId));
    await cache.del(CacheKeys.competitorDetails(competitorId));

    console.log('✅ Competitor and all related data deleted');

    return { success: true };
  },

  /**
   * Legacy scrape method - used when job queue is not available
   * Keeps the old setImmediate/setTimeout approach as fallback
   */
  _legacyScrapeCompetitor(
    companyId: string,
    competitorId: string,
    competitorName: string,
    platformInput: { platform: string; url: string; type: 'company' | 'profile' }
  ) {
    setImmediate(async () => {
      console.log(`🔄 [Legacy] Starting background scrape for competitor: ${competitorName}`);

      try {
        let followerCount = 0;
        let profilePictureUrl: string | null = null;
        let gotAsyncSnapshot = false;

        // Scrape profile/company data via queue
        if (platformInput.type === 'company') {
          console.log(`🔍 [Legacy] Queuing LinkedIn company scrape for: ${platformInput.url}`);
          const brightDataResults = await brightdataQueue.scrapeCompany(platformInput.url);

          if (brightDataResults && brightDataResults.length > 0) {
            const data = brightDataResults[0];
            if ((data as unknown as { snapshot_id?: string }).snapshot_id) {
              console.log(`⏳ [Legacy] BrightData returned async snapshot for company`);
              gotAsyncSnapshot = true;
            } else {
              followerCount = data.followers || 0;
              profilePictureUrl = await ensureS3Image(data.logo, competitorId, 'logo');
              console.log(`✅ [Legacy] Scraped company: ${followerCount} followers`);
            }
          }
        } else {
          console.log(`🔍 [Legacy] Queuing LinkedIn profile scrape for: ${platformInput.url}`);
          const brightDataResults = await brightdataQueue.scrapeProfile(platformInput.url);

          if (brightDataResults && brightDataResults.length > 0) {
            const data = brightDataResults[0];
            if ((data as unknown as { snapshot_id?: string }).snapshot_id) {
              console.log(`⏳ [Legacy] BrightData returned async snapshot for profile`);
              gotAsyncSnapshot = true;
            } else {
              followerCount = data.followers || data.connections || 0;
              profilePictureUrl = await ensureS3Image(data.avatar, competitorId, 'profile');
              console.log(`✅ [Legacy] Scraped profile: ${followerCount} followers`);
            }
          }
        }

        // Handle async snapshot with retry
        if (gotAsyncSnapshot) {
          console.log(`🔄 [Legacy] Scheduling retry in 60 seconds`);
          setTimeout(async () => {
            try {
              let retryResults;
              if (platformInput.type === 'company') {
                retryResults = await brightdataQueue.scrapeCompany(platformInput.url);
              } else {
                retryResults = await brightdataQueue.scrapeProfile(platformInput.url);
              }

              if (retryResults && retryResults.length > 0) {
                const data = retryResults[0] as any;
                if (!data.snapshot_id) {
                  const fc = data.followers || data.connections || 0;
                  const imgUrl = await ensureS3Image(data.logo || data.avatar, competitorId, 'logo');

                  if (imgUrl) {
                    await prisma.company.update({
                      where: { id: competitorId },
                      data: { profilePictureUrl: imgUrl }
                    });
                  }

                  if (fc > 0) {
                    await this._updateFollowerSnapshot(competitorId, platformInput.platform, fc);
                  }

                  emitToCompany(companyId, 'competitor:profileReady', {
                    competitorId,
                    name: competitorName,
                    profilePictureUrl: imgUrl,
                    followers: fc,
                  });
                }
              }
            } catch (err) {
              console.error(`⚠️ [Legacy] Retry failed:`, err);
            }
          }, 60000);
          return;
        }

        // Update company with scraped data
        if (profilePictureUrl) {
          await prisma.company.update({
            where: { id: competitorId },
            data: { profilePictureUrl }
          });
        }

        if (followerCount > 0) {
          await this._updateFollowerSnapshot(competitorId, platformInput.platform, followerCount);
        }

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
            targetUrl: platformInput.url,
            platform: platformInput.platform,
            scrapeType: platformInput.type,
          });

          setTimeout(() => {
            triggerAsyncScrape(scrapeJob.id);
          }, 5000);
        }
      } catch (error) {
        console.error(`⚠️ [Legacy] Failed to scrape:`, error);
        emitToCompany(companyId, 'competitor:syncFailed', {
          competitorId,
          name: competitorName,
          error: error instanceof Error ? error.message : 'Scrape failed',
        });
      }
    });
  },

  /**
   * Helper to update follower snapshot
   */
  async _updateFollowerSnapshot(companyId: string, platformName: string, followerCount: number) {
    const platform = await prisma.platform.findUnique({
      where: { name: platformName }
    });

    if (!platform) return;

    const companyPlatform = await prisma.companyPlatform.findFirst({
      where: { companyId, platformId: platform.id }
    });

    if (!companyPlatform) return;

    await prisma.platformSnapshot.create({
      data: {
        companyId,
        platformId: companyPlatform.id,
        followerCount,
        postCount: 0,
        capturedAt: new Date()
      }
    });
  }
};
