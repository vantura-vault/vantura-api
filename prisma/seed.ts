import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create demo user
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@vantura.com' },
    update: {},
    create: {
      email: 'demo@vantura.com',
      name: 'Demo User'
    }
  });

  console.log('✅ Created demo user:', demoUser.email);

  // Create auth token for demo user
  const expiresAt = new Date(Date.now() + 72 * 3600 * 1000); // 72 hours from now

  await prisma.authToken.upsert({
    where: { token: 'demo-token-12345' },
    update: {},
    create: {
      userId: demoUser.id,
      token: 'demo-token-12345',
      expiresAt
    }
  });

  console.log('✅ Created demo auth token: demo-token-12345');

  // Create demo company
  const demoCompany = await prisma.company.upsert({
    where: { id: 'demo-company-1' },
    update: {},
    create: {
      id: 'demo-company-1',
      name: 'Vantura Demo Company',
      industry: 'Technology',
      description: 'Demo company for Vantura platform'
    }
  });

  console.log('✅ Created demo company:', demoCompany.name);

  // Link user to company by updating the user's companyId
  await prisma.user.update({
    where: { id: demoUser.id },
    data: {
      companyId: demoCompany.id,
      role: 'owner'
    }
  });

  console.log('✅ Linked demo user to company');

  // Create platforms
  const linkedin = await prisma.platform.upsert({
    where: { name: 'LinkedIn' },
    update: {},
    create: { name: 'LinkedIn' }
  });

  const twitter = await prisma.platform.upsert({
    where: { name: 'Twitter' },
    update: {},
    create: { name: 'Twitter' }
  });

  const instagram = await prisma.platform.upsert({
    where: { name: 'Instagram' },
    update: {},
    create: { name: 'Instagram' }
  });

  console.log('✅ Created platforms');

  // Link company to platforms
  await prisma.companyPlatform.upsert({
    where: {
      companyId_platformId: {
        companyId: demoCompany.id,
        platformId: linkedin.id
      }
    },
    update: {},
    create: {
      companyId: demoCompany.id,
      platformId: linkedin.id,
      profileUrl: 'https://linkedin.com/company/poppi'
    }
  });

  await prisma.companyPlatform.upsert({
    where: {
      companyId_platformId: {
        companyId: demoCompany.id,
        platformId: twitter.id
      }
    },
    update: {},
    create: {
      companyId: demoCompany.id,
      platformId: twitter.id,
      profileUrl: 'https://twitter.com/drinkpoppi'
    }
  });

  console.log('✅ Linked company to platforms');

  // Create competitor: Dasani
  const dasaniCompany = await prisma.company.upsert({
    where: { id: 'competitor-dasani' },
    update: {},
    create: {
      id: 'competitor-dasani',
      name: 'Dasani',
      industry: 'Beverage',
      description: 'Purified water brand by The Coca-Cola Company'
    }
  });

  console.log('✅ Created competitor company: Dasani');

  // Link Dasani as competitor to demo company
  await prisma.companyRelationship.upsert({
    where: {
      companyAId_companyBId: {
        companyAId: demoCompany.id,
        companyBId: dasaniCompany.id
      }
    },
    update: {},
    create: {
      companyAId: demoCompany.id,
      companyBId: dasaniCompany.id,
      relationshipType: 'competitor'
    }
  });

  console.log('✅ Linked Dasani as competitor to demo company');

  // Add Dasani's social platform accounts
  await prisma.companyPlatform.upsert({
    where: {
      companyId_platformId: {
        companyId: dasaniCompany.id,
        platformId: linkedin.id
      }
    },
    update: {},
    create: {
      companyId: dasaniCompany.id,
      platformId: linkedin.id,
      profileUrl: 'https://linkedin.com/company/dasani'
    }
  });

  await prisma.companyPlatform.upsert({
    where: {
      companyId_platformId: {
        companyId: dasaniCompany.id,
        platformId: twitter.id
      }
    },
    update: {},
    create: {
      companyId: dasaniCompany.id,
      platformId: twitter.id,
      profileUrl: 'https://twitter.com/dasani'
    }
  });

  console.log('✅ Added Dasani social accounts');

  // TODO: Add sample posts and metrics snapshots
  // For now, the dashboard will show zero metrics
  console.log('ℹ️  Note: No sample posts or metrics added yet');

  console.log('\n🎉 Seeding complete!');
  console.log('\n📝 Demo credentials:');
  console.log('   Email: demo@vantura.com');
  console.log('   Token: demo-token-12345');
  console.log('   Company ID: demo-company-1');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
