import { prisma } from '../db.js';
import { brightdataQueue } from './brightdataQueue.js';
import { createScrapeJob, getPendingScrapeJobForTarget } from './scrapeJobService.js';
import { triggerAsyncScrape } from './asyncScraper.js';
import { emitToCompany } from '../websocket/wsServer.js';

interface AddCompetitorInput {
  companyId: string;
  name: string;
  website?: string;
  platforms?: Array<{ platform: string; url: string; type: 'company' | 'profile' }>;
}

export const vaultService = {
  async getCompetitors(companyId: string) {
    // Get all competitor relationships for this company
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

    return { items: competitors };
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

    // Run all scraping in background (non-blocking)
    // This allows the API to return immediately
    setImmediate(async () => {
      console.log(`🔄 [VaultService] Starting background scrape for competitor: ${name}`);

      if (platforms && platforms.length > 0) {
        for (const platformInput of platforms) {
          if (platformInput.platform !== 'LinkedIn' || !platformInput.url) continue;

          try {
            let followerCount = 0;
            let profilePictureUrl: string | null = null;
            let gotAsyncSnapshot = false;

            // Scrape profile/company data via queue
            if (platformInput.type === 'company') {
              console.log(`🔍 [Background] Queuing LinkedIn company scrape for: ${platformInput.url}`);
              const brightDataResults = await brightdataQueue.scrapeCompany(platformInput.url);

              if (brightDataResults && brightDataResults.length > 0) {
                const data = brightDataResults[0];
                if ((data as unknown as { snapshot_id?: string }).snapshot_id) {
                  console.log(`⏳ [Background] BrightData returned async snapshot for company, will retry...`);
                  gotAsyncSnapshot = true;
                } else {
                  followerCount = data.followers || 0;
                  profilePictureUrl = data.logo || null;
                  console.log(`✅ [Background] Scraped company: ${followerCount} followers`);
                }
              }
            } else if (platformInput.type === 'profile') {
              console.log(`🔍 [Background] Queuing LinkedIn profile scrape for: ${platformInput.url}`);
              const brightDataResults = await brightdataQueue.scrapeProfile(platformInput.url);

              if (brightDataResults && brightDataResults.length > 0) {
                const data = brightDataResults[0];
                if ((data as unknown as { snapshot_id?: string }).snapshot_id) {
                  console.log(`⏳ [Background] BrightData returned async snapshot for profile, will retry...`);
                  gotAsyncSnapshot = true;
                } else {
                  followerCount = data.followers || data.connections || 0;
                  profilePictureUrl = data.avatar || null;
                  console.log(`✅ [Background] Scraped profile: ${followerCount} followers`);
                }
              }
            }

            // If BrightData returned async snapshot, retry after delay
            if (gotAsyncSnapshot) {
              console.log(`🔄 [Background] Scheduling retry in 60 seconds for: ${platformInput.url}`);
              setTimeout(async () => {
                try {
                  console.log(`🔄 [Background] Retrying scrape for: ${platformInput.url}`);
                  let retryResults;
                  if (platformInput.type === 'company') {
                    retryResults = await brightdataQueue.scrapeCompany(platformInput.url);
                  } else {
                    retryResults = await brightdataQueue.scrapeProfile(platformInput.url);
                  }

                  if (retryResults && retryResults.length > 0) {
                    const data = retryResults[0] as any;
                    if (!data.snapshot_id) {
                      followerCount = data.followers || data.connections || 0;
                      profilePictureUrl = data.logo || data.avatar || null;
                      console.log(`✅ [Background] Retry succeeded: ${followerCount} followers`);

                      // Update company with scraped data
                      if (profilePictureUrl) {
                        await prisma.company.update({
                          where: { id: competitorCompany.id },
                          data: { profilePictureUrl }
                        });
                      }

                      // Update platform snapshot
                      if (followerCount > 0) {
                        const platform = await prisma.platform.findUnique({
                          where: { name: platformInput.platform }
                        });
                        if (platform) {
                          const companyPlatform = await prisma.companyPlatform.findFirst({
                            where: { companyId: competitorCompany.id, platformId: platform.id }
                          });
                          if (companyPlatform) {
                            await prisma.platformSnapshot.create({
                              data: {
                                companyId: competitorCompany.id,
                                platformId: companyPlatform.id,
                                followerCount,
                                postCount: 0,
                                capturedAt: new Date()
                              }
                            });
                          }
                        }
                      }

                      // Notify frontend
                      emitToCompany(companyId, 'competitor:profileReady', {
                        competitorId: competitorCompany.id,
                        name: competitorCompany.name,
                        profilePictureUrl,
                        followers: followerCount,
                      });
                    } else {
                      console.log(`⚠️ [Background] Retry still returned async snapshot, giving up`);
                    }
                  }
                } catch (retryError) {
                  console.error(`⚠️ [Background] Retry failed:`, retryError);
                }
              }, 60000); // Retry after 60 seconds
              continue; // Skip the rest of this iteration
            }

            // Update company with scraped data
            if (profilePictureUrl) {
              await prisma.company.update({
                where: { id: competitorCompany.id },
                data: { profilePictureUrl }
              });
            }

            // Update platform snapshot with real follower count
            if (followerCount > 0) {
              const platform = await prisma.platform.findUnique({
                where: { name: platformInput.platform }
              });

              if (platform) {
                const companyPlatform = await prisma.companyPlatform.findFirst({
                  where: {
                    companyId: competitorCompany.id,
                    platformId: platform.id
                  }
                });

                if (companyPlatform) {
                  await prisma.platformSnapshot.create({
                    data: {
                      companyId: competitorCompany.id,
                      platformId: companyPlatform.id,
                      followerCount,
                      postCount: 0,
                      capturedAt: new Date()
                    }
                  });
                }
              }
            }

            // Notify frontend that profile data is ready
            emitToCompany(companyId, 'competitor:profileReady', {
              competitorId: competitorCompany.id,
              name: competitorCompany.name,
              profilePictureUrl,
              followers: followerCount,
            });

            // Schedule posts scrape (after profile scrape completes)
            const existingJob = await getPendingScrapeJobForTarget(companyId, competitorCompany.id);
            if (!existingJob && platformInput.url) {
              const scrapeJob = await createScrapeJob({
                companyId,
                targetId: competitorCompany.id,
                targetUrl: platformInput.url,
                platform: platformInput.platform,
                scrapeType: platformInput.type === 'profile' ? 'profile' : 'company',
              });

              console.log(`⏳ [Background] Scheduling posts scrape job: ${scrapeJob.id}`);
              emitToCompany(companyId, 'scrape:scheduled', {
                jobId: scrapeJob.id,
                targetId: competitorCompany.id,
                targetName: name,
                delaySeconds: 5, // Short delay since profile scrape already completed
              });

              // Start posts scrape after short delay (profile already done via queue)
              setTimeout(() => {
                console.log(`🚀 [Background] Starting posts scrape job: ${scrapeJob.id}`);
                triggerAsyncScrape(scrapeJob.id);
              }, 5000);
            }
          } catch (error) {
            console.error(`⚠️ [Background] Failed to scrape for ${platformInput.url}:`, error);
            // Notify frontend of failure
            emitToCompany(companyId, 'competitor:syncFailed', {
              competitorId: competitorCompany.id,
              name: competitorCompany.name,
              error: error instanceof Error ? error.message : 'Scrape failed',
            });
          }
        }
      }

      console.log(`✅ [VaultService] Background scrape complete for competitor: ${name}`);
    });

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

    return {
      id: competitor.id,
      name: competitor.name,
      description: competitor.description,
      industry: competitor.industry,
      platforms,
      posts
    };
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

    console.log('✅ Competitor and all related data deleted');

    return { success: true };
  }
};
