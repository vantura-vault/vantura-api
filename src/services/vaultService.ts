import { prisma } from '../db.js';
import { scrapeLinkedInCompany, scrapeLinkedInProfile, type BrightDataLinkedInProfile } from './brightdata.js';
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
        totalPosts: postCount
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

    // Create the competitor company (we'll update logo after scraping)
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

    // Add platform accounts if provided
    if (platforms && platforms.length > 0) {
      for (const platformInput of platforms) {
        let followerCount = 0;
        let brightDataCompanyData = null;
        let brightDataProfileData: BrightDataLinkedInProfile | null = null;

        // If LinkedIn company URL provided, try to scrape
        if (platformInput.platform === 'LinkedIn' && platformInput.url && platformInput.type === 'company') {
          try {
            console.log(`🔍 Scraping LinkedIn company data for: ${platformInput.url}`);
            const brightDataResults = await scrapeLinkedInCompany(platformInput.url);
            console.log(`🔍 BrightData company response:`, JSON.stringify(brightDataResults[0], null, 2).substring(0, 500));
            if (brightDataResults && brightDataResults.length > 0) {
              brightDataCompanyData = brightDataResults[0];

              // Check for async snapshot response - skip if BrightData is still processing
              if ((brightDataCompanyData as unknown as { snapshot_id?: string }).snapshot_id) {
                console.warn(`⚠️  BrightData returned async snapshot, data not immediately available`);
                console.warn(`⚠️  Snapshot ID: ${(brightDataCompanyData as unknown as { snapshot_id: string }).snapshot_id}`);
                brightDataCompanyData = null; // Reset to avoid using invalid data
              } else {
                followerCount = brightDataCompanyData.followers || 0;
                console.log(`✅ Scraped follower count: ${followerCount}`);
                console.log(`✅ Scraped ${brightDataCompanyData.updates?.length || 0} posts`);

                // Update company logo if available
                if (brightDataCompanyData.logo) {
                  await prisma.company.update({
                    where: { id: competitorCompany.id },
                    data: { profilePictureUrl: brightDataCompanyData.logo }
                  });
                  console.log(`✅ Updated company logo: ${brightDataCompanyData.logo}`);
                }
              }
            }
          } catch (error) {
            console.warn(`⚠️  Failed to scrape LinkedIn company data, using default: ${error}`);
            // Continue with followerCount = 0
          }
        }

        // If LinkedIn profile URL provided, try to scrape (note: this may take 3-5 minutes)
        if (platformInput.platform === 'LinkedIn' && platformInput.url && platformInput.type === 'profile') {
          try {
            console.log(`🔍 Scraping LinkedIn profile data for: ${platformInput.url}`);
            console.log(`⏳ Note: Profile scraping may take 1-2 minutes...`);
            const brightDataResults = await scrapeLinkedInProfile(platformInput.url);
            console.log(`🔍 BrightData raw response:`, JSON.stringify(brightDataResults, null, 2));
            if (brightDataResults && brightDataResults.length > 0) {
              brightDataProfileData = brightDataResults[0];

              // Check for async snapshot response - skip if BrightData is still processing
              if ((brightDataProfileData as unknown as { snapshot_id?: string }).snapshot_id) {
                console.warn(`⚠️  BrightData returned async snapshot for profile, data not immediately available`);
                console.warn(`⚠️  Snapshot ID: ${(brightDataProfileData as unknown as { snapshot_id: string }).snapshot_id}`);
                brightDataProfileData = null; // Reset to avoid using invalid data
              } else {
                followerCount = brightDataProfileData.followers || brightDataProfileData.connections || 0;
                console.log(`✅ Scraped followers/connections: ${followerCount}`);
                console.log(`✅ Scraped ${brightDataProfileData.posts?.length || 0} posts`);

                // Update company logo with profile picture if available
                if (brightDataProfileData.avatar) {
                  await prisma.company.update({
                    where: { id: competitorCompany.id },
                    data: { profilePictureUrl: brightDataProfileData.avatar }
                  });
                  console.log(`✅ Updated profile picture: ${brightDataProfileData.avatar}`);
                }
              }
            }
          } catch (error) {
            console.warn(`⚠️  Failed to scrape LinkedIn profile data, using default: ${error}`);
            // Continue with followerCount = 0
          }
        }

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

        // Create initial snapshot with follower count (posts will come from async Posts API)
        await prisma.platformSnapshot.create({
          data: {
            companyId: competitorCompany.id,
            platformId: companyPlatform.id,
            followerCount,
            postCount: 0, // Posts will be populated by the Posts Discovery API
            capturedAt: new Date()
          }
        });

        // Note: We intentionally do NOT save posts from the Company/Profile APIs here.
        // Posts are fetched separately via the Posts Discovery API (async scraper)
        // to get more comprehensive and accurate post data.

        // Trigger async posts scrape via Posts Discovery API
        // Add a delay to avoid rate-limiting from BrightData (they don't like rapid consecutive requests)
        const POSTS_SCRAPE_DELAY_MS = 30000; // 30 second delay
        const existingJob = await getPendingScrapeJobForTarget(companyId, competitorCompany.id);
        if (!existingJob && platformInput.url) {
          try {
            const scrapeJob = await createScrapeJob({
              companyId,
              targetId: competitorCompany.id,
              targetUrl: platformInput.url,
              platform: platformInput.platform,
              scrapeType: platformInput.type === 'profile' ? 'profile' : 'company',
            });

            // Delay the posts scrape to avoid BrightData rate limiting
            console.log(`⏳ [AsyncScrape] Scheduling posts scrape job in ${POSTS_SCRAPE_DELAY_MS / 1000}s to avoid rate limiting...`);

            // Notify frontend that posts scrape is scheduled
            emitToCompany(companyId, 'scrape:scheduled', {
              jobId: scrapeJob.id,
              targetId: competitorCompany.id,
              targetName: name,
              delaySeconds: POSTS_SCRAPE_DELAY_MS / 1000,
            });

            setTimeout(() => {
              console.log(`🚀 [AsyncScrape] Starting delayed posts scrape job: ${scrapeJob.id} for ${platformInput.url}`);
              triggerAsyncScrape(scrapeJob.id);
            }, POSTS_SCRAPE_DELAY_MS);
          } catch (scrapeError) {
            console.error(`⚠️ [AsyncScrape] Failed to create scrape job:`, scrapeError);
            // Don't fail the whole operation
          }
        }
      }
    }

    return {
      id: competitorCompany.id,
      name: competitorCompany.name,
      website: null,
      platforms: platforms || [],
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
