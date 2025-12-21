import { ChatMessage } from './client.js';

export interface PromptContext {
  platform: string;
  objective?: string;
  topicTags?: string[];
  competitorAngles?: string[];
  examples?: string[];
}

/**
 * Build system prompt for post generation (simplified)
 */
export function buildSystemPrompt(context: PromptContext): string {
  const { platform, objective } = context;

  let prompt = `You are an expert social media strategist for ${platform}. Your role is to generate high-performing posts that drive ${objective || 'engagement'}.

BRAND VOICE:
- Professional yet approachable
- Data-driven and strategic
- Clear and concise

PLATFORM BEST PRACTICES (${platform}):
`;

  if (platform === 'LinkedIn') {
    prompt += `- Keep it professional but engaging
- Use short paragraphs (2-3 sentences max)
- Include a strong hook in the first line
- Add value through insights or stories
- Use 3-5 relevant hashtags
- Call-to-action that encourages comments
- Optimal length: 150-300 words`;
  } else if (platform === 'Twitter') {
    prompt += `- Be concise and punchy
- Front-load key message
- Use threads for complex ideas
- Max 280 characters
- 1-2 hashtags maximum
- Strong CTAs perform well`;
  } else if (platform === 'Instagram') {
    prompt += `- Visual-first mindset
- Storytelling approach
- First line must hook viewers
- Use line breaks for readability
- 10-30 hashtags acceptable
- Call to action in caption`;
  } else {
    prompt += `- Follow ${platform} best practices
- Optimize for engagement
- Clear call-to-action`;
  }

  prompt += `\n\nYour goal: Generate post variants that are authentic, strategic, and optimized for ${objective || 'engagement'}.`;

  return prompt;
}

/**
 * Build user prompt for specific post generation
 */
export function buildUserPrompt(context: PromptContext): string {
  const { topicTags, competitorAngles, examples } = context;

  let prompt = 'Generate a social media post';

  if (topicTags && topicTags.length > 0) {
    prompt += ` about the following topics: ${topicTags.join(', ')}.`;
  } else {
    prompt += '.';
  }

  if (competitorAngles && competitorAngles.length > 0) {
    prompt += `\n\nCOMPETITOR INSIGHTS:
${competitorAngles.map(angle => `- ${angle}`).join('\n')}

Use these insights to differentiate your approach.`;
  }

  if (examples && examples.length > 0) {
    prompt += `\n\nEXAMPLES OF HIGH-PERFORMING POSTS:
${examples.map((ex, i) => `\nExample ${i + 1}:\n${ex}`).join('\n---\n')}

Match the style and quality of these examples.`;
  }

  prompt += `\n\nProvide ONLY the post content, no explanations or meta-commentary. Write as if you are the author posting directly.`;

  return prompt;
}

/**
 * Build complete message array for chat completion
 */
export function buildMessages(context: PromptContext): ChatMessage[] {
  return [
    {
      role: 'system',
      content: buildSystemPrompt(context),
    },
    {
      role: 'user',
      content: buildUserPrompt(context),
    },
  ];
}

// ============================================================
// BLUEPRINT GENERATION (Process-based guidance, not finished posts)
// ============================================================

export interface BlueprintPromptContext {
  platform: string;
  objective?: string;
  topicTags?: string[];
  competitorAngles?: string[];
  competitorExamples?: string[];
  userExamples?: string[];
  customPrompt?: string;
}

/**
 * Build system prompt for blueprint generation
 * This generates a GUIDE, not a finished post
 */
export function buildBlueprintSystemPrompt(context: BlueprintPromptContext): string {
  const { platform, objective } = context;

  return `You are a social media strategist creating a BLUEPRINT for ${platform}.

IMPORTANT: You are NOT writing a finished post. You are creating a GUIDE that tells the user:
- HOW to structure their post
- WHAT elements to include (semi-specifically, not generic)
- WHY certain approaches work (based on competitor success)
- What to AVOID (anti-patterns)

Your blueprint should be actionable and specific, so the user can write their own authentic post following your guidance.

OBJECTIVE: ${objective || 'engagement'}

PLATFORM CONTEXT (${platform}):
${getPlatformContext(platform)}

OUTPUT FORMAT:
You must respond with a valid JSON object matching this exact structure:
{
  "title": "Brief title for this blueprint (5-8 words)",
  "visualDescription": "Description of recommended visual approach (image, carousel, text-only)",
  "contentFramework": {
    "structure": "Hook → [next step] → [next step] → CTA (describe the flow)",
    "toneGuidance": ["guidance point 1", "guidance point 2", "guidance point 3"]
  },
  "whatToInclude": [
    {
      "label": "Hook",
      "guidance": "Semi-specific instruction on how to write the hook",
      "competitorInsight": "Why this works based on competitor data"
    },
    {
      "label": "Story/Context",
      "guidance": "What story element or context to include",
      "competitorInsight": "Why this works"
    },
    {
      "label": "Data/Proof",
      "guidance": "What data or proof point to include",
      "competitorInsight": "Why this works"
    },
    {
      "label": "Insight/Lesson",
      "guidance": "What insight or lesson to share",
      "competitorInsight": "Why this works"
    },
    {
      "label": "CTA",
      "guidance": "What call-to-action style to use",
      "competitorInsight": "Why this works"
    }
  ],
  "whatNotToDo": [
    {
      "antiPattern": "What to avoid",
      "reason": "Why it hurts engagement"
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
  "hook": "A brief 1-sentence GUIDANCE on the hook approach (not the actual hook)",
  "context": "Main body guidance summary (what story/value to convey)",
  "hashtags": [
    {"tag": "#Hashtag1", "engagement": "High engagement in your industry"},
    {"tag": "#Hashtag2", "engagement": "Trending in target audience"}
  ],
  "mentions": [],
  "bestTimeToPost": "Specific day and time recommendation",
  "recommendedFormat": "Text only / Image + Text / Carousel / Video",
  "postingInsight": "Key insight about posting strategy",
  "dataSources": ["Competitor Vault", "Industry Trends"],
  "timeWindow": "Last 30 Days",
  "confidence": 85,
  "yourPerformanceScore": 72,
  "competitorScore": 78,
  "estimatedReachMin": 5000,
  "estimatedReachMax": 12000,
  "estimatedEngagementMin": 2.5,
  "estimatedEngagementMax": 4.5,
  "optimizationNote": "Key optimization recommendation"
}

IMPORTANT GUIDELINES:
1. whatToInclude guidance should be SEMI-SPECIFIC (e.g., "Share your Q4 growth percentage" not just "Include a data point")
2. whatNotToDo should include REAL anti-patterns based on what fails for competitors
3. contentFramework.toneGuidance should be actionable (e.g., "Be confident but not boastful")
4. All insights should reference WHY things work based on competitor/industry data
5. The hook and context fields should be GUIDANCE, not actual post text`;
}

function getPlatformContext(platform: string): string {
  switch (platform) {
    case 'LinkedIn':
      return `- Professional audience expects value-driven content
- Hook must grab attention in first 2 lines (before "see more")
- Stories with vulnerability + lessons perform 2-3x better
- Questions in CTA drive 40% more comments
- Optimal: 150-250 words
- Best: Tuesday-Thursday, 8-10 AM`;
    case 'Twitter':
      return `- Punchy, direct communication
- First tweet in thread is crucial
- Contrarian takes get higher engagement
- Numbers and specifics outperform vague claims
- Optimal: Under 200 characters for single tweets
- Best: 9-11 AM, 12-1 PM`;
    case 'Instagram':
      return `- Visual storytelling is primary
- Caption should complement, not repeat image
- Personal stories drive saves and shares
- Line breaks essential for readability
- Optimal: 125-150 words for captions
- Best: 11 AM-1 PM, 7-9 PM`;
    default:
      return `- Focus on authentic, value-driven content
- Hook is crucial for scroll-stopping
- Include clear call-to-action
- Match platform's native style`;
  }
}

/**
 * Build user prompt for blueprint generation
 */
export function buildBlueprintUserPrompt(context: BlueprintPromptContext): string {
  const { topicTags, competitorAngles, competitorExamples, userExamples, customPrompt } = context;

  let prompt = 'Create a content blueprint';

  if (topicTags && topicTags.length > 0) {
    prompt += ` for content about: ${topicTags.join(', ')}.`;
  } else {
    prompt += '.';
  }

  if (customPrompt) {
    prompt += `\n\nUSER'S SPECIFIC REQUEST:\n${customPrompt}`;
  }

  if (competitorAngles && competitorAngles.length > 0) {
    prompt += `\n\nCOMPETITOR INSIGHTS (use these to inform your guidance):
${competitorAngles.map(angle => `- ${angle}`).join('\n')}`;
  }

  if (competitorExamples && competitorExamples.length > 0) {
    prompt += `\n\nHIGH-PERFORMING COMPETITOR POSTS (analyze what works):
${competitorExamples.map((ex, i) => `\nCompetitor Post ${i + 1}:\n${ex}`).join('\n---\n')}

Analyze patterns in these posts to inform your whatToInclude guidance.`;
  }

  if (userExamples && userExamples.length > 0) {
    prompt += `\n\nUSER'S PAST HIGH-PERFORMING POSTS:
${userExamples.map((ex, i) => `\nPast Post ${i + 1}:\n${ex}`).join('\n---\n')}

Use these to understand what already works for this user.`;
  }

  prompt += `\n\nGenerate a strategic blueprint that guides the user to create their own authentic post. Remember:
- Be SEMI-SPECIFIC in your guidance (not generic)
- Include WHY each element works (competitor insights)
- Include 3 anti-patterns to avoid
- Focus on PROCESS and METHODOLOGY, not finished text

Respond with valid JSON only.`;

  return prompt;
}

/**
 * Build complete message array for blueprint generation
 */
export function buildBlueprintMessages(context: BlueprintPromptContext): ChatMessage[] {
  return [
    {
      role: 'system',
      content: buildBlueprintSystemPrompt(context),
    },
    {
      role: 'user',
      content: buildBlueprintUserPrompt(context),
    },
  ];
}
