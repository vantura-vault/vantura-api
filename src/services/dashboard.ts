import { prisma } from '../config/database.js';

export const dashboardService = {
  /**
   * Get complete dashboard data for a company
   */
  async getDashboard(userId: string, companyId: string) {
    // Verify user has access
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (user?.companyId !== companyId) {
      throw new Error('Access denied');
    }

    // Get company with platforms
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: {
        platforms: {
          include: {
            platform: true
          }
        }
      }
    });

    if (!company) {
      throw new Error('Company not found');
    }

    // Get latest snapshots for all platforms
    const platformStats = await Promise.all(
      company.platforms.map(async (cp) => {
        // Get latest snapshot
        const latestSnapshot = await prisma.platformSnapshot.findFirst({
          where: { platformId: cp.id },
          orderBy: { capturedAt: 'desc' }
        });

        // Get previous snapshot (for comparison)
        const previousSnapshot = await prisma.platformSnapshot.findFirst({
          where: {
            platformId: cp.id,
            capturedAt: { lt: latestSnapshot?.capturedAt || new Date() }
          },
          orderBy: { capturedAt: 'desc' }
        });

        // Get oldest snapshot (for total growth)
        const oldestSnapshot = await prisma.platformSnapshot.findFirst({
          where: { platformId: cp.id },
          orderBy: { capturedAt: 'asc' }
        });

        // Calculate growth
        let growth = null;
        if (latestSnapshot && previousSnapshot) {
          const followerGrowth =
            latestSnapshot.followerCount - previousSnapshot.followerCount;
          const followerGrowthPercent =
            previousSnapshot.followerCount > 0
              ? (followerGrowth / previousSnapshot.followerCount) * 100
              : 0;

          const postGrowth = latestSnapshot.postCount - previousSnapshot.postCount;

          const timeDiff =
            latestSnapshot.capturedAt.getTime() -
            previousSnapshot.capturedAt.getTime();
          const daysDiff = timeDiff / (1000 * 60 * 60 * 24);

          growth = {
            followers: {
              absolute: followerGrowth,
              percentage: followerGrowthPercent,
              trend: followerGrowth > 0 ? 'up' : followerGrowth < 0 ? 'down' : 'flat'
            },
            posts: {
              absolute: postGrowth
            },
            timeframe: {
              days: Math.round(daysDiff),
              from: previousSnapshot.capturedAt,
              to: latestSnapshot.capturedAt
            }
          };
        }

        // Get recent activity (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const recentSnapshots = await prisma.platformSnapshot.findMany({
          where: {
            platformId: cp.id,
            capturedAt: { gte: thirtyDaysAgo }
          },
          orderBy: { capturedAt: 'asc' },
          take: 30
        });

        return {
          platformId: cp.id,
          name: cp.platform.name,
          profileUrl: cp.profileUrl,
          current: latestSnapshot
            ? {
                followers: latestSnapshot.followerCount,
                posts: latestSnapshot.postCount,
                lastUpdated: latestSnapshot.capturedAt
              }
            : null,
          oldest: oldestSnapshot
            ? {
                followers: oldestSnapshot.followerCount,
                posts: oldestSnapshot.postCount
              }
            : null,
          growth,
          recentActivity: recentSnapshots.map((s) => ({
            date: s.capturedAt,
            followers: s.followerCount,
            posts: s.postCount
          }))
        };
      })
    );

    // Calculate current totals
    const totalFollowers = platformStats.reduce(
      (sum, p) => sum + (p.current?.followers || 0),
      0
    );

    const totalPosts = platformStats.reduce(
      (sum, p) => sum + (p.current?.posts || 0),
      0
    );

    // Calculate total follower growth from previous snapshot (not oldest)
    // This shows the change since the last data sync
    const totalFollowerGrowth = platformStats.reduce(
      (sum, p) => sum + (p.growth?.followers.absolute || 0),
      0
    );

    // Calculate percentage based on previous totals
    const totalPreviousFollowers = platformStats.reduce(
      (sum, p) => {
        const current = p.current?.followers || 0;
        const growth = p.growth?.followers.absolute || 0;
        return sum + (current - growth);
      },
      0
    );

    const totalFollowerGrowthPercent =
      totalPreviousFollowers > 0
        ? (totalFollowerGrowth / totalPreviousFollowers) * 100
        : 0;

    // TODO: Refactor to use platform snapshots for better performance
    // Currently counting directly from Post table for accuracy during MVP demo
    // Once snapshot sync is reliable, calculate from snapshot deltas instead
    // Calculate posts this week by counting actual posts from the Post table
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const postsThisWeek = await prisma.post.count({
      where: {
        companyId,
        postedAt: { gte: oneWeekAgo }
      }
    });

    // Calculate average growth rate
    const growthRates = platformStats
      .filter((p) => p.growth?.followers.percentage)
      .map((p) => p.growth!.followers.percentage);

    const averageGrowthRate =
      growthRates.length > 0
        ? growthRates.reduce((sum, rate) => sum + rate, 0) / growthRates.length
        : 0;

    // Find fastest growing platform
    const fastestGrowing = platformStats.reduce((fastest, current) => {
      const currentGrowth = current.growth?.followers.percentage || 0;
      const fastestGrowth = fastest.growth?.followers.percentage || 0;
      return currentGrowth > fastestGrowth ? current : fastest;
    }, platformStats[0]);

    // Generate insights
    const insights = [];

    if (averageGrowthRate > 5) {
      insights.push(`Strong growth: averaging ${averageGrowthRate.toFixed(1)}% across platforms`);
    } else if (averageGrowthRate > 0) {
      insights.push(`Steady growth: averaging ${averageGrowthRate.toFixed(1)}% across platforms`);
    } else if (averageGrowthRate < 0) {
      insights.push(`Declining followers: down ${Math.abs(averageGrowthRate).toFixed(1)}% on average`);
    }

    if (fastestGrowing && fastestGrowing.growth) {
      insights.push(
        `${fastestGrowing.name} is your fastest growing platform at ${fastestGrowing.growth.followers.percentage.toFixed(1)}%`
      );
    }

    const mostFollowers = platformStats.reduce((most, current) => {
      return (current.current?.followers || 0) > (most.current?.followers || 0)
        ? current
        : most;
    }, platformStats[0]);

    // Count competitors
    const competitorsTracked = await prisma.companyRelationship.count({
    where: {
        companyAId: company.id,
        relationshipType: 'competitor'
    }
    });

    if (mostFollowers) {
      insights.push(
        `${mostFollowers.name} has the most followers with ${(mostFollowers.current?.followers || 0).toLocaleString()}`
      );
    }

    if (postsThisWeek > 10) {
      insights.push(`High activity: ${postsThisWeek} posts published this week`);
    } else if (postsThisWeek > 5) {
      insights.push(`Good activity: ${postsThisWeek} posts published this week`);
    } else if (postsThisWeek > 0) {
      insights.push(`${postsThisWeek} posts published this week`);
    }

    // Calculate average engagement rate from posts
    // Formula: (likes + comments) / followers * 100, averaged across posts
    const now = new Date();
    const thirtyDaysAgoDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const recentPosts = await prisma.post.findMany({
      where: { companyId },
      include: {
        metricsSnapshots: {
          orderBy: { capturedAt: 'desc' },
          take: 1 // Get latest snapshot for each post
        }
      },
      orderBy: { postedAt: 'desc' },
      take: 5 // Last 5 posts for engagement rate
    });

    // Get older posts for growth comparison
    const olderPosts = await prisma.post.findMany({
      where: {
        companyId,
        postedAt: { lt: thirtyDaysAgoDate }
      },
      include: {
        metricsSnapshots: {
          orderBy: { capturedAt: 'desc' },
          take: 1
        }
      },
      orderBy: { postedAt: 'desc' },
      take: 20
    });

    // Helper to calculate engagement rate: (likes + comments) / followers * 100
    const calculateEngagementRate = (posts: typeof recentPosts, followers: number): number => {
      if (posts.length === 0 || followers === 0) return 0;

      const totalEngagement = posts.reduce((sum, p) => {
        const snapshot = p.metricsSnapshots[0];
        return sum + (snapshot?.likeCount || 0) + (snapshot?.commentCount || 0);
      }, 0);

      // Average engagement per post, then divide by followers
      const avgEngagementPerPost = totalEngagement / posts.length;
      return (avgEngagementPerPost / followers) * 100;
    };

    const avgEngagementRate = calculateEngagementRate(recentPosts, totalFollowers);
    const olderEngagementRate = calculateEngagementRate(olderPosts, totalFollowers);

    const engagementGrowth = olderEngagementRate > 0
      ? ((avgEngagementRate - olderEngagementRate) / olderEngagementRate) * 100
      : 0;

    // Combine all recent activity for timeline
    const allActivity = platformStats
      .flatMap((p) =>
        p.recentActivity.map((a) => ({
          ...a,
          platform: p.name
        }))
      )
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10); // Last 10 data points

    // Build engagement leaderboard: user vs competitors
    const leaderboardEntries: Array<{
      name: string;
      engagementRate: number;
      isYou: boolean;
      companyId: string;
    }> = [];

    // Add user's company
    leaderboardEntries.push({
      name: company.name,
      engagementRate: parseFloat(avgEngagementRate.toFixed(2)),
      isYou: true,
      companyId: company.id
    });

    // Get competitors and calculate their engagement rates
    const competitorRelationships = await prisma.companyRelationship.findMany({
      where: {
        companyAId: company.id,
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

    for (const rel of competitorRelationships) {
      const competitor = rel.companyB;

      // Get competitor's total followers from latest snapshots
      let competitorTotalFollowers = 0;
      for (const cp of competitor.platforms) {
        const latestSnapshot = await prisma.platformSnapshot.findFirst({
          where: { platformId: cp.id },
          orderBy: { capturedAt: 'desc' }
        });
        competitorTotalFollowers += latestSnapshot?.followerCount || 0;
      }

      // Get competitor's recent posts with engagement metrics
      const competitorPosts = await prisma.post.findMany({
        where: { companyId: competitor.id },
        include: {
          metricsSnapshots: {
            orderBy: { capturedAt: 'desc' },
            take: 1
          }
        },
        orderBy: { postedAt: 'desc' },
        take: 5 // Last 5 posts for engagement rate
      });

      // Calculate competitor engagement rate
      let competitorEngagementRate = 0;
      if (competitorPosts.length > 0 && competitorTotalFollowers > 0) {
        const totalEngagement = competitorPosts.reduce((sum, p) => {
          const snapshot = p.metricsSnapshots[0];
          return sum + (snapshot?.likeCount || 0) + (snapshot?.commentCount || 0);
        }, 0);
        const avgEngagementPerPost = totalEngagement / competitorPosts.length;
        competitorEngagementRate = (avgEngagementPerPost / competitorTotalFollowers) * 100;
      }

      leaderboardEntries.push({
        name: competitor.name,
        engagementRate: parseFloat(competitorEngagementRate.toFixed(2)),
        isYou: false,
        companyId: competitor.id
      });
    }

    // Sort by engagement rate descending and add ranks
    leaderboardEntries.sort((a, b) => b.engagementRate - a.engagementRate);
    const engagementLeaderboard = leaderboardEntries.map((entry, index) => ({
      rank: index + 1,
      ...entry
    }));

    return {
      company: {
        id: company.id,
        name: company.name,
        industry: company.industry,
        description: company.description,
        profilePictureUrl: company.profilePictureUrl
      },
      overview: {
        totalFollowers,
        totalFollowerGrowth: {
          absolute: totalFollowerGrowth,
          percentage: parseFloat(totalFollowerGrowthPercent.toFixed(2))
        },
        avgEngagement: {
          rate: parseFloat(avgEngagementRate.toFixed(2)),
          growth: parseFloat(engagementGrowth.toFixed(2))
        },
        totalPosts,
        postsThisWeek,
        platformCount: platformStats.length,
        averageGrowthRate: parseFloat(averageGrowthRate.toFixed(2)),
        fastestGrowingPlatform: fastestGrowing?.name || null,
        competitorsTracked: competitorsTracked
      },
      platforms: platformStats,
      insights,
      recentActivity: allActivity,
      engagementLeaderboard
    };
  }
};