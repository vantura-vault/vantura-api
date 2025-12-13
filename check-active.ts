import { prisma } from './src/db.js';

async function check() {
  // Check pending/in_progress jobs for Clarity
  const jobs = await prisma.scrapeJob.findMany({
    where: {
      companyId: 'cmis0nwfu0000bf3grsvx0w7p',
      status: { in: ['pending', 'in_progress'] }
    },
    include: {
      targetCompany: { select: { name: true } }
    }
  });

  console.log('=== ACTIVE SCRAPE JOBS FOR CLARITY ===');
  for (const j of jobs) {
    console.log(`  ${j.id}: ${j.status} - target: ${j.targetCompany.name} - created: ${j.createdAt}`);
  }
  console.log(`Total: ${jobs.length}`);

  // Check pending snapshots
  const pending = await prisma.pendingSnapshot.findMany({
    where: { companyId: 'cmis0nwfu0000bf3grsvx0w7p' }
  });
  console.log('\n=== PENDING SNAPSHOTS FOR CLARITY ===');
  console.log(`Total: ${pending.length}`);
  for (const p of pending) {
    console.log(`  ${p.snapshotId} - target: ${p.targetId}`);
  }

  await prisma.$disconnect();
}

check().catch(e => { console.error(e); prisma.$disconnect(); });
