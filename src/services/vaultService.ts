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
