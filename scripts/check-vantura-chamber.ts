import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkVanturaDataChamber() {
  const companyId = 'cmiunuo7v00006w2yqo1zd4rj';

  // Get full company data
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    include: {
      platforms: {
        include: {
          platform: true,
          snapshots: {
            orderBy: { capturedAt: 'desc' },
            take: 3
          }
        }
      },
      posts: {
        orderBy: { postedAt: 'desc' },
        take: 5
      },
      users: true
    }
  });

  if (!company) {
    console.log('Company not found');
    return;
  }

  console.log('=== VANTURA COMPANY DATA ===');
  console.log('ID:', company.id);
  console.log('Name:', company.name);
  console.log('Industry:', company.industry);
  console.log('Description:', company.description || '(not set)');
  console.log('Profile Picture URL:', company.profilePictureUrl || '(NOT SET)');
  console.log('LinkedIn URL:', company.linkedInUrl);
  console.log('LinkedIn Type:', company.linkedInType);
  console.log('Brand Voice:', company.brandVoice || '(not set)');
  console.log('Values:', company.values || '(not set)');
  console.log('Target Audience:', company.targetAudience || '(not set)');

  console.log('\n=== USERS ===');
  company.users.forEach(u => console.log(`  ${u.email} (role: ${u.role})`));

  console.log('\n=== PLATFORM CONNECTIONS ===');
  if (company.platforms.length === 0) {
    console.log('  NO PLATFORMS CONNECTED');
  } else {
    company.platforms.forEach(cp => {
      console.log(`  ${cp.platform.name}:`);
      console.log(`    URL: ${cp.profileUrl}`);
      console.log(`    Snapshots: ${cp.snapshots.length}`);
      cp.snapshots.forEach(s => {
        console.log(`      - ${s.capturedAt.toISOString()}: ${s.followerCount} followers`);
      });
    });
  }

  console.log('\n=== POSTS ===');
  console.log(`Total posts: ${company.posts.length}`);
  company.posts.slice(0, 3).forEach(p => {
    console.log(`  - ${p.postedAt?.toISOString() || 'no date'}: ${p.captionText?.substring(0, 50)}...`);
  });

  await prisma.$disconnect();
}

checkVanturaDataChamber().catch(console.error);
