import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkOmAuth() {
  const user = await prisma.user.findUnique({
    where: { email: 'om.mistry@vantura.ai' },
    include: {
      authTokens: {
        orderBy: { createdAt: 'desc' },
        take: 5
      }
    }
  });

  if (!user) {
    console.log('User not found');
    return;
  }

  console.log('=== USER ===');
  console.log('ID:', user.id);
  console.log('Email:', user.email);
  console.log('Company ID:', user.companyId);
  console.log('Role:', user.role);

  console.log('\n=== AUTH TOKENS ===');
  const now = new Date();
  user.authTokens.forEach(t => {
    const expired = t.expiresAt < now;
    console.log('Token:', t.token.substring(0, 10) + '...');
    console.log('  Created:', t.createdAt.toISOString());
    console.log('  Expires:', t.expiresAt.toISOString());
    console.log('  Status:', expired ? 'EXPIRED' : 'VALID');
    console.log('');
  });

  await prisma.$disconnect();
}

checkOmAuth().catch(console.error);
