import { prisma } from './src/db.js';

async function check() {
  const raytheons = await prisma.company.findMany({
    where: { name: { contains: 'Raytheon', mode: 'insensitive' } }
  });
  console.log('=== RAYTHEON COMPANIES ===');
  for (const r of raytheons) {
    console.log(`  ${r.id}: ${r.name}`);
  }

  if (raytheons.length === 0) {
    console.log('No Raytheon found');
    await prisma.$disconnect();
    return;
  }

  const jobs = await prisma.scrapeJob.findMany({
    where: { targetId: { in: raytheons.map(r => r.id) } },
    orderBy: { createdAt: 'desc' },
    take: 10
  });
  console.log('\n=== RAYTHEON SCRAPE JOBS ===');
  for (const j of jobs) {
    console.log(`  ${j.id}: ${j.status} - created: ${j.createdAt}`);
  }

  const pending = await prisma.pendingSnapshot.findMany({
    where: { targetId: { in: raytheons.map(r => r.id) } }
  });
  console.log('\n=== PENDING SNAPSHOTS ===');
  console.log(`  Count: ${pending.length}`);
  for (const p of pending) {
    console.log(`  ${p.snapshotId}: attempts ${p.attempts}/${p.maxAttempts}`);
  }

  await prisma.$disconnect();
}

check().catch(e => { console.error(e); prisma.$disconnect(); });
