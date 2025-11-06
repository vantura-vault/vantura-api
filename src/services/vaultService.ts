import { prisma } from '../db.js';

interface AddCompetitorInput {
  companyId: string;
  name: string;
  website?: string;
  platforms?: Array<{ platform: string; url: string }>;
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
        return {
          platform: cp.platform.name,
          url: cp.profileUrl,
          followers: latestSnapshot?.followerCount || 0
        };
      });

      const totalFollowers = platforms.reduce((sum, p) => sum + p.followers, 0);

      return {
        id: competitor.id,
        name: competitor.name,
        website: null, // Not in current schema
        platforms,
        totalFollowers
      };
    });

    return { items: competitors };
  },

  async addCompetitor(input: AddCompetitorInput) {
    const { companyId, name, platforms } = input;

    // Create the competitor company
    const competitorCompany = await prisma.company.create({
      data: {
        name,
        industry: null,
        description: null
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
        // Find or create platform
        const platform = await prisma.platform.upsert({
          where: { name: platformInput.platform },
          update: {},
          create: { name: platformInput.platform }
        });

        // Create company platform
        await prisma.companyPlatform.create({
          data: {
            companyId: competitorCompany.id,
            platformId: platform.id,
            profileUrl: platformInput.url
          }
        });
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
