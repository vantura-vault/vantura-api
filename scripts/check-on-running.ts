import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function check() {
  // Find most recently created companies
  const recentCompanies = await prisma.company.findMany({
    orderBy: { id: 'desc' },
    take: 10,
    include: {
      users: true,
      platforms: { include: { platform: true } }
    }
  });

  console.log('=== MOST RECENT COMPANIES ===\n');
  for (const c of recentCompanies) {
    console.log(`Name: ${c.name}`);
    console.log(`  ID: ${c.id}`);
    console.log(`  Profile Picture: ${c.profilePictureUrl || 'NOT SET'}`);
    console.log(`  LinkedIn URL: ${c.linkedInUrl || 'not set'}`);
    console.log(`  LinkedIn Type: ${c.linkedInType || 'not set'}`);
    console.log(`  Users: ${c.users.map(u => u.email).join(', ') || 'none'}`);
    console.log(`  Platforms: ${c.platforms.map(p => p.platform.name).join(', ') || 'none'}`);
    console.log('');
  }

  await prisma.$disconnect();
}

check().catch(console.error);
