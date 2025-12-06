import { Request, Response } from 'express';
import { prisma } from '../db.js';
import OpenAI from 'openai';
import { loadPlatformRules } from '../utils/platformRules.js';

const openai = new OpenAI({
  apiKey: process.env.LLM_API_KEY,
});

export const suggestionsController = {
  // POST /api/suggestions
  async generateSuggestions(req: Request, res: Response): Promise<void> {
    try {
      const {
        companyId,
        platform,
        objective,
        contentAngle,
        topicTags,
        useDataChamber,
        useYourTopPosts,
        useCompetitorPosts,
      } = req.body;

      if (!companyId || !platform) {
        res.status(400).json({
          success: false,
          error: 'companyId and platform are required',
        });
        return;
      }

      // 1. Load platform rules
      const platformRules = loadPlatformRules(platform);

      // 2. Fetch company context (if useDataChamber = true)
      let companyContext = '';
      if (useDataChamber !== false) {
        const company = await prisma.company.findUnique({
          where: { id: companyId },
          select: {
            name: true,
            industry: true,
            description: true,
            values: true,
            brandVoice: true,
            targetAudience: true,
            contentPriorities: true,
          },
        });

        if (company) {
          companyContext = `
COMPANY PROFILE:
- Company: ${company.name}
- Industry: ${company.industry || 'Not specified'}
- Description: ${company.description || 'Not specified'}
- Core Values: ${company.values || 'Not specified'}
- Brand Voice: ${company.brandVoice || 'Professional and authentic'}
- Target Audience: ${company.targetAudience || 'Industry professionals'}
- Content Priorities: ${company.contentPriorities || 'Balanced approach'}

IMPORTANT: Generate content that is SPECIFIC to this company's industry and business. Do NOT generate generic content.
Use this brand voice and values in all content you create.
`;
        }
      }

      // 3. Fetch top-performing posts (if useYourTopPosts = true)
      let topPostsContext = '';
      let topPostsCount = 0;
      if (useYourTopPosts !== false) {
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        const topPosts = await prisma.post.findMany({
          where: {
            companyId,
            platform: {
              name: platform,
            },
            postedAt: { gte: ninetyDaysAgo },
          },
          include: {
            analysis: true,
          },
          orderBy: {
            analysis: {
              engagement: 'desc',
            },
          },
          take: 10,
        });

        topPostsCount = topPosts.length;

        if (topPosts.length > 0) {
          topPostsContext = `
YOUR TOP-PERFORMING POSTS (last 90 days):

${topPosts.map((post, i) => `
${i + 1}. Posted ${post.postedAt.toLocaleDateString()}:
   ${post.captionText?.substring(0, 200)}...
   Engagement: ${post.analysis?.engagement || 0} total interactions
   Topics: ${post.analysis?.topics?.join(', ') || 'N/A'}
`).join('\n')}

Learn from these patterns when creating new content.
`;
        }
      }

      // 4. Fetch competitor insights (if useCompetitorPosts = true)
      let competitorContext = '';
      let competitorCount = 0;
      let competitorNames: string[] = [];
      let competitorPostsCount = 0;
      if (useCompetitorPosts !== false) {
        const competitorRelations = await prisma.companyRelationship.findMany({
          where: {
            companyAId: companyId,
            relationshipType: 'competitor',
          },
          include: {
            companyB: {
              include: {
                posts: {
                  where: {
                    platform: {
                      name: platform,
                    },
                  },
                  orderBy: { postedAt: 'desc' },
                  take: 5,
                  include: { analysis: true },
                },
              },
            },
          },
        });

        const competitorBlueprints = await prisma.blueprint.findMany({
          where: {
            companyId: { not: companyId },
            platform,
          },
          orderBy: { vanturaScore: 'desc' },
          take: 5,
        });

        competitorCount = competitorRelations.length;
        competitorNames = competitorRelations.map(rel => rel.companyB.name);
        competitorPostsCount = competitorRelations.reduce((sum, rel) => sum + rel.companyB.posts.length, 0);

        // Log detailed competitor info
        console.log('📊 Competitor Intelligence Found:');
        competitorRelations.forEach(rel => {
          console.log(`  - ${rel.companyB.name}: ${rel.companyB.posts.length} posts`);
          rel.companyB.posts.forEach(p => {
            console.log(`      Post: ${p.captionText?.substring(0, 50)}... (${p.analysis?.engagement || 0} engagement)`);
          });
        });

        if (competitorRelations.length > 0 || competitorBlueprints.length > 0) {
          competitorContext = `
COMPETITOR INTELLIGENCE:

${competitorRelations.map((rel) => `
Competitor: ${rel.companyB.name}
${rel.companyB.posts.length > 0 ? `Recent ${platform} posts:
${rel.companyB.posts.map(p => {
  const engRate = p.analysis?.impressions ? ((p.analysis.engagement / p.analysis.impressions) * 100).toFixed(1) + '%' : 'N/A';
  return `  - "${p.captionText?.substring(0, 150)}..." (${p.analysis?.engagement || 0} total engagement, ${engRate} rate)`;
}).join('\n')}` : 'No recent posts found for this competitor.'}
`).join('\n')}

${competitorBlueprints.length > 0 ? `
High-Performing Competitor Blueprints:
${competitorBlueprints.map((bp, i) => `
${i + 1}. ${bp.title} (Score: ${bp.vanturaScore}/100)
   Hook: ${bp.hook.substring(0, 80)}...
   Topics: ${bp.topicTags.join(', ')}
`).join('\n')}
` : ''}

Use this competitor intelligence to find gaps and opportunities. Reference specific competitors by name in dataSources.
`;
        }
      }

      // 5. Build system prompt with platform rules
      const SYSTEM_PROMPT = `You are an expert ${platform} content strategist.

PLATFORM RULES FOR ${platform}:
${JSON.stringify(platformRules, null, 2)}

Your task: Create a comprehensive content blueprint optimized for ${objective || 'engagement'} with a ${contentAngle || 'balanced'} angle.

Return ONLY valid JSON (no markdown) with this structure:
{
  "title": "string - descriptive title like 'Engaging LinkedIn Thought Leadership Post'",
  "actionType": "post | comment | repost | story | video - the type of content action",
  "reasoning": "string - 2-3 sentences explaining WHY this blueprint will work based on platform rules, company context, and competitor analysis",
  "visualDescription": "string - describe the visual format with slide breakdown if carousel",
  "references": [
    {
      "name": "string - industry leader name who inspired this style",
      "handle": "string - their LinkedIn/social handle if known",
      "reason": "string - why this reference is relevant (e.g., 'Hook pattern', 'Storytelling style')"
    }
  ],
  "hook": "string - the opening attention-grabbing line",
  "context": "string - the main body content with @mentions where relevant",
  "hashtags": [{"tag": "string WITHOUT # prefix (e.g., 'B2BSaaS' not '#B2BSaaS')", "engagement": "string like '4.2% Eng.'"}],
  "mentions": [{"handle": "string WITHOUT @ prefix (e.g., 'johndoe' not '@johndoe')", "engagement": "string like '5.1% Eng.'"}],
  "bestTimeToPost": "string like 'Tuesdays, 10 AM PST'",
  "recommendedFormat": "string like 'Carousel Post (Image + Text)'",
  "postingInsight": "string - why this format drives engagement",
  "vanturaScore": "number 0-100 representing overall post quality score",
  "estimatedReachMin": "number - minimum estimated impressions (e.g., 500)",
  "estimatedReachMax": "number - maximum estimated impressions (e.g., 2000)",
  "estimatedEngagementMin": "number - minimum engagement rate as percentage (REALISTIC: 1-5%, e.g., 2)",
  "estimatedEngagementMax": "number - maximum engagement rate as percentage (REALISTIC: 3-10%, e.g., 6)",
  "dataSources": ["array of SPECIFIC sources used - include competitor names if competitor data was provided"],
  "timeWindow": "string like 'Last 30 Days'",
  "confidence": "number 0-100 representing confidence in predictions",
  "yourPerformanceScore": "number 0-100 based on your historical post performance",
  "competitorScore": "number 0-100 based on competitor performance data",
  "optimizationNote": "string like 'This blueprint is optimized for high visibility and audience interaction.'"
}

CRITICAL VALUE CONSTRAINTS:
- estimatedEngagementMin/Max: MUST be realistic (1-10% range). LinkedIn average is 2-4%.
- confidence: Return as 0-100, NOT as a decimal (e.g., 85 not 0.85)
- hashtags.tag: Do NOT include the # symbol
- mentions.handle: Do NOT include the @ symbol
- dataSources: Be SPECIFIC - list actual competitor names, "Your Top Posts", "Brand Voice Profile" etc.

IMPORTANT:
- Include exactly 3 references (industry leaders whose style inspired the content)
- actionType should match the content format (usually "post" for LinkedIn)

CRITICAL REQUIREMENTS:
- Variants should have LOW randomness - keep them very similar
- Hook must follow platform rules exactly
- Use company's brand voice strictly
- Learn from their top posts
${contentAngle === 'data-driven' ? '- Focus on stats, research, numbers' : ''}
${contentAngle === 'storytelling' ? '- Focus on personal narratives and stories' : ''}
${contentAngle === 'educational' ? '- Focus on how-to and actionable tutorials' : ''}
${contentAngle === 'thought-leadership' ? '- Focus on insights and opinions' : ''}
${contentAngle === 'behind-the-scenes' ? '- Focus on process and transparency' : ''}

COMPETITOR ANALYSIS INSTRUCTIONS (VERY IMPORTANT):
- You MUST analyze the competitor posts provided in the COMPETITOR INTELLIGENCE section
- Study what topics, angles, and messaging styles competitors are using
- Identify gaps: What are competitors NOT talking about that would resonate with the target audience?
- Create content that differentiates from competitors while addressing similar market interests
- If competitors are in prediction markets (like Kalshi, Polymarket), consider how to position the company's unique value
- The generated content should be RELEVANT to the company's industry and competitors - NOT generic SaaS advice
- Do NOT generate generic content about "70% of startups" unless that's specifically relevant to the company's niche
`;

      // 6. Combine all context
      const fullContext = `${companyContext}
${topPostsContext}
${competitorContext}

USER REQUEST:
- Platform: ${platform}
- Objective: ${objective || 'engagement'}
- Content Angle: ${contentAngle || 'balanced'}
- Topics: ${topicTags?.join(', ') || 'general'}

Create content for these topics with the specified angle and objective.
`;

      // 📋 LOG THE COMPLETE PROMPT TO CONSOLE
      console.log('\n' + '='.repeat(80));
      console.log('📋 BLUEPRINT GENERATION PROMPT');
      console.log('='.repeat(80));
      console.log('\n🎯 SYSTEM PROMPT:');
      console.log('-'.repeat(80));
      console.log(SYSTEM_PROMPT);
      console.log('\n💬 USER PROMPT:');
      console.log('-'.repeat(80));
      console.log(fullContext);
      console.log('\n📊 METADATA:');
      console.log('-'.repeat(80));
      console.log(`Company ID: ${companyId}`);
      console.log(`Platform: ${platform}`);
      console.log(`Objective: ${objective || 'engagement'}`);
      console.log(`Content Angle: ${contentAngle || 'balanced'}`);
      console.log(`Topics: ${topicTags?.join(', ') || 'general'}`);
      console.log(`Data Chamber: ${useDataChamber !== false ? 'ON' : 'OFF'}`);
      console.log(`Top Posts: ${useYourTopPosts !== false ? 'ON' : 'OFF'}`);
      console.log(`Competitor Posts: ${useCompetitorPosts !== false ? 'ON' : 'OFF'}`);
      console.log(`Top Posts Found: ${topPostsCount}`);
      console.log(`Competitors Analyzed: ${competitorCount}`);
      console.log(`Competitor Names: ${competitorNames.length > 0 ? competitorNames.join(', ') : 'None'}`);
      console.log(`Total Competitor Posts: ${competitorPostsCount}`);
      console.log('='.repeat(80) + '\n');

      // 7. Call OpenAI for blueprint
      const completion = await openai.chat.completions.create({
        model: process.env.LLM_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: fullContext },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7, // Moderate temperature for variety while maintaining quality
        max_tokens: 2500,
      });

      const blueprint = JSON.parse(completion.choices[0].message.content || '{}');

      // 8. Generate 3 similar variants (ask LLM for minor variations)
      const variantsCompletion = await openai.chat.completions.create({
        model: process.env.LLM_MODEL || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You create post variations with noticeable differences while keeping the core message. Return JSON with variants array containing objects with "text" and "reasoning" fields.',
          },
          {
            role: 'user',
            content: `Create 3 DIFFERENT variations of this post. Change wording, vary the hook style, adjust emphasis, but keep the core data and message:

Hook: ${blueprint.hook}
Context: ${blueprint.context}

For each variant, provide:
1. The full post text
2. A brief reasoning (1-2 sentences) explaining WHY this specific variant will work based on its hook style, tone, and platform best practices.

Return: {
  "variants": [
    {"text": "variant 1 text", "reasoning": "This variant works because..."},
    {"text": "variant 2 text", "reasoning": "This variant works because..."},
    {"text": "variant 3 text", "reasoning": "This variant works because..."}
  ]
}`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 1500,
      });

      const variantsData = JSON.parse(variantsCompletion.choices[0].message.content || '{"variants":[]}');
      const variants = (variantsData.variants || []).map((variant: { text: string; reasoning: string }) => {
        // Add slight variation to scores (±3 points from base)
        const baseScore = blueprint.vanturaScore || 85;
        const variation = (Math.random() - 0.5) * 6; // Random between -3 and +3
        const finalScore = Math.max(0, Math.min(100, baseScore + variation));

        // Analytics and critic scores with their own slight variations
        const analyticsScore = Math.max(0, Math.min(100, finalScore * (0.88 + Math.random() * 0.04))); // 88-92% of final
        const criticScore = Math.max(0, Math.min(100, finalScore * (0.83 + Math.random() * 0.04))); // 83-87% of final

        return {
          text: variant.text,
          reasoning: variant.reasoning,
          analyticsScore: Math.round(analyticsScore * 100) / 100,
          criticScore: Math.round(criticScore * 100) / 100,
          finalScore: Math.round(finalScore * 100) / 100,
        };
      });

      // Return response
      res.json({
        success: true,
        data: {
          variants,
          blueprint,
          meta: {
            brief: {
              platform,
              objective: objective || 'engagement',
              topicTags: topicTags || [],
              contentAngle: contentAngle || 'balanced',
            },
            examplesUsed: topPostsCount,
            competitorAngles: competitorCount,
          },
        },
      });
    } catch (error) {
      console.error('Generate suggestions error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate suggestions',
      });
    }
  },
};
