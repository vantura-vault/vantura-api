// import { prisma } from '../db.js';

export type TimeRange = '1M' | '6M' | '1Y' | 'ALL';

interface HistoricalMetricsResult {
  platform: string;
  range: TimeRange;
  dates: string[];
  followers: number[];
  engagement: number[];
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
    _companyId: string,
    platform: string,
    range: TimeRange,
    _maWindow?: number
  ): Promise<HistoricalMetricsResult> {
    // TODO: Implement actual database queries once schema is fully implemented
    // For now, return mock data to unblock frontend
    const rangeDays: Record<TimeRange, number> = {
      '1M': 30,
      '6M': 180,
      '1Y': 365,
      'ALL': 365,
    };

    const days = rangeDays[range];
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

    return {
      platform,
      range,
      dates,
      followers,
      engagement,
    };
  },

  async getRecentPosts(_companyId: string, limit: number) {
    // TODO: Implement actual database queries
    // Return mock data for now
    const items: PostPerformanceItem[] = [];

    for (let i = 0; i < limit; i++) {
      items.push({
        postId: `post-${i + 1}`,
        platform: 'LinkedIn',
        content: `Sample post ${i + 1} content about growth and innovation.`,
        postedAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
        impressions: Math.floor(1000 + Math.random() * 5000),
        engagement: Math.floor(50 + Math.random() * 200),
        engagementRate: 3 + Math.random() * 5,
      });
    }

    return { items };
  },
};
