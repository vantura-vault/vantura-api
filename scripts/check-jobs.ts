import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';

const prisma = new PrismaClient();

async function checkJobs() {
  console.log('=== Database ScrapeJob Records ===\n');

  const jobs = await prisma.scrapeJob.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  const pending = jobs.filter(j => j.status === 'pending');
  const inProgress = jobs.filter(j => j.status === 'in_progress');
  const completed = jobs.filter(j => j.status === 'completed');
  const failed = jobs.filter(j => j.status === 'failed');

  console.log('Total jobs:', jobs.length);
  console.log('  - pending:', pending.length);
  console.log('  - in_progress:', inProgress.length);
  console.log('  - completed:', completed.length);
  console.log('  - failed:', failed.length);
  console.log('');

  if (pending.length > 0 || inProgress.length > 0) {
    console.log('=== Active Jobs ===');
    [...pending, ...inProgress].forEach(j => {
      console.log(`  ID: ${j.id}`);
      console.log(`  Status: ${j.status}`);
      console.log(`  URL: ${j.targetUrl}`);
      console.log(`  Created: ${j.createdAt}`);
      console.log('  ---');
    });
  }

  // Check BullMQ queues in Redis
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    console.log('\n=== BullMQ Queue Status ===\n');
    const redis = new Redis(redisUrl);

    // Get queue job counts
    const waiting = await redis.llen('bull:scrape:wait');
    const active = await redis.llen('bull:scrape:active');
    const delayed = await redis.zcard('bull:scrape:delayed');
    const completed_q = await redis.zcard('bull:scrape:completed');
    const failed_q = await redis.zcard('bull:scrape:failed');

    console.log('BullMQ scrape queue:');
    console.log(`  - waiting: ${waiting}`);
    console.log(`  - active: ${active}`);
    console.log(`  - delayed: ${delayed}`);
    console.log(`  - completed: ${completed_q}`);
    console.log(`  - failed: ${failed_q}`);

    // Show delayed jobs
    if (delayed > 0) {
      console.log('\n=== Delayed Jobs ===');
      const delayedJobs = await redis.zrange('bull:scrape:delayed', 0, -1, 'WITHSCORES');
      for (let i = 0; i < delayedJobs.length; i += 2) {
        const jobId = delayedJobs[i];
        const score = parseInt(delayedJobs[i + 1]);
        const runAt = new Date(score);
        console.log(`  Job: ${jobId} - runs at: ${runAt.toISOString()}`);
      }
    }

    await redis.quit();
  }

  await prisma.$disconnect();
}

checkJobs().catch(console.error);
