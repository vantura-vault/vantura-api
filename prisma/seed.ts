import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// TODO: Replace manual data generation with BrightData API integration
// This seed script manually creates demo data for MVP purposes
// Future implementation:
// 1. Follower snapshots: Fetch via BrightData Social Media API
// 2. Posts & engagement: Fetch via BrightData Social Media API
// 3. Competitor data: Fetch via BrightData Social Media API
// See: https://brightdata.com/products/serp-api

async function main() {
  console.log('🌱 Seeding database...');

  // Create demo user
  const demoUser = await prisma.user.upsert({
    where: { email: 'demo@vantura.com' },
    update: {},
    create: {
      email: 'demo@vantura.com',
      name: 'Demo User'
    }
  });

  console.log('✅ Created demo user:', demoUser.email);

  // Create auth token for demo user
  const expiresAt = new Date(Date.now() + 72 * 3600 * 1000); // 72 hours from now

  await prisma.authToken.upsert({
    where: { token: 'demo-token-12345' },
    update: { expiresAt }, // Update expiry time on re-seed
    create: {
      userId: demoUser.id,
      token: 'demo-token-12345',
      expiresAt
    }
  });

  console.log('✅ Created demo auth token: demo-token-12345');

  // Create demo company
  const demoCompany = await prisma.company.upsert({
    where: { id: 'demo-company-1' },
    update: {},
    create: {
      id: 'demo-company-1',
      name: 'Vantura Demo Company',
      industry: 'Technology',
      description: 'Demo company for Vantura platform'
    }
  });

  console.log('✅ Created demo company:', demoCompany.name);

  // Link user to company by updating the user's companyId
  await prisma.user.update({
    where: { id: demoUser.id },
    data: {
      companyId: demoCompany.id,
      role: 'owner'
    }
  });

  console.log('✅ Linked demo user to company');

  // Create platforms
  const linkedin = await prisma.platform.upsert({
    where: { name: 'LinkedIn' },
    update: {},
    create: { name: 'LinkedIn' }
  });

  const twitter = await prisma.platform.upsert({
    where: { name: 'Twitter' },
    update: {},
    create: { name: 'Twitter' }
  });

  const instagram = await prisma.platform.upsert({
    where: { name: 'Instagram' },
    update: {},
    create: { name: 'Instagram' }
  });

  console.log('✅ Created platforms');

  // Link company to platforms
  await prisma.companyPlatform.upsert({
    where: {
      companyId_platformId: {
        companyId: demoCompany.id,
        platformId: linkedin.id
      }
    },
    update: {},
    create: {
      companyId: demoCompany.id,
      platformId: linkedin.id,
      profileUrl: 'https://linkedin.com/company/poppi'
    }
  });

  await prisma.companyPlatform.upsert({
    where: {
      companyId_platformId: {
        companyId: demoCompany.id,
        platformId: twitter.id
      }
    },
    update: {},
    create: {
      companyId: demoCompany.id,
      platformId: twitter.id,
      profileUrl: 'https://twitter.com/drinkpoppi'
    }
  });

  console.log('✅ Linked company to platforms');

  // Create competitor: Dasani
  const dasaniCompany = await prisma.company.upsert({
    where: { id: 'competitor-dasani' },
    update: {},
    create: {
      id: 'competitor-dasani',
      name: 'Dasani',
      industry: 'Beverage',
      description: 'Purified water brand by The Coca-Cola Company'
    }
  });

  console.log('✅ Created competitor company: Dasani');

  // Link Dasani as competitor to demo company
  await prisma.companyRelationship.upsert({
    where: {
      companyAId_companyBId: {
        companyAId: demoCompany.id,
        companyBId: dasaniCompany.id
      }
    },
    update: {},
    create: {
      companyAId: demoCompany.id,
      companyBId: dasaniCompany.id,
      relationshipType: 'competitor'
    }
  });

  console.log('✅ Linked Dasani as competitor to demo company');

  // Add Dasani's social platform accounts
  await prisma.companyPlatform.upsert({
    where: {
      companyId_platformId: {
        companyId: dasaniCompany.id,
        platformId: linkedin.id
      }
    },
    update: {},
    create: {
      companyId: dasaniCompany.id,
      platformId: linkedin.id,
      profileUrl: 'https://linkedin.com/company/dasani'
    }
  });

  await prisma.companyPlatform.upsert({
    where: {
      companyId_platformId: {
        companyId: dasaniCompany.id,
        platformId: twitter.id
      }
    },
    update: {},
    create: {
      companyId: dasaniCompany.id,
      platformId: twitter.id,
      profileUrl: 'https://twitter.com/dasani'
    }
  });

  console.log('✅ Added Dasani social accounts');

  // ============================================
  // FOLLOWER GROWTH DATA (Historical Snapshots)
  // ============================================

  console.log('📊 Adding follower growth snapshots...');

  // Get company platform IDs
  const demoLinkedIn = await prisma.companyPlatform.findUnique({
    where: {
      companyId_platformId: {
        companyId: demoCompany.id,
        platformId: linkedin.id
      }
    }
  });

  const dasaniLinkedIn = await prisma.companyPlatform.findUnique({
    where: {
      companyId_platformId: {
        companyId: dasaniCompany.id,
        platformId: linkedin.id
      }
    }
  });

  // Add 365 days of follower snapshots for demo company (growing trend)
  const today = new Date();
  let baseFollowers = 10000;
  let basePosts = 100;

  for (let daysAgo = 365; daysAgo >= 0; daysAgo--) {
    const capturedAt = new Date(today);
    capturedAt.setDate(capturedAt.getDate() - daysAgo);

    // Add some growth with slight randomness
    const dailyGrowth = 15 + Math.floor(Math.random() * 20); // 15-35 followers/day
    const followerCount = Math.floor(baseFollowers + dailyGrowth + (Math.random() * 100 - 50));

    await prisma.platformSnapshot.create({
      data: {
        companyId: demoCompany.id,
        platformId: demoLinkedIn!.id,
        capturedAt,
        followerCount,
        postCount: basePosts + Math.floor(daysAgo / 7) // Post count increases weekly
      }
    });

    baseFollowers += dailyGrowth;
    if (daysAgo % 7 === 0) basePosts++; // Post once a week
  }

  console.log('✅ Added demo company follower snapshots');

  // Add competitor (Dasani) snapshots - slower growth
  let dasaniFollowers = 8500;
  let dasaniPosts = 80;

  for (let daysAgo = 365; daysAgo >= 0; daysAgo--) {
    const capturedAt = new Date(today);
    capturedAt.setDate(capturedAt.getDate() - daysAgo);

    const dailyGrowth = 10 + Math.floor(Math.random() * 15); // 10-25 followers/day (slower)
    const followerCount = Math.floor(dasaniFollowers + dailyGrowth + (Math.random() * 80 - 40));

    await prisma.platformSnapshot.create({
      data: {
        companyId: dasaniCompany.id,
        platformId: dasaniLinkedIn!.id,
        capturedAt,
        followerCount,
        postCount: dasaniPosts + Math.floor(daysAgo / 10) // Post less frequently
      }
    });

    dasaniFollowers += dailyGrowth;
    if (daysAgo % 10 === 0) dasaniPosts++;
  }

  console.log('✅ Added competitor follower snapshots');

  // ============================================
  // POSTS & ENGAGEMENT DATA
  // ============================================

  console.log('📝 Adding posts with engagement data...');

  const samplePosts = [
    {
      caption: 'Excited to announce our Q4 results! 📈 Revenue up 45% YoY. Thank you to our amazing team and customers who made this possible. #Growth #Innovation',
      postedDaysAgo: 2,
      impressions: 12500,
      likes: 845,
      comments: 67
    },
    {
      caption: '🚀 Big news! We\'re launching our new AI-powered analytics dashboard next week. Early access available for existing customers. DM us for details!',
      postedDaysAgo: 5,
      impressions: 18200,
      likes: 1240,
      comments: 156
    },
    {
      caption: 'What makes a great product? We asked our customers and the answers might surprise you. Check out our latest blog post (link in comments) 💡',
      postedDaysAgo: 8,
      impressions: 9800,
      likes: 623,
      comments: 45
    },
    {
      caption: 'Team spotlight 🌟 Meet Sarah, our Head of Customer Success. She shares her journey from support agent to leadership and what drives her passion for helping customers succeed.',
      postedDaysAgo: 12,
      impressions: 7500,
      likes: 512,
      comments: 34
    },
    {
      caption: 'Industry insight: 78% of companies say data-driven decision making is their top priority in 2025. Here\'s how we\'re helping businesses achieve that goal 📊',
      postedDaysAgo: 15,
      impressions: 15600,
      likes: 1056,
      comments: 89
    },
    {
      caption: 'Behind the scenes at Vantura HQ 🎥 Our engineering team shares what they\'re working on and how we build features that matter to you.',
      postedDaysAgo: 20,
      impressions: 8900,
      likes: 678,
      comments: 52
    },
    {
      caption: 'Customer success story 💪 See how @TechStartup increased their conversion rate by 3x using our platform. Read the full case study on our website.',
      postedDaysAgo: 25,
      impressions: 11200,
      likes: 892,
      comments: 71
    },
    {
      caption: 'Join us at TechSummit 2025! We\'ll be showcasing our latest features and hosting a workshop on data-driven growth strategies. Register now! 🎟️',
      postedDaysAgo: 30,
      impressions: 13400,
      likes: 945,
      comments: 103
    },
    {
      caption: 'Product update: New integrations with Salesforce, HubSpot, and Google Analytics. Connect your data sources in just a few clicks 🔗',
      postedDaysAgo: 35,
      impressions: 16700,
      likes: 1123,
      comments: 128
    },
    {
      caption: 'Thought leadership: Why competitive intelligence is the secret weapon of high-growth companies. Our CEO shares insights from 10 years in the industry.',
      postedDaysAgo: 40,
      impressions: 14300,
      likes: 987,
      comments: 94
    }
  ];

  for (const postData of samplePosts) {
    const postedAt = new Date(today);
    postedAt.setDate(postedAt.getDate() - postData.postedDaysAgo);

    const post = await prisma.post.create({
      data: {
        companyId: demoCompany.id,
        platformId: linkedin.id,
        platformPostId: `linkedin-post-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        captionText: postData.caption,
        postUrl: `https://linkedin.com/posts/demo-${postData.postedDaysAgo}`,
        mediaType: 'text',
        postedAt
      }
    });

    // Add post snapshot (current engagement metrics)
    await prisma.postSnapshot.create({
      data: {
        postId: post.id,
        capturedAt: new Date(),
        likeCount: postData.likes,
        commentCount: postData.comments
      }
    });

    // Add post analysis with impressions and engagement
    await prisma.postAnalysis.create({
      data: {
        postId: post.id,
        modelVersion: 'gpt-4o-mini',
        impressions: postData.impressions,
        engagement: postData.likes + postData.comments,
        topics: postData.caption.includes('product') ? ['Product', 'Launch'] :
                postData.caption.includes('team') ? ['Team', 'Culture'] :
                postData.caption.includes('data') ? ['Analytics', 'Data'] :
                ['Business', 'Growth'],
        summary: postData.caption.substring(0, 100) + '...',
        entities: ['Vantura'],
        captionSentiment: 0.75,
        avgCommentSentiment: 0.65,
        commentSentimentStd: 0.15,
        medianCommentSentiment: 0.70,
        positiveDescription: 'Positive engagement with strong community response',
        imageDescription: 'Professional business content',
        negativeDescription: 'Minimal negative feedback'
      }
    });
  }

  console.log('✅ Added sample posts with engagement data');

  console.log('\n🎉 Seeding complete!');
  console.log('\n📝 Demo credentials:');
  console.log('   Email: demo@vantura.com');
  console.log('   Token: demo-token-12345');
  console.log('   Company ID: demo-company-1');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
