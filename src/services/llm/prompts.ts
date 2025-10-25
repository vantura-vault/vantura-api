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
