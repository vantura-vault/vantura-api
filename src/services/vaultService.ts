import { prisma } from '../db.js';
import { scrapeLinkedInCompany, scrapeLinkedInProfile, type BrightDataLinkedInProfile } from './brightdata.js';

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

      // Calculate average engagement rate from posts with analytics
      const postsWithAnalytics = competitor.posts.filter(post => post.analysis && post.analysis.impressions > 0);
      console.log(`📈 Posts for ${competitor.name}:`, {
        totalPosts: competitor.posts.length,
        postsWithAnalytics: postsWithAnalytics.length
      });
      const averageEngagement = postsWithAnalytics.length > 0
        ? postsWithAnalytics.reduce((sum, post) => {
            const engagementRate = (post.analysis!.engagement / post.analysis!.impressions) * 100;
            return sum + engagementRate;
          }, 0) / postsWithAnalytics.length
        : 0;

      return {
        id: competitor.id,
        name: competitor.name,
        website: null, // Not in current schema
        logoUrl: competitor.profilePictureUrl,
        platforms,
        totalFollowers,
        averageEngagement
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
            if (brightDataResults && brightDataResults.length > 0) {
              brightDataCompanyData = brightDataResults[0];
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
              followerCount = brightDataProfileData.followers || brightDataProfileData.connections || 0;
              console.log(`✅ Scraped followers/connections: ${followerCount}`);
              console.log(`✅ Scraped ${brightDataProfileData.posts?.length || 0} posts`);

              // Update company logo with profile picture if available
              if (brightDataProfileData.image) {
                await prisma.company.update({
                  where: { id: competitorCompany.id },
                  data: { profilePictureUrl: brightDataProfileData.image }
                });
                console.log(`✅ Updated profile picture: ${brightDataProfileData.image}`);
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

        // Create initial snapshot with follower count (from input, BrightData, or 0)
        const postCount = (brightDataCompanyData?.updates?.length || 0) + (brightDataProfileData?.posts?.length || 0);
        await prisma.platformSnapshot.create({
          data: {
            companyId: competitorCompany.id,
            platformId: companyPlatform.id,
            followerCount,
            postCount,
            capturedAt: new Date()
          }
        });

        // If BrightData returned company posts, create Post and PostAnalysis records
        if (brightDataCompanyData?.updates && brightDataCompanyData.updates.length > 0) {
          console.log(`💾 Storing ${brightDataCompanyData.updates.length} company posts with engagement data...`);

          for (const update of brightDataCompanyData.updates) {
            try {
              // Create the post
              const post = await prisma.post.create({
                data: {
                  companyId: competitorCompany.id,
                  platformId: platform.id,
                  captionText: update.text || update.title || '',
                  postedAt: new Date(update.date || update.time),
                  platformPostId: update.post_id,
                  postUrl: update.post_url,
                  mediaType: update.images?.length ? 'image' : (update.videos?.length ? 'video' : 'text'),
                }
              });

              // Calculate engagement metrics
              const totalEngagement = (update.likes_count || 0) + (update.comments_count || 0);
              const impressions = followerCount > 0 ? followerCount : 1000; // Estimate impressions as follower count

              // Create post analysis
              await prisma.postAnalysis.create({
                data: {
                  postId: post.id,
                  modelVersion: 'brightdata-scrape-v1',
                  impressions,
                  engagement: totalEngagement,
                  topics: [],
                  summary: update.title || 'LinkedIn post',
                  entities: [],
                  captionSentiment: 0, // Neutral by default
                  positiveDescription: '',
                  imageDescription: '',
                  negativeDescription: '',
                }
              });

              // Create post snapshot for like/comment tracking
              await prisma.postSnapshot.create({
                data: {
                  postId: post.id,
                  likeCount: update.likes_count || 0,
                  commentCount: update.comments_count || 0,
                  capturedAt: new Date()
                }
              });

              console.log(`  ✓ Stored post: ${update.post_id} (${totalEngagement} engagement)`);
            } catch (postError) {
              console.warn(`  ⚠️  Failed to store post ${update.post_id}:`, postError);
              // Continue with next post
            }
          }

          console.log(`✅ Successfully stored ${brightDataCompanyData.updates.length} company posts`);
        }

        // If BrightData returned profile posts, create Post and PostAnalysis records
        if (brightDataProfileData?.posts && brightDataProfileData.posts.length > 0) {
          console.log(`💾 Storing ${brightDataProfileData.posts.length} profile posts with engagement data...`);

          for (const post of brightDataProfileData.posts) {
            try {
              // Create the post
              const postRecord = await prisma.post.create({
                data: {
                  companyId: competitorCompany.id,
                  platformId: platform.id,
                  captionText: post.text || '',
                  postedAt: new Date(post.date || post.time),
                  platformPostId: post.post_id,
                  postUrl: post.post_url,
                  mediaType: post.images?.length ? 'image' : (post.videos?.length ? 'video' : 'text'),
                }
              });

              // Calculate engagement metrics (include reposts if available)
              const totalEngagement = (post.likes_count || 0) + (post.comments_count || 0) + (post.reposts_count || 0);
              const impressions = followerCount > 0 ? followerCount : 1000; // Estimate impressions as follower/connection count

              // Create post analysis
              await prisma.postAnalysis.create({
                data: {
                  postId: postRecord.id,
                  modelVersion: 'brightdata-profile-scrape-v1',
                  impressions,
                  engagement: totalEngagement,
                  topics: [],
                  summary: 'LinkedIn profile post',
                  entities: [],
                  captionSentiment: 0, // Neutral by default
                  positiveDescription: '',
                  imageDescription: '',
                  negativeDescription: '',
                }
              });

              // Create post snapshot for like/comment tracking
              await prisma.postSnapshot.create({
                data: {
                  postId: postRecord.id,
                  likeCount: post.likes_count || 0,
                  commentCount: post.comments_count || 0,
                  capturedAt: new Date()
                }
              });

              console.log(`  ✓ Stored profile post: ${post.post_id} (${totalEngagement} engagement)`);
            } catch (postError) {
              console.warn(`  ⚠️  Failed to store profile post ${post.post_id}:`, postError);
              // Continue with next post
            }
          }

          console.log(`✅ Successfully stored ${brightDataProfileData.posts.length} profile posts`);
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

    // Delete the relationship
    await prisma.companyRelationship.delete({
      where: {
        companyAId_companyBId: {
          companyAId: companyId,
          companyBId: competitorId
        }
      }
    });

    console.log('✅ Relationship deleted');

    return { success: true };
  }
};
