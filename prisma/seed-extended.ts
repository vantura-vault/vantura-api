import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Extended seeding: Adding data for Ethan and Poppi competitors...');

  // Get Ethan's company
  const ethanCompany = await prisma.company.findFirst({
    where: { name: 'Poppi' }
  });

  if (!ethanCompany) {
    console.error('❌ Could not find Ethan\'s Poppi company');
    return;
  }

  console.log('✅ Found Ethan\'s company:', ethanCompany.name);

  // Get platforms
  const linkedin = await prisma.platform.findFirst({ where: { name: 'LinkedIn' } });
  const twitter = await prisma.platform.findFirst({ where: { name: 'Twitter' } });
  const instagram = await prisma.platform.findFirst({ where: { name: 'Instagram' } });

  if (!linkedin || !twitter || !instagram) {
    console.error('❌ Platforms not found');
    return;
  }

  // ============================================
  // 1. ADD PLATFORMS TO ETHAN'S COMPANY
  // ============================================
  console.log('\n📱 Adding platforms to Ethan\'s company...');

  const ethanLinkedIn = await prisma.companyPlatform.upsert({
    where: {
      companyId_platformId: {
        companyId: ethanCompany.id,
        platformId: linkedin.id
      }
    },
    update: {},
    create: {
      companyId: ethanCompany.id,
      platformId: linkedin.id,
      profileUrl: 'https://linkedin.com/company/drinkpoppi'
    }
  });

  const ethanTwitter = await prisma.companyPlatform.upsert({
    where: {
      companyId_platformId: {
        companyId: ethanCompany.id,
        platformId: twitter.id
      }
    },
    update: {},
    create: {
      companyId: ethanCompany.id,
      platformId: twitter.id,
      profileUrl: 'https://twitter.com/drinkpoppi'
    }
  });

  const ethanInstagram = await prisma.companyPlatform.upsert({
    where: {
      companyId_platformId: {
        companyId: ethanCompany.id,
        platformId: instagram.id
      }
    },
    update: {},
    create: {
      companyId: ethanCompany.id,
      platformId: instagram.id,
      profileUrl: 'https://instagram.com/drinkpoppi'
    }
  });

  console.log('✅ Added LinkedIn, Twitter, and Instagram for Ethan\'s company');

  // ============================================
  // 2. ADD PLATFORM SNAPSHOTS FOR ETHAN'S COMPANY
  // ============================================
  console.log('\n📊 Adding platform snapshots for Ethan\'s company...');

  const today = new Date();

  // LinkedIn snapshots - 365 days of growth
  let linkedInFollowers = 25000;
  let linkedInPosts = 150;

  for (let daysAgo = 365; daysAgo >= 0; daysAgo--) {
    const capturedAt = new Date(today);
    capturedAt.setDate(capturedAt.getDate() - daysAgo);

    const dailyGrowth = 30 + Math.floor(Math.random() * 25); // 30-55 followers/day
    const followerCount = Math.floor(linkedInFollowers + dailyGrowth + (Math.random() * 100 - 50));

    await prisma.platformSnapshot.create({
      data: {
        companyId: ethanCompany.id,
        platformId: ethanLinkedIn.id,
        capturedAt,
        followerCount,
        postCount: linkedInPosts + Math.floor(daysAgo / 5)
      }
    });

    linkedInFollowers += dailyGrowth;
    if (daysAgo % 5 === 0) linkedInPosts++; // Post every 5 days
  }

  console.log('✅ Added LinkedIn snapshots');

  // Twitter snapshots - 365 days
  let twitterFollowers = 18000;
  let twitterPosts = 300;

  for (let daysAgo = 365; daysAgo >= 0; daysAgo--) {
    const capturedAt = new Date(today);
    capturedAt.setDate(capturedAt.getDate() - daysAgo);

    const dailyGrowth = 20 + Math.floor(Math.random() * 20); // 20-40 followers/day
    const followerCount = Math.floor(twitterFollowers + dailyGrowth + (Math.random() * 80 - 40));

    await prisma.platformSnapshot.create({
      data: {
        companyId: ethanCompany.id,
        platformId: ethanTwitter.id,
        capturedAt,
        followerCount,
        postCount: twitterPosts + Math.floor(daysAgo / 3)
      }
    });

    twitterFollowers += dailyGrowth;
    if (daysAgo % 3 === 0) twitterPosts++; // Post every 3 days
  }

  console.log('✅ Added Twitter snapshots');

  // Instagram snapshots - 365 days
  let instagramFollowers = 45000;
  let instagramPosts = 200;

  for (let daysAgo = 365; daysAgo >= 0; daysAgo--) {
    const capturedAt = new Date(today);
    capturedAt.setDate(capturedAt.getDate() - daysAgo);

    const dailyGrowth = 50 + Math.floor(Math.random() * 30); // 50-80 followers/day
    const followerCount = Math.floor(instagramFollowers + dailyGrowth + (Math.random() * 120 - 60));

    await prisma.platformSnapshot.create({
      data: {
        companyId: ethanCompany.id,
        platformId: ethanInstagram.id,
        capturedAt,
        followerCount,
        postCount: instagramPosts + Math.floor(daysAgo / 4)
      }
    });

    instagramFollowers += dailyGrowth;
    if (daysAgo % 4 === 0) instagramPosts++; // Post every 4 days
  }

  console.log('✅ Added Instagram snapshots');

  // ============================================
  // 3. ADD POSTS FOR ETHAN'S COMPANY
  // ============================================
  console.log('\n📝 Adding posts for Ethan\'s company...');

  const ethanPosts = [
    {
      caption: 'NEW FLAVOR ALERT 🚀 Strawberry Lemon is here! Our most refreshing flavor yet. Grab it at your local store or on our website. #DrinkPoppi #HealthySoda',
      postedDaysAgo: 1,
      platform: linkedin.id,
      impressions: 28500,
      likes: 2340,
      comments: 187
    },
    {
      caption: 'Behind the scenes at Poppi HQ 🎥 Our team working hard to bring you the best gut-healthy beverages. Thanks for the love! 💜',
      postedDaysAgo: 3,
      platform: instagram.id,
      impressions: 45200,
      likes: 4120,
      comments: 234
    },
    {
      caption: 'Just dropped: Our Q4 results are in! 📈 150% growth YoY. Thank you to our amazing community for supporting healthy refreshment. More exciting news coming soon! #Growth',
      postedDaysAgo: 5,
      platform: linkedin.id,
      impressions: 32100,
      likes: 2890,
      comments: 198
    },
    {
      caption: 'Poppi > regular soda 🥤✨ Made with real fruit juice, apple cider vinegar, and prebiotics. Which flavor is your favorite? Drop a 💜 below!',
      postedDaysAgo: 7,
      platform: twitter.id,
      impressions: 52300,
      likes: 3420,
      comments: 412
    },
    {
      caption: 'Wellness Wednesday 💪 Did you know? Poppi contains prebiotics that support gut health. Delicious AND good for you. Win-win! 🎉',
      postedDaysAgo: 10,
      platform: instagram.id,
      impressions: 38700,
      likes: 3210,
      comments: 156
    },
    {
      caption: 'We\'re hiring! 🌟 Join the Poppi team as we expand nationwide. Check out our careers page for open positions. Let\'s grow together!',
      postedDaysAgo: 12,
      platform: linkedin.id,
      impressions: 21400,
      likes: 1560,
      comments: 89
    },
    {
      caption: 'Customer love 💜 "Poppi helped me quit regular soda for good!" - Sarah M. Share your Poppi story in the comments! #PoppiFam',
      postedDaysAgo: 15,
      platform: twitter.id,
      impressions: 44200,
      likes: 2890,
      comments: 321
    },
    {
      caption: 'Now available at Target! 🎯 Find Poppi in the beverage aisle at 1,500+ Target stores nationwide. Tag us when you spot us! #DrinkPoppi',
      postedDaysAgo: 18,
      platform: instagram.id,
      impressions: 61200,
      likes: 5340,
      comments: 478
    },
    {
      caption: 'Innovation spotlight: How we\'re using sustainable packaging to reduce our environmental impact 🌍 Our new cans are 100% recyclable!',
      postedDaysAgo: 21,
      platform: linkedin.id,
      impressions: 26800,
      likes: 1890,
      comments: 112
    },
    {
      caption: 'Summer vibes with Poppi 🌞 Orange cream soda on a hot day hits different. What\'s your go-to summer flavor?',
      postedDaysAgo: 25,
      platform: instagram.id,
      impressions: 42100,
      likes: 3670,
      comments: 289
    },
  ];

  for (const postData of ethanPosts) {
    const postedAt = new Date(today);
    postedAt.setDate(postedAt.getDate() - postData.postedDaysAgo);

    const post = await prisma.post.create({
      data: {
        companyId: ethanCompany.id,
        platformId: postData.platform,
        platformPostId: `post-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        captionText: postData.caption,
        postUrl: `https://social.example.com/post-${postData.postedDaysAgo}`,
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
        topics: ['Beverage', 'Health', 'Lifestyle'],
        summary: postData.caption.substring(0, 100),
        entities: ['Poppi'],
        captionSentiment: 0.85,
        avgCommentSentiment: 0.78,
        commentSentimentStd: 0.12,
        medianCommentSentiment: 0.80,
        positiveDescription: 'Strong positive engagement from health-conscious audience',
        imageDescription: 'Product-focused lifestyle imagery',
        negativeDescription: 'Minimal negative feedback'
      }
    });
  }

  console.log('✅ Added 10 posts with engagement data for Ethan\'s company');

  // ============================================
  // 4. ADD COMPETITORS TO ETHAN'S COMPANY
  // ============================================
  console.log('\n🏢 Adding competitors to Ethan\'s company...');

  // Competitor 1: Olipop
  const olipopCompany = await prisma.company.upsert({
    where: { id: 'competitor-olipop' },
    update: {},
    create: {
      id: 'competitor-olipop',
      name: 'Olipop',
      industry: 'Food & Beverage',
      description: 'Functional soda with prebiotics and botanicals'
    }
  });

  await prisma.companyRelationship.upsert({
    where: {
      companyAId_companyBId: {
        companyAId: ethanCompany.id,
        companyBId: olipopCompany.id
      }
    },
    update: {},
    create: {
      companyAId: ethanCompany.id,
      companyBId: olipopCompany.id,
      relationshipType: 'competitor'
    }
  });

  const olipopLinkedIn = await prisma.companyPlatform.upsert({
    where: {
      companyId_platformId: {
        companyId: olipopCompany.id,
        platformId: linkedin.id
      }
    },
    update: {},
    create: {
      companyId: olipopCompany.id,
      platformId: linkedin.id,
      profileUrl: 'https://linkedin.com/company/drinkolipop'
    }
  });

  // Add Olipop snapshots
  let olipopFollowers = 22000;
  for (let daysAgo = 365; daysAgo >= 0; daysAgo--) {
    const capturedAt = new Date(today);
    capturedAt.setDate(capturedAt.getDate() - daysAgo);

    const dailyGrowth = 25 + Math.floor(Math.random() * 20);
    const followerCount = Math.floor(olipopFollowers + dailyGrowth + (Math.random() * 90 - 45));

    await prisma.platformSnapshot.create({
      data: {
        companyId: olipopCompany.id,
        platformId: olipopLinkedIn.id,
        capturedAt,
        followerCount,
        postCount: 120 + Math.floor(daysAgo / 6)
      }
    });

    olipopFollowers += dailyGrowth;
  }

  console.log('✅ Added Olipop as competitor with snapshots');

  // Competitor 2: Culture Pop
  const culturePopCompany = await prisma.company.upsert({
    where: { id: 'competitor-culturepop' },
    update: {},
    create: {
      id: 'competitor-culturepop',
      name: 'Culture Pop',
      industry: 'Food & Beverage',
      description: 'Probiotic soda for gut health'
    }
  });

  await prisma.companyRelationship.upsert({
    where: {
      companyAId_companyBId: {
        companyAId: ethanCompany.id,
        companyBId: culturePopCompany.id
      }
    },
    update: {},
    create: {
      companyAId: ethanCompany.id,
      companyBId: culturePopCompany.id,
      relationshipType: 'competitor'
    }
  });

  const culturePopLinkedIn = await prisma.companyPlatform.upsert({
    where: {
      companyId_platformId: {
        companyId: culturePopCompany.id,
        platformId: linkedin.id
      }
    },
    update: {},
    create: {
      companyId: culturePopCompany.id,
      platformId: linkedin.id,
      profileUrl: 'https://linkedin.com/company/culturepopsoda'
    }
  });

  // Add Culture Pop snapshots
  let culturePopFollowers = 15000;
  for (let daysAgo = 365; daysAgo >= 0; daysAgo--) {
    const capturedAt = new Date(today);
    capturedAt.setDate(capturedAt.getDate() - daysAgo);

    const dailyGrowth = 18 + Math.floor(Math.random() * 15);
    const followerCount = Math.floor(culturePopFollowers + dailyGrowth + (Math.random() * 70 - 35));

    await prisma.platformSnapshot.create({
      data: {
        companyId: culturePopCompany.id,
        platformId: culturePopLinkedIn.id,
        capturedAt,
        followerCount,
        postCount: 90 + Math.floor(daysAgo / 7)
      }
    });

    culturePopFollowers += dailyGrowth;
  }

  console.log('✅ Added Culture Pop as competitor with snapshots');

  // ============================================
  // 5. ADD 2 COMPETITORS TO DEMO-COMPANY-1 (Poppi)
  // ============================================
  console.log('\n🏢 Adding competitors to demo-company-1...');

  const demoCompany = await prisma.company.findUnique({
    where: { id: 'demo-company-1' }
  });

  if (!demoCompany) {
    console.error('❌ demo-company-1 not found');
    return;
  }

  // Competitor 1 for demo-company-1: Health-Ade
  const healthAdeCompany = await prisma.company.upsert({
    where: { id: 'competitor-healthade' },
    update: {},
    create: {
      id: 'competitor-healthade',
      name: 'Health-Ade',
      industry: 'Food & Beverage',
      description: 'Kombucha and functional beverages'
    }
  });

  await prisma.companyRelationship.upsert({
    where: {
      companyAId_companyBId: {
        companyAId: demoCompany.id,
        companyBId: healthAdeCompany.id
      }
    },
    update: {},
    create: {
      companyAId: demoCompany.id,
      companyBId: healthAdeCompany.id,
      relationshipType: 'competitor'
    }
  });

  const healthAdeLinkedIn = await prisma.companyPlatform.upsert({
    where: {
      companyId_platformId: {
        companyId: healthAdeCompany.id,
        platformId: linkedin.id
      }
    },
    update: {},
    create: {
      companyId: healthAdeCompany.id,
      platformId: linkedin.id,
      profileUrl: 'https://linkedin.com/company/health-ade'
    }
  });

  // Add Health-Ade snapshots
  let healthAdeFollowers = 28000;
  for (let daysAgo = 365; daysAgo >= 0; daysAgo--) {
    const capturedAt = new Date(today);
    capturedAt.setDate(capturedAt.getDate() - daysAgo);

    const dailyGrowth = 28 + Math.floor(Math.random() * 22);
    const followerCount = Math.floor(healthAdeFollowers + dailyGrowth + (Math.random() * 100 - 50));

    await prisma.platformSnapshot.create({
      data: {
        companyId: healthAdeCompany.id,
        platformId: healthAdeLinkedIn.id,
        capturedAt,
        followerCount,
        postCount: 140 + Math.floor(daysAgo / 5)
      }
    });

    healthAdeFollowers += dailyGrowth;
  }

  console.log('✅ Added Health-Ade as competitor to demo-company-1');

  // Competitor 2 for demo-company-1: GT's Kombucha
  const gtsCompany = await prisma.company.upsert({
    where: { id: 'competitor-gts' },
    update: {},
    create: {
      id: 'competitor-gts',
      name: 'GT\'s Kombucha',
      industry: 'Food & Beverage',
      description: 'Organic raw kombucha beverages'
    }
  });

  await prisma.companyRelationship.upsert({
    where: {
      companyAId_companyBId: {
        companyAId: demoCompany.id,
        companyBId: gtsCompany.id
      }
    },
    update: {},
    create: {
      companyAId: demoCompany.id,
      companyBId: gtsCompany.id,
      relationshipType: 'competitor'
    }
  });

  const gtsLinkedIn = await prisma.companyPlatform.upsert({
    where: {
      companyId_platformId: {
        companyId: gtsCompany.id,
        platformId: linkedin.id
      }
    },
    update: {},
    create: {
      companyId: gtsCompany.id,
      platformId: linkedin.id,
      profileUrl: 'https://linkedin.com/company/gts-living-foods'
    }
  });

  // Add GT's snapshots
  let gtsFollowers = 35000;
  for (let daysAgo = 365; daysAgo >= 0; daysAgo--) {
    const capturedAt = new Date(today);
    capturedAt.setDate(capturedAt.getDate() - daysAgo);

    const dailyGrowth = 32 + Math.floor(Math.random() * 25);
    const followerCount = Math.floor(gtsFollowers + dailyGrowth + (Math.random() * 110 - 55));

    await prisma.platformSnapshot.create({
      data: {
        companyId: gtsCompany.id,
        platformId: gtsLinkedIn.id,
        capturedAt,
        followerCount,
        postCount: 160 + Math.floor(daysAgo / 4)
      }
    });

    gtsFollowers += dailyGrowth;
  }

  console.log('✅ Added GT\'s Kombucha as competitor to demo-company-1');

  // ============================================
  // 6. ADD POSTS FOR THE NEW COMPETITORS
  // ============================================
  console.log('\n📝 Adding posts for new competitors...');

  // Health-Ade posts
  const healthAdePosts = [
    {
      caption: '🌟 NEW: Passion Fruit Orange Guava Kombucha! Tropical vibes in every sip. Available now at Whole Foods nationwide! #HealthAde #Kombucha',
      postedDaysAgo: 2,
      impressions: 24500,
      likes: 1890,
      comments: 143
    },
    {
      caption: 'Kombucha 101: How fermentation creates billions of probiotics 🔬 Our brewmaster breaks down the science behind gut health.',
      postedDaysAgo: 8,
      impressions: 18200,
      likes: 1340,
      comments: 98
    },
    {
      caption: 'Excited to announce our B Corp certification! 🌍 Committed to people, planet, and profit. #Sustainability',
      postedDaysAgo: 15,
      impressions: 21600,
      likes: 1720,
      comments: 127
    }
  ];

  for (const postData of healthAdePosts) {
    const postedAt = new Date(today);
    postedAt.setDate(postedAt.getDate() - postData.postedDaysAgo);

    const post = await prisma.post.create({
      data: {
        companyId: healthAdeCompany.id,
        platformId: linkedin.id,
        platformPostId: `healthade-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        captionText: postData.caption,
        postUrl: `https://linkedin.com/posts/healthade-${postData.postedDaysAgo}`,
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
        topics: ['Kombucha', 'Health', 'Sustainability'],
        summary: postData.caption.substring(0, 100),
        entities: ['Health-Ade'],
        captionSentiment: 0.82,
        avgCommentSentiment: 0.75,
        commentSentimentStd: 0.14,
        medianCommentSentiment: 0.77,
        positiveDescription: 'Positive community engagement',
        imageDescription: 'Product lifestyle imagery',
        negativeDescription: 'Low negative sentiment'
      }
    });
  }

  console.log('✅ Added Health-Ade posts');

  // GT's posts
  const gtsPosts = [
    {
      caption: 'From our family to yours 💚 GT\'s has been brewing kombucha for over 25 years. Thank you for making us America\'s #1 kombucha!',
      postedDaysAgo: 3,
      impressions: 31200,
      likes: 2450,
      comments: 189
    },
    {
      caption: 'Innovation update: Our new Synergy line features even more probiotics per bottle! 🚀 Available at retailers nationwide.',
      postedDaysAgo: 10,
      impressions: 27800,
      likes: 2110,
      comments: 156
    },
    {
      caption: 'Sustainability spotlight 🌱 We\'re now using 100% post-consumer recycled glass bottles. Better for you, better for the planet.',
      postedDaysAgo: 17,
      impressions: 23400,
      likes: 1870,
      comments: 134
    }
  ];

  for (const postData of gtsPosts) {
    const postedAt = new Date(today);
    postedAt.setDate(postedAt.getDate() - postData.postedDaysAgo);

    const post = await prisma.post.create({
      data: {
        companyId: gtsCompany.id,
        platformId: linkedin.id,
        platformPostId: `gts-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        captionText: postData.caption,
        postUrl: `https://linkedin.com/posts/gts-${postData.postedDaysAgo}`,
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
        topics: ['Kombucha', 'Sustainability', 'Innovation'],
        summary: postData.caption.substring(0, 100),
        entities: ['GT\'s'],
        captionSentiment: 0.88,
        avgCommentSentiment: 0.80,
        commentSentimentStd: 0.11,
        medianCommentSentiment: 0.82,
        positiveDescription: 'Strong brand loyalty and engagement',
        imageDescription: 'Authentic brand storytelling',
        negativeDescription: 'Minimal negative feedback'
      }
    });
  }

  console.log('✅ Added GT\'s posts');

  console.log('\n🎉 Extended seeding complete!');
  console.log('\n📊 Summary:');
  console.log('   - Added 3 platforms to Ethan\'s Poppi company');
  console.log('   - Added 365 days of snapshots for each platform');
  console.log('   - Added 10 posts with engagement for Ethan\'s company');
  console.log('   - Added 2 competitors to Ethan\'s company (Olipop, Culture Pop)');
  console.log('   - Added 2 competitors to demo-company-1 (Health-Ade, GT\'s)');
  console.log('   - Added posts with engagement for all competitors');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
