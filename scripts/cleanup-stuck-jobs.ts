import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupStuckJobs() {
  // Find all stuck jobs (in_progress for more than 10 minutes)
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

  const stuckJobs = await prisma.scrapeJob.findMany({
    where: {
      status: { in: ['pending', 'in_progress'] },
      createdAt: { lt: tenMinutesAgo }
    }
  });

  console.log(`Found ${stuckJobs.length} stuck jobs`);

  if (stuckJobs.length === 0) {
    console.log('No stuck jobs to clean up!');
    await prisma.$disconnect();
    return;
  }

  console.log('\nStuck jobs:');
  stuckJobs.forEach(j => {
    console.log(`  - ${j.id}: ${j.targetUrl} (${j.status})`);
  });

  // Mark them as failed
  const result = await prisma.scrapeJob.updateMany({
    where: {
      id: { in: stuckJobs.map(j => j.id) }
    },
    data: {
      status: 'failed',
      errorMessage: 'Marked as failed due to stuck state (process restart)'
    }
  });

  console.log(`\n✅ Marked ${result.count} jobs as failed`);

  await prisma.$disconnect();
}

cleanupStuckJobs().catch(console.error);
