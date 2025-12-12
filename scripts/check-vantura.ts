import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkVanturaAccount() {
  // Find the Vantura company
  const company = await prisma.company.findFirst({
    where: {
      name: { contains: 'Vantura', mode: 'insensitive' }
    },
    include: {
      platforms: {
        include: {
          platform: true,
          snapshots: {
            orderBy: { capturedAt: 'desc' },
            take: 1
          }
        }
      },
      users: true
    }
  });

  if (!company) {
    console.log('No Vantura company found');
    // List all companies
    const allCompanies = await prisma.company.findMany({
      select: { id: true, name: true }
    });
    console.log('\nAll companies in database:');
    allCompanies.forEach(c => console.log(`  - ${c.name} (${c.id})`));
    await prisma.$disconnect();
    return;
  }

  console.log('=== VANTURA COMPANY ===');
  console.log('ID:', company.id);
  console.log('Name:', company.name);
  console.log('Industry:', company.industry);
  console.log('');

  console.log('=== PLATFORM CONNECTIONS ===');
  if (company.platforms.length === 0) {
    console.log('NO PLATFORMS LINKED!');
  } else {
    for (const cp of company.platforms) {
      console.log('Platform:', cp.platform.name);
      console.log('  Profile URL:', cp.profileUrl);
      console.log('  Latest Snapshot:', cp.snapshots[0] ? `${cp.snapshots[0].followerCount} followers` : 'No snapshots');
    }
  }

  console.log('');
  console.log('=== USERS ===');
  for (const user of company.users) {
    console.log('User:', user.email);
  }

  await prisma.$disconnect();
}

checkVanturaAccount().catch(console.error);
