import { prisma } from '../config/database';

export interface AddCompetitorDTO {
  name: string;
  industry?: string;
  description?: string;
  platforms: {
    platformName: string;
    profileUrl: string;
  }[];
}

export const competitorService = {
  /**
   * Add a competitor to your company
   */
  async addCompetitor(userId: string, data: AddCompetitorDTO) {
    // Get user's company
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user?.companyId) {
      throw new Error('User must belong to a company to add competitors');
    }

    // Validate at least one platform
    if (!data.platforms || data.platforms.length === 0) {
      throw new Error('At least one platform is required');
    }

    // Create the competitor company
    const competitorCompany = await prisma.company.create({
      data: {
        name: data.name,
        industry: data.industry,
        description: data.description
      }
    });

    // Get or create platforms and link them
    const platformIds = await Promise.all(
      data.platforms.map(async (p) => {
        let platform = await prisma.platform.findUnique({
          where: { name: p.platformName }
        });

        if (!platform) {
          platform = await prisma.platform.create({
            data: { name: p.platformName }
          });
        }

        return {
          platformId: platform.id,
          profileUrl: p.profileUrl
        };
      })
    );

    // Create company-platform links
    await prisma.companyPlatform.createMany({
      data: platformIds.map((p) => ({
        companyId: competitorCompany.id,
        platformId: p.platformId,
        profileUrl: p.profileUrl
      }))
    });

    // Create relationship (your company -> competitor)
    const relationship = await prisma.companyRelationship.create({
      data: {
        companyAId: user.companyId,
        companyBId: competitorCompany.id,
        relationshipType: 'competitor'
      }
    });

    // Fetch complete competitor data
    const competitor = await prisma.company.findUnique({
      where: { id: competitorCompany.id },
      include: {
        platforms: {
          include: {
            platform: true
          }
        }
      }
    });

    return {
      relationship,
      competitor
    };
  },

  /**
   * List all competitors for a company
   */
  async listCompetitors(userId: string) {
    // Get user's company
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user?.companyId) {
      throw new Error('User must belong to a company');
    }

    // Get all competitor relationships
    const relationships = await prisma.companyRelationship.findMany({
      where: {
        companyAId: user.companyId,
        relationshipType: 'competitor'
      },
      include: {
        companyB: {
          include: {
            platforms: {
              include: {
                platform: true
              }
            }
          }
        }
      }
    });

    // Get metrics for each competitor
    const competitorsWithMetrics = await Promise.all(
      relationships.map(async (rel) => {
        const competitor = rel.companyB;

        // Get latest snapshots for all platforms
        const platformMetrics = await Promise.all(
          competitor.platforms.map(async (cp) => {
            const latestSnapshot = await prisma.platformSnapshot.findFirst({
              where: { platformId: cp.id },
              orderBy: { capturedAt: 'desc' }
            });

            const previousSnapshot = await prisma.platformSnapshot.findFirst({
              where: {
                platformId: cp.id,
                capturedAt: { lt: latestSnapshot?.capturedAt || new Date() }
              },
              orderBy: { capturedAt: 'desc' }
            });

            let growth = null;
            if (latestSnapshot && previousSnapshot) {
              const followerGrowth =
                latestSnapshot.followerCount - previousSnapshot.followerCount;
              const followerGrowthPercent =
                previousSnapshot.followerCount > 0
                  ? (followerGrowth / previousSnapshot.followerCount) * 100
                  : 0;

              growth = {
                absolute: followerGrowth,
                percentage: followerGrowthPercent,
                trend: followerGrowth > 0 ? 'up' : followerGrowth < 0 ? 'down' : 'flat'
              };
            }

            return {
              name: cp.platform.name,
              profileUrl: cp.profileUrl,
              followers: latestSnapshot?.followerCount || 0,
              posts: latestSnapshot?.postCount || 0,
              growth
            };
          })
        );

        const totalFollowers = platformMetrics.reduce(
          (sum, p) => sum + p.followers,
          0
        );

        const avgGrowthRate =
          platformMetrics.length > 0
            ? platformMetrics.reduce(
                (sum, p) => sum + (p.growth?.percentage || 0),
                0
              ) / platformMetrics.length
            : 0;

        return {
          relationshipId: rel.id,
          id: competitor.id,
          name: competitor.name,
          industry: competitor.industry,
          description: competitor.description,
          platforms: platformMetrics,
          totalFollowers,
          avgGrowthRate: parseFloat(avgGrowthRate.toFixed(2))
        };
      })
    );

    // Get your company's metrics for comparison
    const yourCompany = await prisma.company.findUnique({
      where: { id: user.companyId },
      include: {
        platforms: {
          include: {
            platform: true
          }
        }
      }
    });

    const yourMetrics = await Promise.all(
      yourCompany!.platforms.map(async (cp) => {
        const latestSnapshot = await prisma.platformSnapshot.findFirst({
          where: { platformId: cp.id },
          orderBy: { capturedAt: 'desc' }
        });

        return {
          followers: latestSnapshot?.followerCount || 0
        };
      })
    );

    const yourTotalFollowers = yourMetrics.reduce(
      (sum, p) => sum + p.followers,
      0
    );

    // Add comparison to each competitor
    const competitorsWithComparison = competitorsWithMetrics.map((comp) => ({
      ...comp,
      comparison: {
        followerDifference: comp.totalFollowers - yourTotalFollowers,
        status:
          comp.totalFollowers > yourTotalFollowers
            ? 'ahead'
            : comp.totalFollowers < yourTotalFollowers
            ? 'behind'
            : 'tied'
      }
    }));

    return competitorsWithComparison;
  },

  /**
   * Get a single competitor by ID
   */
  async getCompetitorById(userId: string, competitorId: string) {
    // Verify user has access
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user?.companyId) {
      throw new Error('User must belong to a company');
    }

    // Verify relationship exists
    const relationship = await prisma.companyRelationship.findFirst({
      where: {
        companyAId: user.companyId,
        companyBId: competitorId,
        relationshipType: 'competitor'
      }
    });

    if (!relationship) {
      throw new Error('Competitor not found or access denied');
    }

    // Get competitor's full dashboard (reuse dashboard logic)
    const competitor = await prisma.company.findUnique({
      where: { id: competitorId },
      include: {
        platforms: {
          include: {
            platform: true
          }
        }
      }
    });

    if (!competitor) {
      throw new Error('Competitor not found');
    }

    // Get platform stats
    const platformStats = await Promise.all(
      competitor.platforms.map(async (cp) => {
        const latestSnapshot = await prisma.platformSnapshot.findFirst({
          where: { platformId: cp.id },
          orderBy: { capturedAt: 'desc' }
        });

        const previousSnapshot = await prisma.platformSnapshot.findFirst({
          where: {
            platformId: cp.id,
            capturedAt: { lt: latestSnapshot?.capturedAt || new Date() }
          },
          orderBy: { capturedAt: 'desc' }
        });

        let growth = null;
        if (latestSnapshot && previousSnapshot) {
          const followerGrowth =
            latestSnapshot.followerCount - previousSnapshot.followerCount;
          const followerGrowthPercent =
            previousSnapshot.followerCount > 0
              ? (followerGrowth / previousSnapshot.followerCount) * 100
              : 0;

          growth = {
            followers: {
              absolute: followerGrowth,
              percentage: followerGrowthPercent,
              trend: followerGrowth > 0 ? 'up' : followerGrowth < 0 ? 'down' : 'flat'
            }
          };
        }

        return {
          name: cp.platform.name,
          profileUrl: cp.profileUrl,
          current: latestSnapshot
            ? {
                followers: latestSnapshot.followerCount,
                posts: latestSnapshot.postCount
              }
            : null,
          growth
        };
      })
    );

    const totalFollowers = platformStats.reduce(
      (sum, p) => sum + (p.current?.followers || 0),
      0
    );

    return {
      id: competitor.id,
      name: competitor.name,
      industry: competitor.industry,
      description: competitor.description,
      totalFollowers,
      platforms: platformStats
    };
  },

  /**
   * Remove a competitor
   */
  async removeCompetitor(userId: string, relationshipId: string) {
    // Get user's company
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user?.companyId) {
      throw new Error('User must belong to a company');
    }

    // Verify relationship exists and belongs to user's company
    const relationship = await prisma.companyRelationship.findUnique({
      where: { id: relationshipId }
    });

    if (!relationship || relationship.companyAId !== user.companyId) {
      throw new Error('Relationship not found or access denied');
    }

    // Delete the relationship
    await prisma.companyRelationship.delete({
      where: { id: relationshipId }
    });

    return { success: true };
  },

  /**
   * Compare your company with all competitors
   */
  async compareWithCompetitors(userId: string) {
    // Get user's company
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user?.companyId) {
      throw new Error('User must belong to a company');
    }

    // Get your company's metrics
    const yourPlatforms = await prisma.companyPlatform.findMany({
      where: { companyId: user.companyId },
      include: { platform: true }
    });

    const yourMetrics = await Promise.all(
      yourPlatforms.map(async (cp) => {
        const latest = await prisma.platformSnapshot.findFirst({
          where: { platformId: cp.id },
          orderBy: { capturedAt: 'desc' }
        });

        const previous = await prisma.platformSnapshot.findFirst({
          where: {
            platformId: cp.id,
            capturedAt: { lt: latest?.capturedAt || new Date() }
          },
          orderBy: { capturedAt: 'desc' }
        });

        let growthRate = 0;
        if (latest && previous && previous.followerCount > 0) {
          growthRate =
            ((latest.followerCount - previous.followerCount) /
              previous.followerCount) *
            100;
        }

        return {
          followers: latest?.followerCount || 0,
          growthRate
        };
      })
    );

    const yourTotalFollowers = yourMetrics.reduce(
      (sum, m) => sum + m.followers,
      0
    );
    const yourAvgGrowthRate =
      yourMetrics.length > 0
        ? yourMetrics.reduce((sum, m) => sum + m.growthRate, 0) /
          yourMetrics.length
        : 0;

    // Get all competitors
    const competitors = await this.listCompetitors(userId);

    // Create comparison data
    const allCompanies = [
      {
        name: (await prisma.company.findUnique({ where: { id: user.companyId } }))!
          .name,
        totalFollowers: yourTotalFollowers,
        growthRate: yourAvgGrowthRate,
        isYou: true
      },
      ...competitors.map((c) => ({
        name: c.name,
        totalFollowers: c.totalFollowers,
        growthRate: c.avgGrowthRate,
        isYou: false
      }))
    ];

    // Sort by followers (descending)
    allCompanies.sort((a, b) => b.totalFollowers - a.totalFollowers);

    // Add rankings
    const rankedCompanies = allCompanies.map((company, index) => ({
      ...company,
      rank: index + 1
    }));

    const yourRank = rankedCompanies.find((c) => c.isYou)!.rank;
    const yourCompanyData = rankedCompanies.find((c) => c.isYou)!;

    // Generate insights
    const insights = [];

    if (rankedCompanies.length === 1) {
      insights.push('No competitors tracked yet');
    } else {
      insights.push(
        `You rank ${yourRank}${this.getOrdinalSuffix(yourRank)} out of ${
          rankedCompanies.length
        } companies`
      );

      const leader = rankedCompanies[0];
      if (!leader.isYou) {
        insights.push(
          `${leader.name} leads with ${leader.totalFollowers.toLocaleString()} followers`
        );
      } else {
        insights.push('You are the market leader! 🎉');
      }

      // Find companies you're outpacing
      const behindYou = competitors.filter(
        (c) => c.comparison.status === 'behind'
      );
      if (behindYou.length > 0) {
        const fastest = behindYou.reduce((max, c) =>
          c.avgGrowthRate > max.avgGrowthRate ? c : max
        );
        if (yourAvgGrowthRate > fastest.avgGrowthRate) {
          const diff = yourAvgGrowthRate - fastest.avgGrowthRate;
          insights.push(
            `You're growing ${diff.toFixed(1)}% faster than ${fastest.name}`
          );
        }
      }

      // Find companies ahead of you
      const aheadOfYou = competitors.filter(
        (c) => c.comparison.status === 'ahead'
      );
      if (aheadOfYou.length > 0) {
        const closest = aheadOfYou.reduce((min, c) =>
          Math.abs(c.comparison.followerDifference) <
          Math.abs(min.comparison.followerDifference)
            ? c
            : min
        );
        insights.push(
          `Close gap with ${closest.name} by ${Math.abs(
            closest.comparison.followerDifference
          ).toLocaleString()} followers`
        );
      }
    }

    return {
      yourCompany: yourCompanyData,
      competitors: rankedCompanies.filter((c) => !c.isYou),
      insights
    };
  },

  // Helper function
  getOrdinalSuffix(num: number): string {
    const j = num % 10;
    const k = num % 100;
    if (j === 1 && k !== 11) return 'st';
    if (j === 2 && k !== 12) return 'nd';
    if (j === 3 && k !== 13) return 'rd';
    return 'th';
  }
};