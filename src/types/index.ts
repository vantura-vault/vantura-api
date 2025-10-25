import { User } from '@prisma/client';

// include user
declare global{
  namespace Express{
    interface Request{
      user?: User;
    }
  }
}

// api response wrapper
export interface ApiResponse<T = any> {
  success: boolean;
  data? : T;
  error?: string;
  message?: string;
}

// auth DTOs
export interface RegisterDTO{
  email: string;
  name: string;
  password: string;
}

export interface LoginDTO {
  email: string;
  password: string;
}

export interface AuthResponseDTO{
  user:{
    id: string;
    email: string;
    name: string;
    companyId: string | null;
    // role, tbd
  };
  token: string;
  expiresAt: string;
}

export interface CreateCompanyDTO{
  name: string;
  industry?: string;
  description?: string;
  values?: string;
  platforms: {
    platformName: string;
    profileUrl: string;
  } [];
}

export interface AddPlatformDTO{
  platformName: string;
  profileUrl: string;
}

export interface CompanyResponseDTO{
  id: string;
  name: string;
  industry: string | null;
  description: string | null;
  values: string | null;
  platforms: {
    id: string;
    platformId: string;
    profileUrl: string;
    platform: {
      id: string;
      platformId: string;
      profileUrl: string;
      platform:{
        id: string;
        name: string;
      };
    }[];
    createdAt: string;
    updatedAt: string;
  }
}

export interface CreateSnapshotDTO{
  companyPlatformId: string;
  followerCount: number;
  postCount: number;
}

export interface SnapshotResponseDTO {
  id: string;
  companyId: string;
  platformId: string;
  followerCount: number;
  postCount: number;
  capturedAt: string;
  companyPlatform: {
    platform: {
      name: string;
    };
  };
}

export interface GrowthAnalyticsDTO {
  totalFollowerGrowth: number;
  totalPostGrowth: number;
  averageFollowerGrowthPerDay: number;
  growthRate: number;
  daysDiff: number;
  startDate: string;
  endDate: string;
  startFollowerCount: number;
  endFollowerCount: number;
}

export interface DashboardResponseDTO {
  company: {
    id: string;
    name: string;
    industry: string | null;
    description: string | null;
  };
  overview: {
    totalFollowers: number;
    totalFollowerGrowth: {
      absolute: number;
      percentage: number;
    };
    avgEngagement: {
      rate: number;
      growth: number;
    };
    totalPosts: number;
    postsThisWeek: number;
    platformCount: number;
    averageGrowthRate: number;
    fastestGrowingPlatform: string | null;
    competitorsTracked: number;
  };
  platforms: PlatformStatsDTO[];
  insights: string[];
  recentActivity: ActivityDTO[];
}

export interface PlatformStatsDTO {
  platformId: string;
  name: string;
  profileUrl: string;
  current: {
    followers: number;
    posts: number;
    lastUpdated: Date;
  } | null;
  oldest: {
    followers: number;
    posts: number;
  } | null;
  growth: {
    followers: {
      absolute: number;
      percentage: number;
      trend: 'up' | 'down' | 'flat';
    };
    posts: {
      absolute: number;
    };
    timeframe: {
      days: number;
      from: Date;
      to: Date;
    };
  } | null;
  recentActivity: ActivityDTO[];
}

export interface ActivityDTO {
  date: Date;
  followers: number;
  posts: number;
  platform?: string;
}

export interface AddCompetitorDTO {
  name: string;
  industry?: string;
  description?: string;
  platforms: {
    platformName: string;
    profileUrl: string;
  }[];
}

export interface CompetitorResponseDTO {
  relationshipId: string;
  id: string;
  name: string;
  industry: string | null;
  description: string | null;
  platforms: {
    name: string;
    profileUrl: string;
    followers: number;
    posts: number;
    growth: {
      absolute: number;
      percentage: number;
      trend: 'up' | 'down' | 'flat';
    } | null;
  }[];
  totalFollowers: number;
  avgGrowthRate: number;
  comparison: {
    followerDifference: number;
    status: 'ahead' | 'behind' | 'tied';
  };
}

export interface ComparisonResponseDTO {
  yourCompany: {
    name: string;
    totalFollowers: number;
    growthRate: number;
    rank: number;
    isYou: true;
  };
  competitors: {
    name: string;
    totalFollowers: number;
    growthRate: number;
    rank: number;
    isYou: false;
  }[];
  insights: string[];
}