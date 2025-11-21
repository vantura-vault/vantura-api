import { prisma } from '../db.js';
import {
  scrapeLinkedInCompany,
  pollBrightDataSnapshot,
  extractLinkedInCompanySlug,
  BrightDataLinkedInCompany,
} from './brightdata.js';

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

  // Trigger BrightData scraping
  console.log(`[LinkedIn] Triggering scrape for: ${linkedinUrl}`);
  const snapshotId = await scrapeLinkedInCompany(linkedinUrl);

  // Poll until results are ready
  console.log(`[LinkedIn] Polling snapshot: ${snapshotId}`);
  const results = await pollBrightDataSnapshot(snapshotId);

  if (!results || results.length === 0) {
    throw new Error('No data returned from BrightData');
  }

  const companyData = results[0]; // BrightData returns array, take first result

  // Check if competitor already exists (by LinkedIn URL)
  const existingPlatform = await prisma.companyPlatform.findFirst({
    where: {
      profileUrl: companyData.url,
    },
    include: {
      company: true,
    },
  });

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
  await prisma.platformSnapshot.create({
    data: {
      companyId: competitorId,
      platformId: companyPlatform.id,
      followerCount: companyData.followers || 0,
      postCount: companyData.updates?.length || 0,
    },
  });

  console.log(`[LinkedIn] Created snapshot: ${companyData.followers} followers, ${companyData.updates?.length || 0} posts`);

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
  if (companyData.updates && companyData.updates.length > 0) {
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

  return {
    id: competitorId,
    name: competitor!.name,
    industry: competitor!.industry,
    description: competitor!.description,
    profilePictureUrl: competitor!.profilePictureUrl,
    linkedinUrl: companyData.url,
    followers: companyData.followers,
    postsImported: companyData.updates?.length || 0,
  };
}
