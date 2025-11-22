import { prisma } from './src/db.js';

async function checkCompetitors() {
  const competitors = await prisma.company.findMany({
    where: {
      relatedTo: {
        some: {
          relationshipType: 'competitor'
        }
      }
    },
    include: {
      platforms: {
        include: {
          platform: true,
          snapshots: {
            orderBy: { capturedAt: 'desc' },
            take: 1
          }
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 3
  });

  console.log('=== Latest Competitors ===');
  competitors.forEach(comp => {
    console.log(`\nCompetitor: ${comp.name}`);
    console.log(`Created: ${comp.createdAt}`);
    comp.platforms.forEach(platform => {
      console.log(`  Platform: ${platform.platform.name}`);
      console.log(`  URL: ${platform.profileUrl}`);
      if (platform.snapshots.length > 0) {
        console.log(`  Followers: ${platform.snapshots[0].followerCount}`);
        console.log(`  Posts: ${platform.snapshots[0].postCount}`);
      } else {
        console.log(`  No snapshots found!`);
      }
    });
  });
  await prisma.$disconnect();
}

checkCompetitors();
