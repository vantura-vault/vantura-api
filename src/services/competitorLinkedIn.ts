import { prisma } from '../db.js';
import {
  scrapeLinkedInCompany,
  extractLinkedInCompanySlug,
} from './brightdata.js';
import { createScrapeJob, getPendingScrapeJobForTarget } from './scrapeJobService.js';
import { triggerAsyncScrape } from './asyncScraper.js';

export interface AddCompetitorViaLinkedInInput {
  companyId: string; // The user's company adding the competitor
  linkedinUrl: string; // LinkedIn company URL
}

/**
 * Add a competitor by scraping their LinkedIn profile via BrightData
 */
export async function addCompetitorViaLinkedIn(input: AddCompetitorViaLinkedInInput) {
  const { companyId, linkedinUrl } = input;

  // Validate LinkedIn URL
  const slug = extractLinkedInCompanySlug(linkedinUrl);
  if (!slug) {
    throw new Error('Invalid LinkedIn company URL');
  }

  // Check if user's company exists
  const userCompany = await prisma.company.findUnique({
    where: { id: companyId },
  });

  if (!userCompany) {
    throw new Error('Company not found');
  }

  // Scrape LinkedIn via BrightData (synchronous)
  console.log(`[LinkedIn] Scraping company: ${linkedinUrl}`);
  let results;

  try {
    results = await scrapeLinkedInCompany(linkedinUrl);
  } catch (error) {
    console.error('[LinkedIn] BrightData scraping failed:', error);
    throw new Error('Failed to scrape LinkedIn company data');
  }

  console.log(`[LinkedIn] BrightData response type:`, typeof results);
  console.log(`[LinkedIn] BrightData response:`, JSON.stringify(results, null, 2));

  if (!results) {
    throw new Error('No data returned from BrightData');
  }

  if (!Array.isArray(results)) {
    console.error('[LinkedIn] BrightData response is not an array:', results);
    throw new Error('Invalid response format from BrightData');
  }

  if (results.length === 0) {
    throw new Error('No companies found in BrightData response');
  }

  const companyData = results[0]; // BrightData returns array, take first result

  // Validate required fields
  if (!companyData) {
    console.error('[LinkedIn] First result is null or undefined');
    throw new Error('No company data returned from BrightData. The LinkedIn URL may be invalid or the company page may not be accessible.');
  }

  if (!companyData.name) {
    console.error('[LinkedIn] Company data missing name field:', JSON.stringify(companyData, null, 2));

    // Check if BrightData returned an error
    if ((companyData as any).error) {
      throw new Error(`BrightData error: ${(companyData as any).error}`);
    }

    throw new Error('Unable to fetch company data from LinkedIn. The company page may be restricted or unavailable.');
  }

  // Check if competitor already exists (by LinkedIn URL)
  const existingPlatform = companyData.url
    ? await prisma.companyPlatform.findFirst({
        where: {
          profileUrl: companyData.url,
        },
        include: {
          company: true,
        },
      })
    : null;

  let competitorId: string;

  if (existingPlatform) {
    // Competitor already exists
    console.log(`[LinkedIn] Competitor already exists: ${existingPlatform.company.name}`);
    competitorId = existingPlatform.companyId;

    // Update company data
    await prisma.company.update({
      where: { id: competitorId },
      data: {
        name: companyData.name,
        industry: companyData.industries || null,
        description: companyData.about || companyData.unformatted_about || null,
        profilePictureUrl: companyData.logo || null,
        values: companyData.specialties ? JSON.stringify(companyData.specialties.split(',').map((s) => s.trim())) : null,
      },
    });
  } else {
    // Create new competitor company
    const newCompany = await prisma.company.create({
      data: {
        name: companyData.name,
        industry: companyData.industries || null,
        description: companyData.about || companyData.unformatted_about || null,
        profilePictureUrl: companyData.logo || null,
        values: companyData.specialties ? JSON.stringify(companyData.specialties.split(',').map((s) => s.trim())) : null,
      },
    });

    competitorId = newCompany.id;
    console.log(`[LinkedIn] Created new competitor: ${newCompany.name} (${competitorId})`);
  }

  // Ensure LinkedIn platform exists
  let linkedInPlatform = await prisma.platform.findUnique({
    where: { name: 'LinkedIn' },
  });

  if (!linkedInPlatform) {
    linkedInPlatform = await prisma.platform.create({
      data: { name: 'LinkedIn' },
    });
  }

  // Create or update CompanyPlatform link
  const companyPlatform = await prisma.companyPlatform.upsert({
    where: {
      companyId_platformId: {
        companyId: competitorId,
        platformId: linkedInPlatform.id,
      },
    },
    update: {
      profileUrl: companyData.url,
    },
    create: {
      companyId: competitorId,
      platformId: linkedInPlatform.id,
      profileUrl: companyData.url,
    },
  });

  // Create PlatformSnapshot (follower count, post count)
  const followerCount = companyData.followers ?? 0;
  const postCount = Array.isArray(companyData.updates) ? companyData.updates.length : 0;

  await prisma.platformSnapshot.create({
    data: {
      companyId: competitorId,
      platformId: companyPlatform.id,
      followerCount,
      postCount,
    },
  });

  console.log(`[LinkedIn] Created snapshot: ${followerCount} followers, ${postCount} posts`);

  // Create CompanyRelationship (mark as competitor)
  const existingRelationship = await prisma.companyRelationship.findFirst({
    where: {
      companyAId: companyId,
      companyBId: competitorId,
    },
  });

  if (!existingRelationship) {
    await prisma.companyRelationship.create({
      data: {
        companyAId: companyId,
        companyBId: competitorId,
        relationshipType: 'competitor',
      },
    });

    console.log(`[LinkedIn] Created competitor relationship`);
  }

  // Import recent posts (optional - store top 10 posts)
  if (Array.isArray(companyData.updates) && companyData.updates.length > 0) {
    const postsToImport = companyData.updates.slice(0, 10);

    for (const update of postsToImport) {
      try {
        // Check if post already exists
        const existingPost = await prisma.post.findUnique({
          where: {
            platformId_platformPostId: {
              platformId: linkedInPlatform.id,
              platformPostId: update.post_id,
            },
          },
        });

        if (!existingPost) {
          // Determine media type
          let mediaType = 'text';
          if (update.images && update.images.length > 0) {
            mediaType = update.images.length > 1 ? 'carousel' : 'image';
          } else if (update.videos && update.videos.length > 0) {
            mediaType = 'video';
          }

          // Create post
          const post = await prisma.post.create({
            data: {
              companyId: competitorId,
              platformId: linkedInPlatform.id,
              platformPostId: update.post_id,
              captionText: update.text || null,
              postUrl: update.post_url,
              mediaType,
              postedAt: new Date(update.date),
            },
          });

          // Create initial snapshot
          await prisma.postSnapshot.create({
            data: {
              postId: post.id,
              likeCount: update.likes_count || 0,
              commentCount: update.comments_count || 0,
            },
          });
        }
      } catch (error) {
        console.error(`[LinkedIn] Failed to import post ${update.post_id}:`, error);
        // Continue with other posts
      }
    }

    console.log(`[LinkedIn] Imported ${postsToImport.length} posts`);
  }

  // Return competitor details
  const competitor = await prisma.company.findUnique({
    where: { id: competitorId },
    include: {
      platforms: {
        include: {
          platform: true,
        },
      },
    },
  });

  // Trigger async post scrape (only if no pending job exists)
  let scrapeJobId: string | null = null;
  const existingJob = await getPendingScrapeJobForTarget(companyId, competitorId);

  if (!existingJob) {
    try {
      const scrapeJob = await createScrapeJob({
        companyId,
        targetId: competitorId,
        targetUrl: companyData.url || linkedinUrl,
        platform: 'LinkedIn',
        scrapeType: 'posts',
      });
      scrapeJobId = scrapeJob.id;

      // Trigger async scrape in background
      triggerAsyncScrape(scrapeJob.id);
      console.log(`[LinkedIn] Triggered async post scrape job: ${scrapeJob.id}`);
    } catch (error) {
      console.error('[LinkedIn] Failed to create scrape job:', error);
      // Don't fail the whole operation if scrape job creation fails
    }
  } else {
    console.log(`[LinkedIn] Pending scrape job already exists: ${existingJob.id}`);
    scrapeJobId = existingJob.id;
  }

  return {
    id: competitorId,
    name: competitor!.name,
    industry: competitor!.industry,
    description: competitor!.description,
    profilePictureUrl: competitor!.profilePictureUrl,
    linkedinUrl: companyData.url || linkedinUrl,
    followers: followerCount,
    postsImported: postCount,
    scrapeJobId, // Include the scrape job ID in response
  };
}
