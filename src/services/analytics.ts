import { prisma } from '../config/database.js';

export type TimeRange = '1M' | '6M' | '1Y' | 'ALL';

// interface HistoricalMetricsParams {
//   companyId: string;
//   platform?: string;
//   range?: TimeRange;
//   maWindow?: number;
// }

// interface HistoricalMetricsResult {
//   platform: string;
//   range: TimeRange;
//   dates: string[];
//   followers: number[];
//   engagement: number[];
// }

// interface PostPerformanceParams {
//   companyId: string;
//   platform?: string;
//   limit?: number;
// }

// interface PostPerformanceItem {
//   postId: string;
//   platform: string;
//   content: string;
//   postedAt: Date;
//   impressions: number;
//   engagement: number;
//   engagementRate: number;
//   ctr: number;
//   summary: string;
// }

// /**
//  * Get historical metrics with optional moving-average smoothing
//  */
// export async function getHistoricalMetrics({
//   companyId,
//   platform = 'ALL',
//   range = '1M',
//   maWindow = 0,
// }: HistoricalMetricsParams): Promise<HistoricalMetricsResult> {
//   // Calculate date range
//   const rangeDays: Record<TimeRange, number | null> = {
//     '1M': 30,
//     '6M': 180,
//     '1Y': 365,
//     'ALL': null,
//   };

//   const daysBack = rangeDays[range];
//   const since = daysBack ? new Date(Date.now() - daysBack * 24 * 3600 * 1000) : new Date(0);

//   // Build query filters
//   const where: any = {
//     companyId,
//     date: { gte: since },
//   };

//   if (platform !== 'ALL') {
//     where.platform = platform;
//   }

//   // Fetch metrics
//   const rows = await prisma.metricsDaily.findMany({
//     where,
//     orderBy: { date: 'asc' },
//   });

//   // Extract data arrays
//   const dates = rows.map(r => r.date.toISOString().split('T')[0]);
//   const followers = rows.map(r => r.followers);
//   const engagement = rows.map(r => r.likes + r.comments + r.shares + r.saves);

//   // Apply moving average if requested
//   const smooth = (arr: number[], k: number): number[] => {
//     if (k <= 1) return arr;
//     return arr.map((_, i) => {
//       const slice = arr.slice(Math.max(0, i - k + 1), i + 1);
//       return Number((slice.reduce((a, b) => a + b, 0) / slice.length).toFixed(2));
//     });
//   };

//   return {
//     platform: platform || 'ALL',
//     range,
//     dates,
//     followers: maWindow > 1 ? smooth(followers, maWindow) : followers,
//     engagement: maWindow > 1 ? smooth(engagement, maWindow) : engagement,
//   };
// }

// /**
//  * Get recent post performance with computed engagement metrics
//  */
// export async function recentPostPerformance({
//   companyId,
//   platform,
//   limit = 6,
// }: PostPerformanceParams): Promise<{ items: PostPerformanceItem[] }> {
//   // Build query filters
//   const where: any = { companyId };
//   if (platform) {
//     where.platform = platform;
//   }

//   // Fetch posts with analytics
//   const posts = await prisma.post.findMany({
//     where,
//     include: { analytics: true },
//     orderBy: { postedAt: 'desc' },
//     take: limit,
//   });

//   // Compute metrics
//   const items = posts.map(post => {
//     const analytics = post.analytics;
//     const impressions = analytics?.impressions ?? 0;
//     const engagement = analytics?.engagement ?? 0;
//     const engagementRate = impressions > 0 ? Number((engagement / impressions * 100).toFixed(1)) : 0;
//     const ctr = analytics?.ctr ?? 0;

//     return {
//       postId: post.id,
//       platform: post.platform,
//       content: post.content,
//       postedAt: post.postedAt,
//       impressions,
//       engagement,
//       engagementRate,
//       ctr: Number((ctr * 100).toFixed(1)),
//       summary: `Engagement ${engagementRate}% | CTR ${Number((ctr * 100).toFixed(1))}%`,
//     };
//   });

//   return { items };
// }

// /**
//  * Update or create post analytics data
//  */
// export async function updatePostAnalytics(
//   postId: string,
//   data: {
//     impressions?: number;
//     engagement?: number;
//     ctr?: number;
//   }
// ): Promise<void> {
//   const impressions = data.impressions ?? 0;
//   const engagement = data.engagement ?? 0;
//   const engagementRate = impressions > 0 ? (engagement / impressions) * 100 : 0;

//   await prisma.postAnalysis.upsert({
//     where: { postId },
//     update: {
//       impressions: data.impressions ?? undefined,
//       engagement: data.engagement ?? undefined,
//       engagementRate,
//       ctr: data.ctr ?? undefined,
//       perfSummary: `Engagement ${engagementRate.toFixed(1)}% | CTR ${((data.ctr ?? 0) * 100).toFixed(1)}%`,
//     },
//     create: {
//       postId,
//       impressions,
//       engagement,
//       engagementRate,
//       ctr: data.ctr ?? 0,
//       perfSummary: `Engagement ${engagementRate.toFixed(1)}% | CTR ${((data.ctr ?? 0) * 100).toFixed(1)}%`,
//     },
//   });
// }

interface AnalyticsSummaryParams {
  companyId: string;
  range?: TimeRange;
}

interface AnalyticsSummaryResult {
  totalReach: number;
  totalReachChange: number;
  engagementRate: number;
  engagementRateChange: number;
  audienceGrowth: number;
  audienceGrowthChange: number;
}

/**
 * Get analytics summary metrics for the Analytics dashboard
 */
export async function getAnalyticsSummary({
  companyId,
  range = '1M'
}: AnalyticsSummaryParams): Promise<AnalyticsSummaryResult> {
  // Calculate date ranges
  const rangeDays: Record<TimeRange, number> = {
    '1M': 30,
    '6M': 180,
    '1Y': 365,
    'ALL': 730, // Default to 2 years for "all"
  };

  const daysBack = rangeDays[range];
  const currentPeriodStart = new Date(Date.now() - daysBack * 24 * 3600 * 1000);
  const previousPeriodStart = new Date(Date.now() - (daysBack * 2) * 24 * 3600 * 1000);
  const previousPeriodEnd = currentPeriodStart;

  // Get company platforms
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      platforms: true
    }
  });

  if (!company) {
    throw new Error('Company not found');
  }

  // Calculate Total Reach (sum of all post impressions in current period)
  const currentPeriodPosts = await prisma.post.findMany({
    where: {
      companyId,
      postedAt: { gte: currentPeriodStart }
    },
    include: { analysis: true }
  });

  const previousPeriodPosts = await prisma.post.findMany({
    where: {
      companyId,
      postedAt: { gte: previousPeriodStart, lt: previousPeriodEnd }
    },
    include: { analysis: true }
  });

  const currentReach = currentPeriodPosts.reduce(
    (sum, post) => sum + (post.analysis?.impressions || 0),
    0
  );

  const previousReach = previousPeriodPosts.reduce(
    (sum, post) => sum + (post.analysis?.impressions || 0),
    0
  );

  const totalReachChange = previousReach > 0
    ? ((currentReach - previousReach) / previousReach) * 100
    : 0;

  // Calculate Engagement Rate (current period)
  const currentEngagement = currentPeriodPosts.reduce(
    (sum, post) => sum + (post.analysis?.engagement || 0),
    0
  );

  const previousEngagement = previousPeriodPosts.reduce(
    (sum, post) => sum + (post.analysis?.engagement || 0),
    0
  );

  const currentEngagementRate = currentReach > 0
    ? (currentEngagement / currentReach) * 100
    : 0;

  const previousEngagementRate = previousReach > 0
    ? (previousEngagement / previousReach) * 100
    : 0;

  const engagementRateChange = previousEngagementRate > 0
    ? ((currentEngagementRate - previousEngagementRate) / previousEngagementRate) * 100
    : 0;

  // Calculate Audience Growth (new followers in current period)
  const platformSnapshots = await Promise.all(
    company.platforms.map(async (platform) => {
      // Get latest snapshot
      const latestSnapshot = await prisma.platformSnapshot.findFirst({
        where: { platformId: platform.id },
        orderBy: { capturedAt: 'desc' }
      });

      // Get snapshot from period start
      const periodStartSnapshot = await prisma.platformSnapshot.findFirst({
        where: {
          platformId: platform.id,
          capturedAt: { lte: currentPeriodStart }
        },
        orderBy: { capturedAt: 'desc' }
      });

      // Get snapshot from previous period start
      const previousPeriodSnapshot = await prisma.platformSnapshot.findFirst({
        where: {
          platformId: platform.id,
          capturedAt: { lte: previousPeriodStart }
        },
        orderBy: { capturedAt: 'desc' }
      });

      return {
        current: latestSnapshot?.followerCount || 0,
        periodStart: periodStartSnapshot?.followerCount || 0,
        previousPeriodStart: previousPeriodSnapshot?.followerCount || 0
      };
    })
  );

  const currentFollowers = platformSnapshots.reduce((sum, s) => sum + s.current, 0);
  const periodStartFollowers = platformSnapshots.reduce((sum, s) => sum + s.periodStart, 0);
  const previousPeriodStartFollowers = platformSnapshots.reduce((sum, s) => sum + s.previousPeriodStart, 0);

  const audienceGrowth = currentFollowers - periodStartFollowers;
  const previousAudienceGrowth = periodStartFollowers - previousPeriodStartFollowers;

  const audienceGrowthChange = previousAudienceGrowth > 0
    ? ((audienceGrowth - previousAudienceGrowth) / previousAudienceGrowth) * 100
    : 0;

  return {
    totalReach: currentReach,
    totalReachChange: parseFloat(totalReachChange.toFixed(1)),
    engagementRate: parseFloat(currentEngagementRate.toFixed(1)),
    engagementRateChange: parseFloat(engagementRateChange.toFixed(1)),
    audienceGrowth,
    audienceGrowthChange: parseFloat(audienceGrowthChange.toFixed(1))
  };
}
