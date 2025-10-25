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
      name: 'Vantura Demo Company'
    }
  });

  console.log('✅ Created demo company:', demoCompany.name);

  // Create company membership
  await prisma.companyMember.upsert({
    where: {
      userId: demoUser.id // Each user can only have one company
    },
    update: {},
    create: {
      userId: demoUser.id,
      companyId: demoCompany.id,
      role: 'owner'
    }
  });

  console.log('✅ Created company membership');

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
