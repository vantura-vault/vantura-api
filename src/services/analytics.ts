// import { prisma } from '../db.js';

// export type TimeRange = '1M' | '6M' | '1Y' | 'ALL';

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
