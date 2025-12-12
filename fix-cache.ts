import { cache, CacheKeys, initRedis } from './src/services/cache.js';

async function fixCache() {
  // Initialize Redis
  initRedis();

  // Wait for connection
  await new Promise(resolve => setTimeout(resolve, 1000));

  const companyId = 'cmis0nwfu0000bf3grsvx0w7p'; // Ethan's company (Clarity)

  console.log('=== CLEARING CACHE ===');

  // Clear competitors cache
  const competitorsKey = CacheKeys.competitors(companyId);
  console.log(`Deleting: ${competitorsKey}`);
  await cache.del(competitorsKey);

  // Clear all competitor details caches
  const competitorIds = [
    'cmj39veku0092jr3hwjfhi7ey', // Bloomberg
    'cmis1ob1b0004c42yv9l4jepn', // Manifold Markets
    'cmis1rs6g000ec42yfut6nyob', // Kalshi
    'cmis1vt3w0042c42ykz94rkye', // Polymarket
    'cmis4e6q30000f93g2gyymvwg', // Tarek Mansour
  ];

  for (const id of competitorIds) {
    const detailKey = CacheKeys.competitorDetails(id);
    console.log(`Deleting: ${detailKey}`);
    await cache.del(detailKey);
  }

  // Clear analytics cache pattern
  console.log('Deleting analytics cache pattern...');
  await cache.delPattern(`analytics:${companyId}:*`);

  console.log('\n✅ Cache cleared! Refresh the page to see updated data.');

  process.exit(0);
}

fixCache().catch(e => {
  console.error(e);
  process.exit(1);
});
