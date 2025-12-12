import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function getToken() {
  const user = await prisma.user.findUnique({
    where: { email: 'ethanwfang1@gmail.com' },
    include: {
      authTokens: {
        orderBy: { createdAt: 'desc' },
        take: 1
      }
    }
  });

  if (user && user.authTokens.length > 0) {
    console.log('Token:', user.authTokens[0].token);
    console.log('Company ID:', user.companyId);
    console.log('Expires:', user.authTokens[0].expiresAt);
  } else {
    console.log('No token found');
  }

  await prisma.$disconnect();
}

getToken().catch(console.error);
