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
- Core Values: ${company.values || 'Not specified'}
- Brand Voice: ${company.brandVoice || 'Professional and authentic'}
- Target Audience: ${company.targetAudience || 'Industry professionals'}
- Content Priorities: ${company.contentPriorities || 'Balanced approach'}

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
                  take: 3,
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

        if (competitorRelations.length > 0 || competitorBlueprints.length > 0) {
          competitorContext = `
COMPETITOR INTELLIGENCE:

${competitorRelations.map((rel) => `
Competitor: ${rel.companyB.name}
Recent posts:
${rel.companyB.posts.map(p => `  - ${p.captionText?.substring(0, 100)}... (${p.analysis?.engagement || 0} engagement)`).join('\n')}
`).join('\n')}

${competitorBlueprints.length > 0 ? `
High-Performing Competitor Blueprints:
${competitorBlueprints.map((bp, i) => `
${i + 1}. ${bp.title} (Score: ${bp.vanturaScore}/100)
   Hook: ${bp.hook.substring(0, 80)}...
   Topics: ${bp.topicTags.join(', ')}
`).join('\n')}
` : ''}

Find gaps and opportunities they're missing.
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
  "title": "string",
  "reasoning": "string - 2-3 sentences explaining WHY this blueprint will work based on platform rules, company context, and competitor analysis",
  "visualDescription": "string",
  "hook": "string",
  "context": "string",
  "hashtags": [{"tag": "string", "engagement": "string"}],
  "mentions": [{"handle": "string", "engagement": "string"}],
  "bestTimeToPost": "string",
  "recommendedFormat": "string",
  "postingInsight": "string",
  "vanturaScore": number,
  "estimatedReachMin": number,
  "estimatedReachMax": number,
  "estimatedEngagementMin": number,
  "estimatedEngagementMax": number,
  "dataSources": ["array of sources you used"],
  "timeWindow": "string",
  "confidence": number,
  "yourPerformanceScore": number,
  "competitorScore": number,
  "optimizationNote": "string"
}

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
            content: 'You create post variations with noticeable differences while keeping the core message. Return JSON array of 3 texts.',
          },
          {
            role: 'user',
            content: `Create 3 DIFFERENT variations of this post. Change wording, vary the hook style, adjust emphasis, but keep the core data and message:

Hook: ${blueprint.hook}
Context: ${blueprint.context}

Return: {"variants": ["text1", "text2", "text3"]}`,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 1000,
      });

      const variantsData = JSON.parse(variantsCompletion.choices[0].message.content || '{"variants":[]}');
      const variants = (variantsData.variants || []).map((text: string) => ({
        text,
        analyticsScore: (blueprint.vanturaScore || 85) * 0.9,
        criticScore: (blueprint.vanturaScore || 85) * 0.85,
        finalScore: blueprint.vanturaScore || 85,
      }));

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
