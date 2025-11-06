import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// TODO: Replace this manual script with BrightData API integration
// This script manually creates competitor posts for MVP demo purposes
// Future: Fetch real competitor posts via BrightData Social Media API
// See: https://brightdata.com/products/serp-api

async function addCompetitorPosts() {
  console.log('📝 Adding competitor posts for Dasani...');

  const dasaniCompanyId = 'competitor-dasani';

  // Get LinkedIn platform
  const linkedin = await prisma.platform.findUnique({
    where: { name: 'LinkedIn' }
  });

  if (!linkedin) {
    console.error('LinkedIn platform not found');
    return;
  }

  const today = new Date();

  // Create 20 posts for Dasani with varying engagement levels
  // Generally lower than demo company to show competitive advantage
  const dasaniPosts = [
    {
      caption: 'Staying hydrated is key to peak performance. Our purified water helps you stay refreshed all day. #Hydration #Wellness',
      daysAgo: 1,
      impressions: 28000,
      likes: 1800,
      comments: 120
    },
    {
      caption: 'New sustainable packaging announcement coming soon! We\'re committed to reducing our environmental footprint. 🌍 #Sustainability',
      daysAgo: 2,
      impressions: 32000,
      likes: 2100,
      comments: 145
    },
    {
      caption: 'Did you know? Drinking water can boost your productivity by up to 14%. Stay hydrated, stay productive. 💧',
      daysAgo: 4,
      impressions: 24000,
      likes: 1600,
      comments: 98
    },
    {
      caption: 'Behind the scenes at our bottling facility. Quality and purity in every drop. [Video]',
      daysAgo: 5,
      impressions: 35000,
      likes: 2400,
      comments: 167
    },
    {
      caption: 'Summer hydration tips from our wellness experts. Read more on our blog! ☀️',
      daysAgo: 7,
      impressions: 21000,
      likes: 1450,
      comments: 87
    },
    {
      caption: 'Proud to support local communities with clean water initiatives. Together we make a difference. 🤝',
      daysAgo: 9,
      impressions: 29000,
      likes: 1950,
      comments: 132
    },
    {
      caption: 'What\'s your favorite way to stay hydrated during workouts? Drop your tips below! 💪',
      daysAgo: 11,
      impressions: 19000,
      likes: 1300,
      comments: 215
    },
    {
      caption: 'New flavor-infused water line launching next month! Which flavor are you most excited about? 🍋🍓',
      daysAgo: 12,
      impressions: 41000,
      likes: 3100,
      comments: 428
    },
    {
      caption: 'Hydration myths debunked. Our team of experts separates fact from fiction. Thread 🧵',
      daysAgo: 14,
      impressions: 26000,
      likes: 1750,
      comments: 103
    },
    {
      caption: 'Thank you to our 25K followers! Your support means everything to us. Here\'s to staying hydrated together! 🎉',
      daysAgo: 16,
      impressions: 38000,
      likes: 2800,
      comments: 234
    },
    {
      caption: 'Meet our sustainability team: Working every day to make our packaging 100% recyclable by 2025.',
      daysAgo: 18,
      impressions: 23000,
      likes: 1550,
      comments: 89
    },
    {
      caption: 'Science fact: Your body is 60% water. Keep it balanced with pure, refreshing hydration. 🔬',
      daysAgo: 20,
      impressions: 18000,
      likes: 1200,
      comments: 67
    },
    {
      caption: 'Partner spotlight: How we\'re working with gyms nationwide to promote healthy hydration habits.',
      daysAgo: 22,
      impressions: 27000,
      likes: 1850,
      comments: 112
    },
    {
      caption: 'Hot weather alert! Don\'t forget to increase your water intake during heat waves. Stay safe! 🌡️',
      daysAgo: 24,
      impressions: 31000,
      likes: 2200,
      comments: 156
    },
    {
      caption: 'Our commitment to quality: 13 rigorous testing stages ensure every bottle meets our standards.',
      daysAgo: 26,
      impressions: 22000,
      likes: 1500,
      comments: 78
    },
    {
      caption: 'Workplace wellness tip: Keep a water bottle at your desk. Small habits, big impact. 💼',
      daysAgo: 28,
      impressions: 17000,
      likes: 1150,
      comments: 62
    },
    {
      caption: 'Customer appreciation post! Share your Dasani moment with #MyDasaniMoment for a chance to be featured.',
      daysAgo: 30,
      impressions: 25000,
      likes: 1700,
      comments: 189
    },
    {
      caption: 'Industry insight: The bottled water market is evolving. Here\'s how we\'re staying ahead of the curve.',
      daysAgo: 33,
      impressions: 20000,
      likes: 1400,
      comments: 93
    },
    {
      caption: 'Refreshing news: Our new SmartCap technology tracks your daily water intake. Innovation meets hydration!',
      daysAgo: 36,
      impressions: 44000,
      likes: 3400,
      comments: 387
    },
    {
      caption: 'Join us at Health Expo 2025! We\'ll be showcasing our latest innovations in hydration technology.',
      daysAgo: 38,
      impressions: 19000,
      likes: 1300,
      comments: 71
    }
  ];

  for (const postData of dasaniPosts) {
    const postedAt = new Date(today);
    postedAt.setDate(postedAt.getDate() - postData.daysAgo);

    const post = await prisma.post.create({
      data: {
        companyId: dasaniCompanyId,
        platformId: linkedin.id,
        platformPostId: `linkedin-dasani-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        captionText: postData.caption,
        postUrl: `https://linkedin.com/posts/dasani-${postData.daysAgo}`,
        mediaType: postData.caption.includes('Video') ? 'video' : postData.caption.includes('Carousel') ? 'carousel' : 'text',
        postedAt
      }
    });

    // Add post snapshot
    await prisma.postSnapshot.create({
      data: {
        postId: post.id,
        capturedAt: new Date(),
        likeCount: postData.likes,
        commentCount: postData.comments
      }
    });

    // Add post analysis with engagement metrics
    await prisma.postAnalysis.create({
      data: {
        postId: post.id,
        modelVersion: 'gpt-4o-mini',
        impressions: postData.impressions,
        engagement: postData.likes + postData.comments,
        topics: postData.caption.includes('sustainability') || postData.caption.includes('environmental') ? ['Sustainability', 'Environment'] :
                postData.caption.includes('health') || postData.caption.includes('wellness') ? ['Health', 'Wellness'] :
                postData.caption.includes('innovation') || postData.caption.includes('technology') ? ['Innovation', 'Technology'] :
                postData.caption.includes('community') ? ['Community', 'Social Impact'] :
                ['Hydration', 'Product'],
        summary: postData.caption.substring(0, 100) + '...',
        entities: ['Dasani', 'Hydration', 'Water'],
        captionSentiment: 0.72,
        avgCommentSentiment: 0.68,
        commentSentimentStd: 0.18,
        medianCommentSentiment: 0.70,
        positiveDescription: 'Positive community engagement with moderate response',
        imageDescription: 'Professional brand content',
        negativeDescription: 'Some concerns about plastic packaging'
      }
    });

    console.log(`✅ Added Dasani post: ${postData.caption.substring(0, 50)}...`);
  }

  console.log('\n🎉 Successfully added 20 competitor posts for Dasani!');

  // Calculate and display competitor engagement stats
  const allDasaniPosts = await prisma.post.findMany({
    where: { companyId: dasaniCompanyId },
    include: { analysis: true }
  });

  const totalImpressions = allDasaniPosts.reduce((sum, p) => sum + (p.analysis?.impressions || 0), 0);
  const totalEngagement = allDasaniPosts.reduce((sum, p) => sum + (p.analysis?.engagement || 0), 0);
  const avgEngagementRate = totalImpressions > 0 ? (totalEngagement / totalImpressions) * 100 : 0;

  console.log('\n📊 Dasani Engagement Stats:');
  console.log(`   Total Posts: ${allDasaniPosts.length}`);
  console.log(`   Total Impressions: ${totalImpressions.toLocaleString()}`);
  console.log(`   Total Engagement: ${totalEngagement.toLocaleString()}`);
  console.log(`   Avg Engagement Rate: ${avgEngagementRate.toFixed(2)}%`);
}

addCompetitorPosts()
  .catch((e) => {
    console.error('❌ Error adding competitor posts:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
