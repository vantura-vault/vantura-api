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

      // 6. Build system prompt with platform rules - PROCESS-BASED BLUEPRINT
      const SYSTEM_PROMPT = `You are an expert ${platform} content strategist creating a BLUEPRINT.

IMPORTANT: You are NOT writing a finished post. You are creating a GUIDE that tells the user:
- HOW to structure their post
- WHAT elements to include (semi-specifically, not generic)
- WHY certain approaches work (based on competitor success)
- What to AVOID (anti-patterns)

PLATFORM RULES FOR ${platform}:
${JSON.stringify(platformRules, null, 2)}

Your task: Create a strategic content blueprint that GUIDES the user to create their own post optimized for ${effectiveObjective}.

Return ONLY valid JSON (no markdown) with this structure:
{
  "title": "string - descriptive title like 'Growth Story Blueprint for LinkedIn'",
  "actionType": "post | comment | repost | story | video - the type of content action",
  "reasoning": "string - 2-3 sentences explaining WHY this blueprint approach works based on competitor analysis",

  "contentFramework": {
    "structure": "string - describe the flow like 'Hook → Story → Data → Insight → CTA'",
    "toneGuidance": ["array of 3 tone guidelines like 'Confident but not boastful'"]
  },

  "whatToInclude": [
    {
      "label": "Hook",
      "guidance": "Semi-specific instruction on how to write the hook (e.g., 'Start with your most surprising metric from Q4')",
      "competitorInsight": "Why this works based on competitor data (e.g., 'Competitors see 2.3x engagement with number hooks')"
    },
    {
      "label": "Story/Context",
      "guidance": "What story element to include (e.g., 'Share the specific challenge you faced before finding the solution')",
      "competitorInsight": "Why this works"
    },
    {
      "label": "Data/Proof",
      "guidance": "What data to include (e.g., 'Include your growth percentage or time saved')",
      "competitorInsight": "Why this works"
    },
    {
      "label": "Insight/Lesson",
      "guidance": "What lesson to share (e.g., 'Share the non-obvious takeaway others missed')",
      "competitorInsight": "Why this works"
    },
    {
      "label": "CTA",
      "guidance": "What CTA style to use (e.g., 'End with an open question that invites discussion')",
      "competitorInsight": "Why this works"
    }
  ],

  "whatNotToDo": [
    {
      "antiPattern": "What to avoid (e.g., 'Starting with generic motivational statements')",
      "reason": "Why it hurts engagement (e.g., 'Gets scrolled past 3x faster than specific hooks')"
    },
    {
      "antiPattern": "Second thing to avoid",
      "reason": "Why it hurts engagement"
    },
    {
      "antiPattern": "Third thing to avoid",
      "reason": "Why it hurts engagement"
    }
  ],

  "visualDescription": "string - describe the visual format recommendation",
  "references": [
    {
      "name": "Industry leader name whose process inspired this blueprint",
      "handle": "Their social handle if known",
      "reason": "Why this reference is relevant (e.g., 'Hook pattern', 'Storytelling approach')"
    }
  ],
  "hook": "string - GUIDANCE on hook approach (e.g., 'Lead with your most surprising outcome')",
  "context": "string - GUIDANCE on main body (e.g., 'Share the journey from problem to solution')",
  "hashtags": [{"tag": "string WITHOUT # prefix", "engagement": "string like '4.2% Eng.'"}],
  "mentions": [{"handle": "string WITHOUT @ prefix", "engagement": "string like '5.1% Eng.'"}],
  "bestTimeToPost": "string like 'Tuesdays, 10 AM PST'",
  "recommendedFormat": "string like 'Text only' or 'Image + Text' or 'Carousel'",
  "postingInsight": "string - key insight about posting strategy",
  "estimatedReachMin": "number - minimum estimated impressions",
  "estimatedReachMax": "number - maximum estimated impressions",
  "estimatedEngagementMin": "number - minimum engagement rate % (REALISTIC: 1-5%)",
  "estimatedEngagementMax": "number - maximum engagement rate % (REALISTIC: 3-10%)",
  "dataSources": ["array of SPECIFIC sources - include competitor names if provided"],
  "timeWindow": "string like 'Last 30 Days'",
  "confidence": "number 0-100 representing confidence in predictions",
  "yourPerformanceScore": "number 0-100 based on historical performance",
  "competitorScore": "number 0-100 based on competitor data",
  "optimizationNote": "string - key optimization recommendation"
}

CRITICAL BLUEPRINT GUIDELINES:
1. whatToInclude guidance should be SEMI-SPECIFIC, not generic
   - BAD: "Include a data point"
   - GOOD: "Include your Q4 growth percentage or the time saved by using your solution"
2. whatNotToDo should include REAL anti-patterns based on what fails for competitors
3. contentFramework.toneGuidance should be actionable (e.g., "Be confident but not boastful")
4. All competitorInsight fields should reference WHY things work based on data
5. hook and context fields should be GUIDANCE, not actual post text

COMPETITOR ANALYSIS INSTRUCTIONS:
- Study competitor posts to understand what WORKS and what DOESN'T
- Use this to inform your whatToInclude competitorInsights
- Identify anti-patterns from what competitors avoid or what gets low engagement
- Reference specific competitors in dataSources when their data informed your guidance
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

      // 8. Call OpenAI for single process-based blueprint
      const completion = await openai.chat.completions.create({
        model: process.env.LLM_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: fullContext },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 3000, // Increased for larger blueprint with guidance sections
      });

      const blueprint = JSON.parse(completion.choices[0].message.content || '{}');

      // Add metadata to blueprint
      blueprint.companyId = companyId;
      blueprint.platform = platform;
      blueprint.objective = effectiveObjective;
      blueprint.topicTags = prompt ? [prompt.substring(0, 50)] : [];

      // 📋 LOG THE GENERATED BLUEPRINT
      console.log('\n' + '='.repeat(80));
      console.log('📋 GENERATED BLUEPRINT');
      console.log('='.repeat(80));
      console.log(JSON.stringify(blueprint, null, 2));
      console.log('='.repeat(80) + '\n');

      // Return response - single blueprint, no variants
      res.json({
        success: true,
        data: {
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
