import { prisma } from './src/db.js';

async function check() {
  const relationships = await prisma.companyRelationship.findMany({
    where: {
      companyB: { name: { contains: 'Raytheon', mode: 'insensitive' } }
    },
    include: {
      companyA: { select: { id: true, name: true } },
      companyB: { select: { id: true, name: true } }
    }
  });

  console.log('=== RAYTHEON RELATIONSHIPS ===');
  for (const r of relationships) {
    console.log(`Company "${r.companyA.name}" (${r.companyA.id})`);
    console.log(`  → has competitor: "${r.companyB.name}" (${r.companyB.id})`);
    console.log('');
  }

  await prisma.$disconnect();
}

check().catch(e => { console.error(e); prisma.$disconnect(); });
