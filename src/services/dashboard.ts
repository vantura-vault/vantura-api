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

    // Calculate total follower growth from oldest to newest
    const totalOldestFollowers = platformStats.reduce(
      (sum, p) => sum + (p.oldest?.followers || 0),
      0
    );

    const totalFollowerGrowth = totalFollowers - totalOldestFollowers;
    const totalFollowerGrowthPercent =
      totalOldestFollowers > 0
        ? (totalFollowerGrowth / totalOldestFollowers) * 100
        : 0;

    // Calculate posts this week
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const postsThisWeekData = await Promise.all(
      company.platforms.map(async (cp) => {
        // Get latest snapshot
        const latest = await prisma.platformSnapshot.findFirst({
          where: { platformId: cp.id },
          orderBy: { capturedAt: 'desc' }
        });

        // Get snapshot from 1 week ago
        const weekAgo = await prisma.platformSnapshot.findFirst({
          where: {
            platformId: cp.id,
            capturedAt: { lte: oneWeekAgo }
          },
          orderBy: { capturedAt: 'desc' }
        });

        if (latest && weekAgo) {
          return latest.postCount - weekAgo.postCount;
        }
        return 0;
      })
    );

    const postsThisWeek = postsThisWeekData.reduce((sum, count) => sum + count, 0);

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

    return {
      company: {
        id: company.id,
        name: company.name,
        industry: company.industry,
        description: company.description
      },
      overview: {
        totalFollowers,
        totalFollowerGrowth: {
          absolute: totalFollowerGrowth,
          percentage: parseFloat(totalFollowerGrowthPercent.toFixed(2))
        },
        avgEngagement: {
          rate: 0, // TODO: Calculate when posts are added
          growth: 0 // TODO: Calculate when posts are added
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
      recentActivity: allActivity
    };
  }
};