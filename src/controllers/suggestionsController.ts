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
        customObjective,
        prompt,
        attachedDocuments,
      } = req.body;

      if (!companyId || !platform) {
        res.status(400).json({
          success: false,
          error: 'companyId and platform are required',
        });
        return;
      }

      // Determine the effective objective
      const effectiveObjective = objective === 'other' && customObjective
        ? customObjective
        : (objective || 'engagement');

      // 1. Load platform rules
      const platformRules = loadPlatformRules(platform);

      // 2. Fetch company context (Data Chamber - always included)
      let companyContext = '';
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

      // 3. Fetch top-performing posts (top 5 by engagement rate from last 90 days)
      let topPostsContext = '';
      let topPostsCount = 0;
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const allRecentPosts = await prisma.post.findMany({
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
      });

      // Calculate engagement rate and sort by it, take top 5
      const topPosts = allRecentPosts
        .map(post => ({
          ...post,
          engagementRate: post.analysis?.impressions
            ? (post.analysis.engagement / post.analysis.impressions) * 100
            : 0,
        }))
        .sort((a, b) => b.engagementRate - a.engagementRate)
        .slice(0, 5);

      topPostsCount = topPosts.length;

      if (topPosts.length > 0) {
        topPostsContext = `
YOUR TOP-PERFORMING POSTS (last 90 days, by engagement rate):

${topPosts.map((post, i) => `
${i + 1}. Posted ${post.postedAt.toLocaleDateString()}:
   ${post.captionText?.substring(0, 200)}...
   Engagement Rate: ${post.engagementRate.toFixed(1)}% (${post.analysis?.engagement || 0} engagements / ${post.analysis?.impressions || 0} impressions)
   Topics: ${post.analysis?.topics?.join(', ') || 'N/A'}
`).join('\n')}

Learn from these patterns when creating new content.
`;
      }

      // 4. Fetch competitor insights (all competitors, top 2 posts by engagement rate per competitor)
      let competitorContext = '';
      let competitorCount = 0;
      let competitorNames: string[] = [];
      let competitorPostsCount = 0;

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
                take: 5, // Get 5 most recent, then sort by engagement rate
                include: { analysis: true },
              },
            },
          },
        },
      });

      // Process competitor posts: for each competitor, sort their 5 recent posts by engagement rate and take top 2
      const competitorsWithTopPosts = competitorRelations.map(rel => {
        const postsWithRate = rel.companyB.posts.map(p => ({
          ...p,
          engagementRate: p.analysis?.impressions
            ? (p.analysis.engagement / p.analysis.impressions) * 100
            : 0,
        }));
        const topPosts = postsWithRate
          .sort((a, b) => b.engagementRate - a.engagementRate)
          .slice(0, 2);
        return {
          name: rel.companyB.name,
          posts: topPosts,
        };
      });

      competitorCount = competitorRelations.length;
      competitorNames = competitorsWithTopPosts.map(c => c.name);
      competitorPostsCount = competitorsWithTopPosts.reduce((sum, c) => sum + c.posts.length, 0);

      // Log detailed competitor info
      console.log('📊 Competitor Intelligence Found:');
      competitorsWithTopPosts.forEach(comp => {
        console.log(`  - ${comp.name}: ${comp.posts.length} top posts (by engagement rate)`);
        comp.posts.forEach(p => {
          console.log(`      Post: ${p.captionText?.substring(0, 50)}... (${p.engagementRate.toFixed(1)}% engagement rate)`);
        });
      });

      if (competitorsWithTopPosts.length > 0) {
        competitorContext = `
COMPETITOR INTELLIGENCE:

${competitorsWithTopPosts.map((comp) => `
Competitor: ${comp.name}
${comp.posts.length > 0 ? `Top ${platform} posts (by engagement rate):
${comp.posts.map(p => {
  return `  - "${p.captionText?.substring(0, 150)}..." (${p.engagementRate.toFixed(1)}% engagement rate, ${p.analysis?.engagement || 0} total engagements)`;
}).join('\n')}` : 'No recent posts found for this competitor.'}
`).join('\n')}

Use this competitor intelligence to find gaps and opportunities. Reference specific competitors by name in dataSources.
`;
      }

      // 5. Fetch attached documents (if any)
      let documentsContext = '';
      let attachedDocsCount = 0;
      if (attachedDocuments && Array.isArray(attachedDocuments) && attachedDocuments.length > 0) {
        const fileIds = attachedDocuments.map((doc: { fileId: string }) => doc.fileId).filter(Boolean);

        if (fileIds.length > 0) {
          const files = await prisma.companyFile.findMany({
            where: {
              id: { in: fileIds },
              companyId, // Ensure files belong to this company
            },
          });

          const fileMap = new Map(files.map(f => [f.id, f]));

          const docsWithInfo = attachedDocuments
            .filter((doc: { fileId: string; description: string }) => fileMap.has(doc.fileId))
            .map((doc: { fileId: string; description: string }) => {
              const file = fileMap.get(doc.fileId)!;
              return {
                name: file.originalName,
                mimeType: file.mimeType,
                description: doc.description,
              };
            });

          attachedDocsCount = docsWithInfo.length;

          if (docsWithInfo.length > 0) {
            documentsContext = `
SUPPORTING DOCUMENTS PROVIDED BY USER:

${docsWithInfo.map((doc, i) => `
Document ${i + 1}: ${doc.name} (${doc.mimeType})
User's Purpose: "${doc.description}"
`).join('\n')}

Use these documents and the user's stated purpose for each when creating content.
`;
          }
        }
      }

      // 6. Build system prompt with platform rules
      const SYSTEM_PROMPT = `You are an expert ${platform} content strategist.

PLATFORM RULES FOR ${platform}:
${JSON.stringify(platformRules, null, 2)}

Your task: Create a comprehensive content blueprint optimized for ${effectiveObjective}.

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
- Follow the user's brief closely - they know what they want to post about

COMPETITOR ANALYSIS INSTRUCTIONS (VERY IMPORTANT):
- You MUST analyze the competitor posts provided in the COMPETITOR INTELLIGENCE section
- Study what topics, angles, and messaging styles competitors are using
- Identify gaps: What are competitors NOT talking about that would resonate with the target audience?
- Create content that differentiates from competitors while addressing similar market interests
- If competitors are in prediction markets (like Kalshi, Polymarket), consider how to position the company's unique value
- The generated content should be RELEVANT to the company's industry and competitors - NOT generic SaaS advice
- Do NOT generate generic content about "70% of startups" unless that's specifically relevant to the company's niche
`;

      // 7. Combine all context
      const fullContext = `${companyContext}
${topPostsContext}
${competitorContext}
${documentsContext}

USER REQUEST:
- Platform: ${platform}
- Objective: ${effectiveObjective}

USER'S POST BRIEF:
${prompt || 'Create engaging content for this platform.'}

Create content based on the user's brief above.
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
      console.log(`Objective: ${effectiveObjective}`);
      console.log(`User Brief: ${prompt?.substring(0, 100) || 'None'}${prompt && prompt.length > 100 ? '...' : ''}`);
      console.log(`Top Posts Found: ${topPostsCount}`);
      console.log(`Competitors Analyzed: ${competitorCount}`);
      console.log(`Competitor Names: ${competitorNames.length > 0 ? competitorNames.join(', ') : 'None'}`);
      console.log(`Total Competitor Posts: ${competitorPostsCount}`);
      console.log(`Attached Documents: ${attachedDocsCount}`);
      console.log('='.repeat(80) + '\n');

      // 8. Call OpenAI for blueprint
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
              objective: effectiveObjective,
              prompt: prompt || '',
            },
            examplesUsed: topPostsCount,
            competitorAngles: competitorCount,
            attachedDocsCount,
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
