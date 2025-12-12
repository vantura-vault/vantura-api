/**
 * Migration script to move existing LinkedIn profile images to S3
 *
 * Usage: npx tsx scripts/migrateImagesToS3.ts
 *
 * Requires AWS credentials in .env:
 * - AWS_ACCESS_KEY_ID
 * - AWS_SECRET_ACCESS_KEY
 * - AWS_S3_BUCKET
 * - AWS_REGION
 */

import { PrismaClient } from '@prisma/client';
import { ensureS3Image, isS3Url, isS3Available } from '../src/services/imageStorage.js';

const prisma = new PrismaClient();

async function migrateImages() {
  console.log('🚀 Starting image migration to S3...\n');

  // Check if S3 is configured
  if (!isS3Available()) {
    console.error('❌ AWS S3 is not configured. Please set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET, and AWS_REGION in .env');
    process.exit(1);
  }

  // Get all companies with profile pictures that are not S3 URLs
  const companies = await prisma.company.findMany({
    where: {
      profilePictureUrl: {
        not: null,
      },
    },
    select: {
      id: true,
      name: true,
      profilePictureUrl: true,
    },
  });

  console.log(`Found ${companies.length} companies with profile pictures\n`);

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const company of companies) {
    const { id, name, profilePictureUrl } = company;

    if (!profilePictureUrl) {
      skipped++;
      continue;
    }

    // Skip if already an S3 URL
    if (isS3Url(profilePictureUrl)) {
      console.log(`⏭️  ${name}: Already on S3`);
      skipped++;
      continue;
    }

    console.log(`📸 ${name}: Migrating image...`);

    try {
      const s3Url = await ensureS3Image(profilePictureUrl, id, 'profile');

      if (s3Url && s3Url !== profilePictureUrl) {
        // Update the database with the new S3 URL
        await prisma.company.update({
          where: { id },
          data: { profilePictureUrl: s3Url },
        });

        console.log(`   ✅ Migrated to: ${s3Url.substring(0, 60)}...`);
        migrated++;
      } else {
        console.log(`   ⚠️  Could not migrate (keeping original)`);
        failed++;
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      failed++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('Migration complete!');
  console.log(`  ✅ Migrated: ${migrated}`);
  console.log(`  ⏭️  Skipped: ${skipped}`);
  console.log(`  ❌ Failed: ${failed}`);
  console.log('='.repeat(50));
}

migrateImages()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
