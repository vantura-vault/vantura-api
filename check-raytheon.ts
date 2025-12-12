import { prisma } from './src/db.js';

async function check() {
  // Get the most recent scrape job for Raytheon
  const job = await prisma.scrapeJob.findFirst({
    where: {
      targetCompany: { name: { contains: 'Raytheon', mode: 'insensitive' } }
    },
    orderBy: { createdAt: 'desc' },
    include: { targetCompany: true }
  });

  if (!job) {
    console.log('No scrape jobs found for Raytheon');
    return;
  }

  console.log('Latest Raytheon scrape job:');
  console.log('  Job ID:', job.id);
  console.log('  Status:', job.status);
  console.log('  Posts scraped:', job.postsScraped);
  console.log('  Error:', job.errorMessage || 'none');
  console.log('  Target ID:', job.targetId);
  console.log('  Target Name:', job.targetCompany.name);
  console.log('  Target URL:', job.targetUrl);

  // Count posts for this target
  const postCount = await prisma.post.count({
    where: { companyId: job.targetId }
  });
  console.log('  Posts in DB:', postCount);

  // Get LinkedIn platform
  const platform = await prisma.platform.findUnique({
    where: { name: 'LinkedIn' }
  });

  if (platform) {
    const platformPosts = await prisma.post.count({
      where: { companyId: job.targetId, platformId: platform.id }
    });
    console.log('  LinkedIn posts:', platformPosts);
  }
}

check().then(() => process.exit(0)).catch(console.error);
