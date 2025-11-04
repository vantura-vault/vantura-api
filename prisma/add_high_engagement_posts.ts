import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addHighEngagementPosts() {
  console.log('📝 Adding high-engagement posts...');

  const companyId = 'demo-company-1';
  
  // Get LinkedIn platform
  const linkedin = await prisma.platform.findUnique({
    where: { name: 'LinkedIn' }
  });

  if (!linkedin) {
    console.error('LinkedIn platform not found');
    return;
  }

  const today = new Date();
  
  // Create 15 new posts with progressively higher engagement
  const newPosts = [
    {
      caption: '🔥 MAJOR ANNOUNCEMENT: We just closed our Series A! $10M to revolutionize how companies track competitive intelligence. This is just the beginning. #Startup #Funding #GrowthJourney',
      daysAgo: 1,
      impressions: 45000,
      likes: 3200,
      comments: 287
    },
    {
      caption: '💡 Data insight: Companies using competitive intelligence grow 3.2x faster than those who don\'t. We analyzed 10,000+ businesses to prove it. Full report in comments. #DataDriven #BusinessGrowth',
      daysAgo: 3,
      impressions: 38500,
      likes: 2890,
      comments: 234
    },
    {
      caption: '🚀 Product Launch Alert! Introducing real-time competitor tracking across all social platforms. No more manual spreadsheets. See what your competitors are doing, as it happens. Early access link in bio.',
      daysAgo: 4,
      impressions: 52000,
      likes: 4100,
      comments: 412
    },
    {
      caption: '🎯 Strategy tip: Your competitors\' failures are your biggest learning opportunity. Here\'s how we help you spot patterns before they become trends. Thread 🧵',
      daysAgo: 6,
      impressions: 29000,
      likes: 2100,
      comments: 178
    },
    {
      caption: '📊 Case Study: How @TechCorp increased market share by 40% using competitive intelligence. The strategy is simpler than you think. Download the full case study: [link]',
      daysAgo: 7,
      impressions: 41000,
      likes: 3100,
      comments: 298
    },
    {
      caption: '⚡ LIVE NOW: Our CEO is hosting a masterclass on "Winning in Competitive Markets" - Join 5,000+ founders learning how to outmaneuver the competition. Link in comments!',
      daysAgo: 9,
      impressions: 67000,
      likes: 5200,
      comments: 567
    },
    {
      caption: '🏆 Customer win! "Vantura helped us identify a gap in our competitor\'s strategy and capture 25% market share in 3 months" - Sarah Chen, CMO @GrowthStartup. Read the full story →',
      daysAgo: 11,
      impressions: 33000,
      likes: 2400,
      comments: 189
    },
    {
      caption: '🔍 Behind the scenes: Our AI analyzes 500M+ social media posts daily to give you competitive insights. Here\'s how the magic happens. [Carousel post]',
      daysAgo: 13,
      impressions: 28000,
      likes: 1950,
      comments: 156
    },
    {
      caption: '💪 Monday motivation: "In business, you either disrupt or get disrupted." - Our team lives by this. What\'s your competitive advantage? Drop it in the comments!',
      daysAgo: 14,
      impressions: 24000,
      likes: 1780,
      comments: 203
    },
    {
      caption: '🎉 Milestone alert: We just hit 50,000 users! Thank you to this incredible community. To celebrate, we\'re giving away 100 premium accounts. Comment "INTEL" to enter!',
      daysAgo: 16,
      impressions: 89000,
      likes: 7800,
      comments: 1243
    },
    {
      caption: '📈 Industry report: 2025 Competitive Intelligence Trends. AI-powered analysis, real-time tracking, and predictive analytics are reshaping how businesses compete. Download free report →',
      daysAgo: 18,
      impressions: 36000,
      likes: 2600,
      comments: 214
    },
    {
      caption: '🎤 Speaking engagement: Our founder will keynote at TechCrunch Disrupt next week. Topic: "The Future of Competitive Strategy in the AI Era". Who\'s attending?',
      daysAgo: 20,
      impressions: 31000,
      likes: 2200,
      comments: 167
    },
    {
      caption: '⭐ Feature highlight: New sentiment analysis tool detects shifts in competitor messaging before they trend. See what your competitors are planning next. Try it free for 14 days.',
      daysAgo: 22,
      impressions: 27000,
      likes: 1890,
      comments: 145
    },
    {
      caption: '🌟 Team spotlight: Meet Alex, our Head of AI. From Google to Vantura, here\'s why he believes competitive intelligence is the next frontier. [Video interview]',
      daysAgo: 25,
      impressions: 19000,
      likes: 1340,
      comments: 98
    },
    {
      caption: '🚨 Market alert: Major shift happening in the SaaS competitive landscape. 3 trends you need to watch right now. Analysis thread below 👇',
      daysAgo: 27,
      impressions: 42000,
      likes: 3300,
      comments: 276
    }
  ];

  for (const postData of newPosts) {
    const postedAt = new Date(today);
    postedAt.setDate(postedAt.getDate() - postData.daysAgo);

    const post = await prisma.post.create({
      data: {
        companyId,
        platformId: linkedin.id,
        platformPostId: `linkedin-high-engagement-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        captionText: postData.caption,
        postUrl: `https://linkedin.com/posts/vantura-high-${postData.daysAgo}`,
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

    // Add post analysis with high engagement metrics
    await prisma.postAnalysis.create({
      data: {
        postId: post.id,
        modelVersion: 'gpt-4o-mini',
        impressions: postData.impressions,
        engagement: postData.likes + postData.comments,
        topics: postData.caption.includes('AI') ? ['AI', 'Technology'] :
                postData.caption.includes('funding') || postData.caption.includes('Series') ? ['Funding', 'Growth'] :
                postData.caption.includes('Product') ? ['Product', 'Launch'] :
                postData.caption.includes('Case Study') ? ['Success Story', 'Results'] :
                ['Business', 'Strategy'],
        summary: postData.caption.substring(0, 100) + '...',
        entities: ['Vantura', 'Competitive Intelligence'],
        captionSentiment: 0.85,
        avgCommentSentiment: 0.78,
        commentSentimentStd: 0.12,
        medianCommentSentiment: 0.80,
        positiveDescription: 'Highly engaging content with strong community response',
        imageDescription: 'Professional branded content',
        negativeDescription: 'Minimal negative feedback'
      }
    });

    console.log(`✅ Added high-engagement post: ${postData.caption.substring(0, 50)}...`);
  }

  console.log('\n🎉 Successfully added 15 high-engagement posts!');
}

addHighEngagementPosts()
  .catch((e) => {
    console.error('❌ Error adding posts:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
