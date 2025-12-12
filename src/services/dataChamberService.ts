import { prisma } from '../db.js';
import { createScrapeJob, getPendingScrapeJobForTarget } from './scrapeJobService.js';
import { triggerAsyncScrape } from './asyncScraper.js';
import { cache, CacheKeys, CacheTTL } from './cache.js';

const POSTS_SCRAPE_DELAY_MS = 30000; // 30 second delay between profile and posts scrape
const FRESHNESS_DAYS = 7; // Data is considered "fresh" if updated within this many days

interface DataChamberSettings {
  values: string[];
  brandVoice: string;
  targetAudience: string;
  personalNotes: string;
  profilePictureUrl?: string;
  linkedInUrl?: string;
  linkedInType?: string;
}

interface DataHealthComponent {
  name: string;
  complete: boolean;
  weight: number;
  details?: string;
}

interface DataHealthResult {
  score: number;
  status: 'excellent' | 'good' | 'fair' | 'needs_attention';
  components: DataHealthComponent[];
}

export const dataChamberService = {
  /**
   * Get company data chamber settings (with caching)
   */
  async getSettings(companyId: string): Promise<DataChamberSettings> {
    const cacheKey = CacheKeys.companySettings(companyId);

    // Try cache first
    const cached = await cache.get<DataChamberSettings>(cacheKey);
    if (cached) {
      return cached;
    }

    // Cache miss - fetch from database
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        values: true,
        brandVoice: true,
        targetAudience: true,
        personalNotes: true,
        profilePictureUrl: true,
        linkedInUrl: true,
        linkedInType: true,
      },
    });

    if (!company) {
      throw new Error('Company not found');
    }

    // Parse JSON fields or return defaults
    const values = company.values ? JSON.parse(company.values) : [];
    const brandVoice = company.brandVoice || '';
    const targetAudience = company.targetAudience || '';
    const personalNotes = company.personalNotes || '';

    const settings: DataChamberSettings = {
      values,
      brandVoice,
      targetAudience,
      personalNotes,
      profilePictureUrl: company.profilePictureUrl || undefined,
      linkedInUrl: company.linkedInUrl || undefined,
      linkedInType: company.linkedInType || undefined,
    };

    // Cache the result
    await cache.set(cacheKey, settings, CacheTTL.companySettings);

    return settings;
  },

  /**
   * Update company data chamber settings
   */
  async updateSettings(
    companyId: string,
    settings: Partial<DataChamberSettings>
  ): Promise<DataChamberSettings> {
    // Prepare update data
    const updateData: any = {};

    if (settings.values !== undefined) {
      updateData.values = JSON.stringify(settings.values);
    }
    if (settings.brandVoice !== undefined) {
      updateData.brandVoice = settings.brandVoice;
    }
    if (settings.targetAudience !== undefined) {
      updateData.targetAudience = settings.targetAudience;
    }
    if (settings.personalNotes !== undefined) {
      updateData.personalNotes = settings.personalNotes;
    }
    if (settings.profilePictureUrl !== undefined) {
      updateData.profilePictureUrl = settings.profilePictureUrl;
    }
    if (settings.linkedInUrl !== undefined) {
      updateData.linkedInUrl = settings.linkedInUrl;
    }
    if (settings.linkedInType !== undefined) {
      updateData.linkedInType = settings.linkedInType;
    }

    // Update company
    const company = await prisma.company.update({
      where: { id: companyId },
      data: updateData,
      select: {
        values: true,
        brandVoice: true,
        targetAudience: true,
        personalNotes: true,
        profilePictureUrl: true,
        linkedInUrl: true,
        linkedInType: true,
      },
    });

    // Invalidate cache after update
    await cache.del(CacheKeys.companySettings(companyId));

    // Build updated settings
    const updatedSettings: DataChamberSettings = {
      values: company.values ? JSON.parse(company.values) : [],
      brandVoice: company.brandVoice || '',
      targetAudience: company.targetAudience || '',
      personalNotes: company.personalNotes || '',
      profilePictureUrl: company.profilePictureUrl || undefined,
      linkedInUrl: company.linkedInUrl || undefined,
      linkedInType: company.linkedInType || undefined,
    };

    // Cache the new settings
    await cache.set(CacheKeys.companySettings(companyId), updatedSettings, CacheTTL.companySettings);

    return updatedSettings;
  },

  /**
   * Sync LinkedIn profile/company data and return profile picture
   * Also updates follower count in platform snapshots
   */
  async syncLinkedIn(
    companyId: string,
    url: string,
    type: 'profile' | 'company'
  ): Promise<{ profilePictureUrl?: string; name?: string; followers?: number }> {
    // Import BrightData queue to avoid rate limiting
    const { brightdataQueue } = await import('./brightdataQueue.js');
    const { ensureS3Image } = await import('./imageStorage.js');

    let profilePictureUrl: string | undefined;
    let name: string | undefined;
    let followers: number | undefined;

    try {
      if (type === 'company') {
        console.log(`🔍 [DataChamber] Queuing LinkedIn company sync: ${url}`);
        const results = await brightdataQueue.scrapeCompany(url);
        if (results && results.length > 0) {
          const data = results[0];
          // Proxy image to S3 to avoid ad blocker issues
          profilePictureUrl = (await ensureS3Image(data.logo, companyId, 'logo')) || undefined;
          name = data.name;
          followers = data.followers;
          console.log(`✅ [DataChamber] Got company data - logo: ${profilePictureUrl}, followers: ${followers}`);
        }
      } else {
        console.log(`🔍 [DataChamber] Queuing LinkedIn profile sync: ${url}`);
        const results = await brightdataQueue.scrapeProfile(url);
        if (results && results.length > 0) {
          const data = results[0];
          // Proxy image to S3 to avoid ad blocker issues
          profilePictureUrl = (await ensureS3Image(data.avatar, companyId, 'profile')) || undefined;
          name = data.name;
          followers = data.followers || data.connections;
          console.log(`✅ [DataChamber] Got profile data - avatar: ${profilePictureUrl}, followers: ${followers}`);
        }
      }

      // Update company with the new data
      if (profilePictureUrl || name) {
        await prisma.company.update({
          where: { id: companyId },
          data: {
            ...(profilePictureUrl && { profilePictureUrl }),
            ...(name && { name }),
            linkedInUrl: url,
            linkedInType: type,
          },
        });
      }

      // Update platform snapshot with real follower count
      if (followers && followers > 0) {
        // Find or create LinkedIn platform
        let linkedInPlatform = await prisma.platform.findUnique({
          where: { name: 'LinkedIn' },
        });

        if (!linkedInPlatform) {
          linkedInPlatform = await prisma.platform.create({
            data: { name: 'LinkedIn' },
          });
        }

        // Find or create company platform connection
        let companyPlatform = await prisma.companyPlatform.findUnique({
          where: {
            companyId_platformId: {
              companyId,
              platformId: linkedInPlatform.id,
            },
          },
        });

        if (!companyPlatform) {
          companyPlatform = await prisma.companyPlatform.create({
            data: {
              companyId,
              platformId: linkedInPlatform.id,
              profileUrl: url,
            },
          });
        } else {
          // Update the profile URL if it changed
          await prisma.companyPlatform.update({
            where: { id: companyPlatform.id },
            data: { profileUrl: url },
          });
        }

        // Get existing post count from latest snapshot (if any)
        const existingSnapshot = await prisma.platformSnapshot.findFirst({
          where: { platformId: companyPlatform.id },
          orderBy: { capturedAt: 'desc' },
        });

        // Create new snapshot with real follower count
        await prisma.platformSnapshot.create({
          data: {
            companyId,
            platformId: companyPlatform.id,
            followerCount: followers,
            postCount: existingSnapshot?.postCount || 0,
          },
        });

        console.log(`✅ [DataChamber] Created platform snapshot with ${followers} followers`);

        // Schedule async posts scrape with 30s delay to avoid rate limiting
        const existingJob = await getPendingScrapeJobForTarget(companyId, companyId);
        if (!existingJob) {
          try {
            const scrapeJob = await createScrapeJob({
              companyId,
              targetId: companyId, // Self-scraping: target is the company itself
              targetUrl: url,
              platform: 'LinkedIn',
              scrapeType: type,
            });

            console.log(`⏳ [DataChamber] Scheduling posts scrape in ${POSTS_SCRAPE_DELAY_MS / 1000}s...`);

            setTimeout(() => {
              console.log(`🚀 [DataChamber] Starting delayed posts scrape job: ${scrapeJob.id}`);
              triggerAsyncScrape(scrapeJob.id);
            }, POSTS_SCRAPE_DELAY_MS);
          } catch (scrapeError) {
            console.error(`⚠️ [DataChamber] Failed to create scrape job:`, scrapeError);
            // Don't fail the whole operation - profile/followers already synced
          }
        } else {
          console.log(`⏭️ [DataChamber] Posts scrape already pending, skipping`);
        }
      }

      return { profilePictureUrl, name, followers };
    } catch (error) {
      console.error(`❌ [DataChamber] Failed to sync LinkedIn:`, error);
      throw error;
    }
  },

  /**
   * Calculate data health score for a company
   * Returns a score from 0-100 based on data completeness and freshness
   */
  async calculateDataHealth(companyId: string): Promise<DataHealthResult> {
    const cacheKey = CacheKeys.dataHealth(companyId);

    // Try cache first
    const cached = await cache.get<DataHealthResult>(cacheKey);
    if (cached) {
      return cached;
    }

    const components: DataHealthComponent[] = [];
    const freshnessDate = new Date();
    freshnessDate.setDate(freshnessDate.getDate() - FRESHNESS_DAYS);

    // 1. Profile Complete (20%) - has picture, name, LinkedIn URL
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        name: true,
        profilePictureUrl: true,
        linkedInUrl: true,
        linkedInType: true,
        values: true,
        brandVoice: true,
        targetAudience: true,
      },
    });

    if (!company) {
      throw new Error('Company not found');
    }

    const hasProfilePicture = !!company.profilePictureUrl;
    const hasLinkedIn = !!company.linkedInUrl;
    const profileComplete = hasProfilePicture && hasLinkedIn;

    components.push({
      name: 'Profile',
      complete: profileComplete,
      weight: 20,
      details: !profileComplete
        ? `Missing: ${!hasProfilePicture ? 'profile picture' : ''}${!hasProfilePicture && !hasLinkedIn ? ', ' : ''}${!hasLinkedIn ? 'LinkedIn URL' : ''}`
        : undefined,
    });

    // 2. Brand Identity (20%) - has values, brand voice, target audience
    const values = company.values ? JSON.parse(company.values) : [];
    const hasValues = values.length > 0;
    const hasBrandVoice = !!company.brandVoice && company.brandVoice.length > 10;
    const hasTargetAudience = !!company.targetAudience && company.targetAudience.length > 10;
    const brandComplete = hasValues && hasBrandVoice && hasTargetAudience;

    components.push({
      name: 'Brand Identity',
      complete: brandComplete,
      weight: 20,
      details: !brandComplete
        ? `Missing: ${!hasValues ? 'core values' : ''}${!hasValues && !hasBrandVoice ? ', ' : ''}${!hasBrandVoice ? 'brand voice' : ''}${(!hasValues || !hasBrandVoice) && !hasTargetAudience ? ', ' : ''}${!hasTargetAudience ? 'target audience' : ''}`
        : undefined,
    });

    // 3. Platform Connected (20%) - has recent snapshot
    const latestSnapshot = await prisma.platformSnapshot.findFirst({
      where: { companyId },
      orderBy: { capturedAt: 'desc' },
    });

    const platformFresh = latestSnapshot && latestSnapshot.capturedAt >= freshnessDate;

    components.push({
      name: 'Platform Data',
      complete: !!platformFresh,
      weight: 20,
      details: !platformFresh
        ? latestSnapshot
          ? `Last synced ${Math.floor((Date.now() - latestSnapshot.capturedAt.getTime()) / (1000 * 60 * 60 * 24))} days ago`
          : 'No platform data synced'
        : undefined,
    });

    // 4. Posts Synced (20%) - has posts in database
    const postsCount = await prisma.post.count({
      where: { companyId },
    });

    const recentPostsCount = await prisma.post.count({
      where: {
        companyId,
        postedAt: { gte: freshnessDate },
      },
    });

    const postsComplete = postsCount > 0;

    components.push({
      name: 'Posts',
      complete: postsComplete,
      weight: 20,
      details: !postsComplete
        ? 'No posts synced - sync LinkedIn to fetch posts'
        : `${postsCount} posts tracked (${recentPostsCount} from last ${FRESHNESS_DAYS} days)`,
    });

    // 5. Competitors Tracked (20%) - at least 1 competitor
    const competitorCount = await prisma.companyRelationship.count({
      where: {
        companyAId: companyId,
        relationshipType: 'competitor',
      },
    });

    const competitorsComplete = competitorCount > 0;

    components.push({
      name: 'Competitors',
      complete: competitorsComplete,
      weight: 20,
      details: competitorsComplete
        ? `${competitorCount} competitor${competitorCount > 1 ? 's' : ''} tracked`
        : 'No competitors tracked',
    });

    // Calculate total score
    const score = components.reduce((total, c) => total + (c.complete ? c.weight : 0), 0);

    // Determine status
    let status: DataHealthResult['status'];
    if (score >= 100) {
      status = 'excellent';
    } else if (score >= 80) {
      status = 'good';
    } else if (score >= 60) {
      status = 'fair';
    } else {
      status = 'needs_attention';
    }

    const result = { score, status, components };

    // Cache the result
    await cache.set(cacheKey, result, CacheTTL.dataHealth);

    return result;
  },
};
