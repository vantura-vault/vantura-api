import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// TODO: Replace this manual script with BrightData API integration
// This script manually creates competitor data for MVP demo purposes
// Future: Fetch real competitor data via BrightData Social Media API
// See: https://brightdata.com/products/serp-api

async function addRaytheonBlueSkyData() {
  console.log('📝 Adding data for Raytheon and Blue Sky Brews...');

  // Get LinkedIn platform
  const linkedin = await prisma.platform.findUnique({
    where: { name: 'LinkedIn' }
  });

  if (!linkedin) {
    console.error('LinkedIn platform not found');
    return;
  }

  const today = new Date();

  // ============================================
  // RAYTHEON DATA
  // ============================================
  const raytheonId = 'cmh9qm9u50000cq5fwuhvdsq4';

  // Get Raytheon's company platform
  let raytheonPlatform = await prisma.companyPlatform.findFirst({
    where: {
      companyId: raytheonId,
      platformId: linkedin.id
    }
  });

  if (!raytheonPlatform) {
    console.log('Creating Raytheon company platform...');
    raytheonPlatform = await prisma.companyPlatform.create({
      data: {
        companyId: raytheonId,
        platformId: linkedin.id,
        profileUrl: 'https://www.linkedin.com/company/raytheon'
      }
    });
  }

  console.log('\n🏢 Adding Raytheon follower snapshots (365 days)...');

  // Add 365 days of follower snapshots for Raytheon (large defense contractor)
  let raytheonFollowers = 850000; // Start at 850K followers
  let raytheonPosts = 520;

  for (let daysAgo = 365; daysAgo >= 0; daysAgo--) {
    const capturedAt = new Date(today);
    capturedAt.setDate(capturedAt.getDate() - daysAgo);

    // Slow, steady growth typical of large corporations
    const dailyGrowth = 120 + Math.floor(Math.random() * 80); // 120-200 followers/day
    const followerCount = Math.floor(raytheonFollowers + dailyGrowth + (Math.random() * 150 - 75));

    await prisma.platformSnapshot.create({
      data: {
        companyId: raytheonId,
        platformId: raytheonPlatform.id,
        capturedAt,
        followerCount,
        postCount: raytheonPosts + Math.floor((365 - daysAgo) / 7) // Post weekly
      }
    });

    raytheonFollowers += dailyGrowth;
    if (daysAgo % 7 === 0) raytheonPosts++;
  }

  console.log('✅ Added Raytheon follower snapshots');

  // Add 15 Raytheon posts (defense/aerospace content)
  const raytheonPosts_data = [
    {
      caption: '🚀 Innovation in aerospace: Our new hypersonic missile system completed successful testing. Advancing national defense capabilities. #Defense #Aerospace #Innovation',
      daysAgo: 2,
      impressions: 145000,
      likes: 8200,
      comments: 456
    },
    {
      caption: 'Proud to announce a $2.3B contract with the U.S. Department of Defense for next-generation radar systems. Securing the future. #DefenseContract',
      daysAgo: 5,
      impressions: 210000,
      likes: 12500,
      comments: 892
    },
    {
      caption: 'Employee spotlight: Meet Dr. Sarah Chen, leading our quantum computing research. Her work is shaping the future of secure communications. #STEM #WomenInTech',
      daysAgo: 7,
      impressions: 98000,
      likes: 6100,
      comments: 234
    },
    {
      caption: 'Raytheon at Paris Air Show: Showcasing our latest aviation technology and defense systems to global partners. #AirShow2025 #Aerospace',
      daysAgo: 10,
      impressions: 167000,
      likes: 9800,
      comments: 567
    },
    {
      caption: 'Sustainability commitment: Reducing our carbon footprint by 40% by 2030. Defense innovation doesn\'t mean compromising our planet. 🌍 #Sustainability',
      daysAgo: 12,
      impressions: 123000,
      likes: 7300,
      comments: 412
    },
    {
      caption: 'Cyber defense update: Our AI-powered threat detection system prevented 10M+ cyber attacks last quarter. Protecting critical infrastructure. #Cybersecurity',
      daysAgo: 15,
      impressions: 189000,
      likes: 11200,
      comments: 678
    },
    {
      caption: 'Veteran hiring initiative: We\'ve hired 5,000+ veterans this year. Supporting those who served. Thank you for your service. 🇺🇸 #Veterans #HiringHeroes',
      daysAgo: 18,
      impressions: 156000,
      likes: 14500,
      comments: 1234
    },
    {
      caption: 'Space exploration partnership: Working with NASA on next-gen satellite systems for deep space communication. The future is beyond Earth. 🛰️',
      daysAgo: 21,
      impressions: 198000,
      likes: 13400,
      comments: 891
    },
    {
      caption: 'Q2 earnings report: Revenue up 12% YoY. Strong performance across all defense segments. Investor call transcript available. #Earnings',
      daysAgo: 24,
      impressions: 134000,
      likes: 5600,
      comments: 289
    },
    {
      caption: 'Missile defense breakthrough: Successfully intercepted multiple simultaneous targets in live testing. Game-changing capability. #MissileDefense',
      daysAgo: 27,
      impressions: 176000,
      likes: 10100,
      comments: 623
    },
    {
      caption: 'STEM education: Our foundation donated $50M to engineering programs at HBCUs. Investing in the next generation of innovators. #Education',
      daysAgo: 30,
      impressions: 112000,
      likes: 8700,
      comments: 445
    },
    {
      caption: 'Autonomous systems: Our AI-controlled reconnaissance drones are reshaping battlefield intelligence. The future of defense is here. 🤖',
      daysAgo: 33,
      impressions: 201000,
      likes: 11900,
      comments: 734
    },
    {
      caption: 'Supplier diversity initiative: 30% of our contracts now go to small and minority-owned businesses. Building a stronger supply chain together. #Diversity',
      daysAgo: 36,
      impressions: 87000,
      likes: 5400,
      comments: 198
    },
    {
      caption: 'Naval systems update: Our next-gen destroyer radar system enters production phase. Protecting our seas with cutting-edge technology. ⚓',
      daysAgo: 39,
      impressions: 145000,
      likes: 8900,
      comments: 412
    },
    {
      caption: 'Thank you to our 890K followers! Your engagement drives us to push the boundaries of what\'s possible in defense and aerospace. 🚀',
      daysAgo: 42,
      impressions: 167000,
      likes: 16200,
      comments: 1567
    }
  ];

  console.log('\n📝 Adding Raytheon posts...');

  for (const postData of raytheonPosts_data) {
    const postedAt = new Date(today);
    postedAt.setDate(postedAt.getDate() - postData.daysAgo);

    const post = await prisma.post.create({
      data: {
        companyId: raytheonId,
        platformId: linkedin.id,
        platformPostId: `linkedin-raytheon-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        captionText: postData.caption,
        postUrl: `https://linkedin.com/posts/raytheon-${postData.daysAgo}`,
        mediaType: 'text',
        postedAt
      }
    });

    await prisma.postSnapshot.create({
      data: {
        postId: post.id,
        capturedAt: new Date(),
        likeCount: postData.likes,
        commentCount: postData.comments
      }
    });

    await prisma.postAnalysis.create({
      data: {
        postId: post.id,
        modelVersion: 'gpt-4o-mini',
        impressions: postData.impressions,
        engagement: postData.likes + postData.comments,
        topics: postData.caption.includes('cyber') || postData.caption.includes('AI') ? ['Technology', 'Defense'] :
                postData.caption.includes('veteran') || postData.caption.includes('hiring') ? ['Veterans', 'Careers'] :
                postData.caption.includes('contract') || postData.caption.includes('earnings') ? ['Business', 'Finance'] :
                postData.caption.includes('space') || postData.caption.includes('aerospace') ? ['Aerospace', 'Innovation'] :
                ['Defense', 'National Security'],
        summary: postData.caption.substring(0, 100) + '...',
        entities: ['Raytheon', 'Defense', 'Aerospace'],
        captionSentiment: 0.70,
        avgCommentSentiment: 0.65,
        commentSentimentStd: 0.22,
        medianCommentSentiment: 0.68,
        positiveDescription: 'Professional engagement from defense industry audience',
        imageDescription: 'Corporate defense and aerospace content',
        negativeDescription: 'Some concerns about military applications'
      }
    });

    console.log(`✅ Added Raytheon post: ${postData.caption.substring(0, 50)}...`);
  }

  // ============================================
  // BLUE SKY BREWS DATA
  // ============================================
  const blueSkyId = 'cmh9riyxq0008cq5fh1qbzwcd';

  // Get Blue Sky Brews' company platform
  let blueSkyPlatform = await prisma.companyPlatform.findFirst({
    where: {
      companyId: blueSkyId,
      platformId: linkedin.id
    }
  });

  if (!blueSkyPlatform) {
    console.log('\nCreating Blue Sky Brews company platform...');
    blueSkyPlatform = await prisma.companyPlatform.create({
      data: {
        companyId: blueSkyId,
        platformId: linkedin.id,
        profileUrl: 'https://linkedin.com/company/blueskybrews'
      }
    });
  }

  console.log('\n🍺 Adding Blue Sky Brews follower snapshots (365 days)...');

  // Add 365 days of follower snapshots for Blue Sky Brews (craft brewery)
  let blueSkyFollowers = 12000; // Start at 12K followers
  let blueSkyPosts = 180;

  for (let daysAgo = 365; daysAgo >= 0; daysAgo--) {
    const capturedAt = new Date(today);
    capturedAt.setDate(capturedAt.getDate() - daysAgo);

    // Faster growth typical of trending craft beverage brands
    const dailyGrowth = 25 + Math.floor(Math.random() * 30); // 25-55 followers/day
    const followerCount = Math.floor(blueSkyFollowers + dailyGrowth + (Math.random() * 60 - 30));

    await prisma.platformSnapshot.create({
      data: {
        companyId: blueSkyId,
        platformId: blueSkyPlatform.id,
        capturedAt,
        followerCount,
        postCount: blueSkyPosts + Math.floor((365 - daysAgo) / 3) // Post 2-3x per week
      }
    });

    blueSkyFollowers += dailyGrowth;
    if (daysAgo % 3 === 0) blueSkyPosts++;
  }

  console.log('✅ Added Blue Sky Brews follower snapshots');

  // Add 18 Blue Sky Brews posts (craft beverage content)
  const blueSkyPosts_data = [
    {
      caption: '🍺 New release alert! "Sunset Haze IPA" drops this Friday. Tropical notes meet west coast vibes. Limited batch - don\'t miss out! #CraftBeer #IPA',
      daysAgo: 1,
      impressions: 34000,
      likes: 2800,
      comments: 312
    },
    {
      caption: 'Behind the brew: Our head brewer shares the secrets to our award-winning Amber Ale. Watch the full video! 🎥 #CraftBrewing #BehindTheScenes',
      daysAgo: 3,
      impressions: 28000,
      likes: 2100,
      comments: 178
    },
    {
      caption: 'BIG NEWS: Blue Sky Brews is now available in 500+ stores across California! Find us near you. Link in bio. 📍 #Expansion #CraftBeer',
      daysAgo: 5,
      impressions: 52000,
      likes: 4200,
      comments: 567
    },
    {
      caption: 'Community first: We donated $10K to local food banks this month. Brewing good beer, doing good things. 💙 #GiveBack #Community',
      daysAgo: 7,
      impressions: 19000,
      likes: 1650,
      comments: 134
    },
    {
      caption: 'Brewery tour this Saturday! Come taste our seasonal brews and meet the team. RSVP in comments! 🍻 #BreweryTour #CraftBeer',
      daysAgo: 9,
      impressions: 23000,
      likes: 1890,
      comments: 289
    },
    {
      caption: 'Taste test results are in! Our "Midnight Stout" rated 4.8/5 by Beer Advocate. You asked, we delivered. Dark, smooth, perfect. 🌙',
      daysAgo: 11,
      impressions: 31000,
      likes: 2600,
      comments: 223
    },
    {
      caption: 'Sustainable brewing: 100% solar-powered facility, zero-waste operations. Good beer doesn\'t have to cost the Earth. 🌱♻️ #Sustainability',
      daysAgo: 13,
      impressions: 27000,
      likes: 2200,
      comments: 167
    },
    {
      caption: '🎉 1 MILLION CANS SOLD! Thank you to our incredible community. This is just the beginning. Cheers to you! 🙌',
      daysAgo: 15,
      impressions: 67000,
      likes: 6800,
      comments: 891
    },
    {
      caption: 'Collab alert: Teaming up with @LocalRoasters for a Coffee Porter. Beer meets coffee. Two obsessions, one can. Coming soon! ☕🍺',
      daysAgo: 17,
      impressions: 41000,
      likes: 3400,
      comments: 445
    },
    {
      caption: 'Friday vibes: Which Blue Sky brew are you cracking open this weekend? Drop your favorite in the comments! 🍻 #WeekendVibes',
      daysAgo: 19,
      impressions: 18000,
      likes: 1450,
      comments: 312
    },
    {
      caption: 'Awards night! Our Pale Ale just won Gold at the California Craft Beer Competition. Hard work pays off! 🏆 #AwardWinning',
      daysAgo: 21,
      impressions: 38000,
      likes: 3100,
      comments: 278
    },
    {
      caption: 'Meet our brewing team: 12 passionate craftspeople making magic every day. This is what dedication looks like. 👨‍🍳👩‍🍳 #TeamBlueSky',
      daysAgo: 23,
      impressions: 22000,
      likes: 1780,
      comments: 134
    },
    {
      caption: 'Hot take: Sour beers are underrated. Our new "Citrus Burst Sour" will change your mind. Tart, refreshing, different. 🍋',
      daysAgo: 25,
      impressions: 29000,
      likes: 2300,
      comments: 412
    },
    {
      caption: 'Taproom Tuesdays: $5 pints, live music, good people. See you tonight! 🎸🍺 #TaproomTuesday #LocalMusic',
      daysAgo: 27,
      impressions: 16000,
      likes: 1340,
      comments: 189
    },
    {
      caption: 'Food pairing guide: What to eat with your Blue Sky brews. Our IPA + spicy tacos = perfection. Full guide on our blog! 🌮🍺',
      daysAgo: 30,
      impressions: 25000,
      likes: 1980,
      comments: 156
    },
    {
      caption: 'Summer lineup revealed: 4 new seasonal brews dropping June-August. Which one are you most excited about? Vote below! ☀️🍺',
      daysAgo: 33,
      impressions: 44000,
      likes: 3600,
      comments: 678
    },
    {
      caption: 'Brewing trivia: Did you know our founder started in his garage 5 years ago? From 10 gallons to 10,000. Dreams do come true. 💙',
      daysAgo: 36,
      impressions: 31000,
      likes: 2800,
      comments: 234
    },
    {
      caption: 'Job opening: Looking for an assistant brewer to join our team! Passion for craft beer required. Apply now. #NowHiring #CraftBeerJobs',
      daysAgo: 39,
      impressions: 21000,
      likes: 1250,
      comments: 203
    }
  ];

  console.log('\n📝 Adding Blue Sky Brews posts...');

  for (const postData of blueSkyPosts_data) {
    const postedAt = new Date(today);
    postedAt.setDate(postedAt.getDate() - postData.daysAgo);

    const post = await prisma.post.create({
      data: {
        companyId: blueSkyId,
        platformId: linkedin.id,
        platformPostId: `linkedin-bluesky-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        captionText: postData.caption,
        postUrl: `https://linkedin.com/posts/blueskybrews-${postData.daysAgo}`,
        mediaType: 'text',
        postedAt
      }
    });

    await prisma.postSnapshot.create({
      data: {
        postId: post.id,
        capturedAt: new Date(),
        likeCount: postData.likes,
        commentCount: postData.comments
      }
    });

    await prisma.postAnalysis.create({
      data: {
        postId: post.id,
        modelVersion: 'gpt-4o-mini',
        impressions: postData.impressions,
        engagement: postData.likes + postData.comments,
        topics: postData.caption.includes('new') || postData.caption.includes('release') ? ['Product Launch', 'New Release'] :
                postData.caption.includes('community') || postData.caption.includes('local') ? ['Community', 'Social Impact'] :
                postData.caption.includes('sustainable') || postData.caption.includes('solar') ? ['Sustainability', 'Environment'] :
                postData.caption.includes('award') ? ['Awards', 'Achievement'] :
                ['Craft Beer', 'Beverage'],
        summary: postData.caption.substring(0, 100) + '...',
        entities: ['Blue Sky Brews', 'Craft Beer', 'Beverage'],
        captionSentiment: 0.88,
        avgCommentSentiment: 0.82,
        commentSentimentStd: 0.14,
        medianCommentSentiment: 0.85,
        positiveDescription: 'Highly engaged craft beer community with enthusiastic response',
        imageDescription: 'Craft brewery and product content',
        negativeDescription: 'Minimal negative feedback'
      }
    });

    console.log(`✅ Added Blue Sky Brews post: ${postData.caption.substring(0, 50)}...`);
  }

  // Calculate and display stats
  console.log('\n📊 Final Statistics:');

  const raytheonPostsCount = await prisma.post.count({ where: { companyId: raytheonId } });
  const raytheonPostsData = await prisma.post.findMany({
    where: { companyId: raytheonId },
    include: { analysis: true }
  });
  const raytheonImpressions = raytheonPostsData.reduce((sum, p) => sum + (p.analysis?.impressions || 0), 0);
  const raytheonEngagement = raytheonPostsData.reduce((sum, p) => sum + (p.analysis?.engagement || 0), 0);
  const raytheonEngagementRate = raytheonImpressions > 0 ? (raytheonEngagement / raytheonImpressions) * 100 : 0;

  console.log('\n🏢 Raytheon:');
  console.log(`   Total Posts: ${raytheonPostsCount}`);
  console.log(`   Total Followers: ~${raytheonFollowers.toLocaleString()}`);
  console.log(`   Total Impressions: ${raytheonImpressions.toLocaleString()}`);
  console.log(`   Avg Engagement Rate: ${raytheonEngagementRate.toFixed(2)}%`);

  const blueSkyPostsCount = await prisma.post.count({ where: { companyId: blueSkyId } });
  const blueSkyPostsData = await prisma.post.findMany({
    where: { companyId: blueSkyId },
    include: { analysis: true }
  });
  const blueSkyImpressions = blueSkyPostsData.reduce((sum, p) => sum + (p.analysis?.impressions || 0), 0);
  const blueSkyEngagement = blueSkyPostsData.reduce((sum, p) => sum + (p.analysis?.engagement || 0), 0);
  const blueSkyEngagementRate = blueSkyImpressions > 0 ? (blueSkyEngagement / blueSkyImpressions) * 100 : 0;

  console.log('\n🍺 Blue Sky Brews:');
  console.log(`   Total Posts: ${blueSkyPostsCount}`);
  console.log(`   Total Followers: ~${blueSkyFollowers.toLocaleString()}`);
  console.log(`   Total Impressions: ${blueSkyImpressions.toLocaleString()}`);
  console.log(`   Avg Engagement Rate: ${blueSkyEngagementRate.toFixed(2)}%`);

  console.log('\n🎉 Successfully added data for Raytheon and Blue Sky Brews!');
}

addRaytheonBlueSkyData()
  .catch((e) => {
    console.error('❌ Error adding data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
