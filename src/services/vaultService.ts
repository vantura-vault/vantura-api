// import { prisma } from '../db.js';

interface AddCompetitorInput {
  companyId: string;
  name: string;
  website?: string;
  platforms?: Array<{ platform: string; url: string }>;
}

export const vaultService = {
  async getCompetitors(_companyId: string) {
    // TODO: Implement actual database queries
    // Return mock data for now
    const competitors = [
      {
        id: 'comp-1',
        name: 'Competitor A',
        website: 'https://competitor-a.com',
        platforms: [
          { platform: 'LinkedIn', url: 'https://linkedin.com/company/competitor-a', followers: 15000 },
          { platform: 'Twitter', url: 'https://twitter.com/competitorA', followers: 8500 },
        ],
        totalFollowers: 23500,
      },
      {
        id: 'comp-2',
        name: 'Competitor B',
        website: 'https://competitor-b.com',
        platforms: [
          { platform: 'LinkedIn', url: 'https://linkedin.com/company/competitor-b', followers: 12000 },
        ],
        totalFollowers: 12000,
      },
    ];

    return { competitors };
  },

  async addCompetitor(input: AddCompetitorInput) {
    // TODO: Implement actual database creation
    const { name, website, platforms } = input;

    return {
      id: `comp-${Date.now()}`,
      name,
      website,
      platforms: platforms || [],
    };
  },

  async getCompetitorDetails(_competitorId: string, _companyId: string) {
    // TODO: Implement actual database queries
    return {
      id: 'comp-1',
      name: 'Competitor A',
      website: 'https://competitor-a.com',
      accounts: [
        {
          platform: 'LinkedIn',
          profileUrl: 'https://linkedin.com/company/competitor-a',
          snapshots: Array.from({ length: 30 }, (_, i) => ({
            snapshotDate: new Date(Date.now() - i * 24 * 60 * 60 * 1000),
            followers: 15000 - i * 50,
          })),
        },
      ],
    };
  },
};
