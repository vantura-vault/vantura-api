import { prisma } from './src/db.js';

async function check() {
  const rels = await prisma.companyRelationship.findMany({
    where: { companyAId: 'cmis0nwfu0000bf3grsvx0w7p' },
    include: { companyB: { select: { name: true } } }
  });

  console.log('=== ALL COMPETITORS FOR CLARITY ===');
  for (const r of rels) {
    console.log(`  ${r.companyBId}: ${r.companyB.name} (type: ${r.relationshipType})`);
  }
  console.log(`Total: ${rels.length}`);

  await prisma.$disconnect();
}

check().catch(e => { console.error(e); prisma.$disconnect(); });
