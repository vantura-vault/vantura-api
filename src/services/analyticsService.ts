import { prisma } from '../config/database.js';
import { cache, CacheKeys, CacheTTL } from './cache.js';

export type TimeRange = '1M' | '6M' | '1Y' | 'ALL';
export type ComparisonMode = 'none' | 'top' | 'all' | 'industry';

interface HistoricalMetricsResult {
  platform: string;
  range: TimeRange;
  dates: string[];
  followers: number[];
  engagement: number[];
  competitorFollowers?: number[];
  competitorEngagement?: number[];
}

interface PostPerformanceItem {
  postId: string;
  platform: string;
  content: string;
  postedAt: Date;
  impressions: number;
  engagement: number;
  engagementRate: number;
}

export const analyticsService = {
  async getHistoricalMetrics(
    companyId: string,
    platform: string,
    range: TimeRange,
    maWindow?: number,
    comparisonMode: ComparisonMode = 'none'
  ): Promise<HistoricalMetricsResult> {
    const cacheKey = CacheKeys.analytics(companyId, platform, range);

    // Try cache first (only for non-comparison requests to keep cache simple)
    if (comparisonMode === 'none') {
      const cached = await cache.get<HistoricalMetricsResult>(cacheKey);
      if (cached) {
        // Apply moving average to cached data if needed
        if (maWindow && maWindow > 1) {
          cached.followers = applyMovingAverage(cached.followers, maWindow);
          cached.engagement = applyMovingAverage(cached.engagement, maWindow);
        }
        return cached;
      }
    }

    const rangeDays: Record<TimeRange, number> = {
      '1M': 30,
      '6M': 180,
      '1Y': 365,
      'ALL': 730,
    };

    const days = rangeDays[range];
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Get company's platform data
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      include: {
        platforms: {
          where: {
            platform: {
              name: platform
            }
          }
        }
      }
    });

    if (!company || company.platforms.length === 0) {
      // Return mock data if no real data exists
      return generateMockHistoricalData(platform, range, days, comparisonMode);
    }

    const platformId = company.platforms[0].id;

    // Fetch snapshots for the company
    const snapshots = await prisma.platformSnapshot.findMany({
      where: {
        platformId,
        capturedAt: { gte: startDate }
      },
      orderBy: { capturedAt: 'asc' }
    });

    // Build date series
    const dates: string[] = [];
    const followers: number[] = [];
    const engagement: number[] = [];

    for (const snapshot of snapshots) {
      dates.push(snapshot.capturedAt.toISOString());
      followers.push(snapshot.followerCount);
      engagement.push(snapshot.postCount); // Using postCount as proxy for engagement
    }

    // Apply moving average if requested
    const smoothedFollowers = maWindow && maWindow > 1
      ? applyMovingAverage(followers, maWindow)
      : followers;
    const smoothedEngagement = maWindow && maWindow > 1
      ? applyMovingAverage(engagement, maWindow)
      : engagement;

    // Get competitor data if comparison mode is enabled
    let competitorFollowers: number[] | undefined;
    let competitorEngagement: number[] | undefined;

    if (comparisonMode !== 'none') {
      const competitorData = await getCompetitorData(
        companyId,
        platform,
        startDate,
        comparisonMode,
        dates.length
      );
      competitorFollowers = competitorData.followers;
      competitorEngagement = competitorData.engagement;
    }

    const result = {
      platform,
      range,
      dates,
      followers: smoothedFollowers,
      engagement: smoothedEngagement,
      competitorFollowers,
      competitorEngagement,
    };

    // Cache raw data (without moving average) for non-comparison requests
    if (comparisonMode === 'none') {
      const cacheData = {
        platform,
        range,
        dates,
        followers, // Store raw data
        engagement, // Store raw data
      };
      await cache.set(cacheKey, cacheData, CacheTTL.analytics);
    }

    return result;
  },

  async getRecentPosts(companyId: string, limit: number) {
    // Fetch recent posts from database
    const posts = await prisma.post.findMany({
      where: { companyId },
      include: {
        analysis: true,
        platform: true,
      },
      orderBy: { postedAt: 'desc' },
      take: limit,
    });

    // Transform to response format
    const items: PostPerformanceItem[] = posts.map(post => {
      const impressions = post.analysis?.impressions || 0;
      const engagement = post.analysis?.engagement || 0;
      const engagementRate = impressions > 0
        ? (engagement / impressions) * 100
        : 0;

      return {
        postId: post.id,
        platform: post.platform.name,
        content: post.captionText || '',
        postedAt: post.postedAt,
        impressions,
        engagement,
        engagementRate: parseFloat(engagementRate.toFixed(2)),
      };
    });

    return { items };
  },
};

// Helper function to apply moving average
function applyMovingAverage(data: number[], window: number): number[] {
  return data.map((_, i) => {
    const slice = data.slice(Math.max(0, i - window + 1), i + 1);
    return Math.round(slice.reduce((a, b) => a + b, 0) / slice.length);
  });
}

// Helper function to get competitor data
async function getCompetitorData(
  _companyId: string,
  _platform: string,
  _startDate: Date,
  _comparisonMode: ComparisonMode,
  dataPoints: number
): Promise<{ followers: number[]; engagement: number[] }> {
  // TODO: Implement real competitor data fetching once schema is confirmed
  // For now, return mock data
  return generateMockCompetitorData(dataPoints);
}

// Generate mock data for development
function generateMockHistoricalData(
  platform: string,
  range: TimeRange,
  days: number,
  comparisonMode: ComparisonMode
): HistoricalMetricsResult {
  const dates: string[] = [];
  const followers: number[] = [];
  const engagement: number[] = [];

  const baseFollowers = 10000;
  const baseEngagement = 500;

  for (let i = days; i >= 0; i--) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    dates.push(date.toISOString());
    followers.push(Math.floor(baseFollowers + (days - i) * 50 + Math.random() * 200));
    engagement.push(Math.floor(baseEngagement + Math.random() * 100));
  }

  const result: HistoricalMetricsResult = {
    platform,
    range,
    dates,
    followers,
    engagement,
  };

  if (comparisonMode !== 'none') {
    const mockCompetitor = generateMockCompetitorData(dates.length);
    result.competitorFollowers = mockCompetitor.followers;
    result.competitorEngagement = mockCompetitor.engagement;
  }

  return result;
}

function generateMockCompetitorData(dataPoints: number): { followers: number[]; engagement: number[] } {
  const followers: number[] = [];
  const engagement: number[] = [];
  const baseFollowers = 8500;
  const baseEngagement = 450;

  for (let i = 0; i < dataPoints; i++) {
    followers.push(Math.floor(baseFollowers + i * 45 + Math.random() * 150));
    engagement.push(Math.floor(baseEngagement + Math.random() * 80));
  }

  return { followers, engagement };
}
