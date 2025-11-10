import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('📝 Updating Poppi company with strategic goals and values...');

  // Find Poppi company
  const poppiCompany = await prisma.company.findFirst({
    where: { name: 'Poppi' }
  });

  if (!poppiCompany) {
    console.error('❌ Could not find Poppi company');
    return;
  }

  // Strategic goals for Poppi
  const strategicGoals = [
    {
      label: 'Social Media Followers',
      current: 385000,
      target: 500000,
      unit: '',
      achieved: false
    },
    {
      label: 'Engagement Rate',
      current: 8.4,
      target: 10.0,
      unit: '%',
      achieved: false
    },
    {
      label: 'Monthly Post Reach',
      current: 2500000,
      target: 3000000,
      unit: '',
      achieved: false
    },
    {
      label: 'Retail Store Expansion',
      current: 38000,
      target: 50000,
      unit: '',
      achieved: false
    }
  ];

  // Company values for Poppi
  const values = [
    'Gut Health First',
    'Transparency',
    'Innovation',
    'Community-Driven',
    'Sustainability'
  ];

  const brandVoice = 'Fun, vibrant, and health-conscious. We speak to wellness-minded consumers in an approachable, enthusiastic way that makes gut health exciting and accessible. Our tone is playful yet informative, using emojis and casual language while maintaining credibility through science-backed messaging.';

  const targetAudience = 'Health-conscious millennials and Gen Z consumers (ages 18-40) who prioritize wellness, functional beverages, and better-for-you alternatives. They are active on social media, value transparency in ingredients, and seek products that support their lifestyle goals without sacrificing taste.';

  // Update Poppi company
  await prisma.company.update({
    where: { id: poppiCompany.id },
    data: {
      values: JSON.stringify(values),
      brandVoice,
      targetAudience,
      strategicGoals: JSON.stringify(strategicGoals)
    }
  });

  console.log('✅ Updated Poppi company with:');
  console.log('   - Strategic Goals:', strategicGoals.length);
  console.log('   - Values:', values.length);
  console.log('   - Brand Voice: Set');
  console.log('   - Target Audience: Set');
}

main()
  .catch((e) => {
    console.error('❌ Error updating Poppi data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
