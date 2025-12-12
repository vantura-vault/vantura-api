import { prisma } from './src/db.js';

async function investigate() {
  // Find the user
  const user = await prisma.user.findUnique({
    where: { email: 'ethanwfang@yahoo.com' },
    include: { company: true }
  });
  console.log('=== USER ===');
  console.log(user);

  if (!user || !user.companyId) {
    console.log('No company found');
    return;
  }

  const companyId = user.companyId;

  // Find competitors
  const relationships = await prisma.companyRelationship.findMany({
    where: { companyAId: companyId, relationshipType: 'competitor' },
    include: {
      companyB: {
        include: {
          posts: { take: 5 },
          platforms: { include: { platform: true, snapshots: { take: 1, orderBy: { capturedAt: 'desc' } } } }
        }
      }
    }
  });

  console.log('\n=== COMPETITORS ===');
  for (const rel of relationships) {
    const comp = rel.companyB;
    console.log(`\nCompetitor: ${comp.name} (id: ${comp.id})`);
    console.log(`  Posts: ${comp.posts.length}`);
    console.log(`  Platforms: ${comp.platforms.map(p => p.platform.name + ' - ' + (p.snapshots[0]?.followerCount || 0) + ' followers').join(', ')}`);
  }

  // Check scrape jobs
  const scrapeJobs = await prisma.scrapeJob.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
    take: 10
  });

  console.log('\n=== RECENT SCRAPE JOBS ===');
  for (const job of scrapeJobs) {
    console.log(`Job ${job.id.slice(0,8)}: ${job.status} - target: ${job.targetId.slice(0,8)} - posts: ${job.postsScraped} - error: ${job.errorMessage || 'none'}`);
  }

  // Check pending snapshots
  const pending = await prisma.pendingSnapshot.findMany({
    where: { companyId }
  });

  console.log('\n=== PENDING SNAPSHOTS ===');
  console.log(`Count: ${pending.length}`);
  for (const p of pending) {
    console.log(`  ${p.snapshotId} - attempts: ${p.attempts}/${p.maxAttempts}`);
  }

  // Find Bloomberg specifically
  const bloomberg = relationships.find(r => r.companyB.name.toLowerCase().includes('bloomberg'));
  if (bloomberg) {
    console.log('\n=== BLOOMBERG DETAILS ===');
    const bloombergJobs = await prisma.scrapeJob.findMany({
      where: { targetId: bloomberg.companyB.id },
      orderBy: { createdAt: 'desc' }
    });
    console.log('Scrape jobs for Bloomberg:');
    for (const job of bloombergJobs) {
      console.log(`  ${job.id}: ${job.status} - created: ${job.createdAt} - posts: ${job.postsScraped}`);
      if (job.errorMessage) console.log(`    Error: ${job.errorMessage}`);
    }

    const bloombergPending = await prisma.pendingSnapshot.findMany({
      where: { targetId: bloomberg.companyB.id }
    });
    console.log(`Pending snapshots: ${bloombergPending.length}`);
  }
}

investigate().then(() => prisma.$disconnect()).catch(e => {
  console.error(e);
  prisma.$disconnect();
});
