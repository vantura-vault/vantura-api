import { chatCompletion } from './client.js';

/**
 * Use LLM as a critic to evaluate post quality
 */
export async function criticEvaluate(
  postText: string,
  platform: string,
  objective: string
): Promise<number> {
  const systemPrompt = `You are an expert social media analyst. Your role is to evaluate posts objectively and provide a quality score.

Evaluate posts based on:
1. Alignment with platform best practices (${platform})
2. Engagement potential
3. Clarity and conciseness
4. Call-to-action effectiveness
5. Relevance to objective: ${objective}

Provide a single score from 0.0 to 1.0, where:
- 0.9-1.0: Exceptional, viral potential
- 0.7-0.8: Strong, above average
- 0.5-0.6: Average, decent performance
- 0.3-0.4: Below average, needs improvement
- 0.0-0.2: Poor, major issues

Respond with ONLY a number between 0.0 and 1.0, nothing else.`;

  const userPrompt = `Evaluate this ${platform} post for ${objective}:

---
${postText}
---

Score (0.0-1.0):`;

  try {
    const response = await chatCompletion({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3, // Lower temperature for consistent scoring
      maxTokens: 10,
    });

    // Extract numeric score from response
    const scoreMatch = response.content.match(/\d+\.\d+|\d+/);
    if (scoreMatch) {
      const score = parseFloat(scoreMatch[0]);
      return Math.min(1.0, Math.max(0.0, score));
    }

    // Fallback if parsing fails
    console.warn('Failed to parse critic score, using default 0.5');
    return 0.5;
  } catch (error) {
    console.error('Critic evaluation error:', error);
    // Return neutral score on error
    return 0.5;
  }
}

/**
 * Batch evaluate multiple posts
 */
export async function batchCriticEvaluate(
  posts: string[],
  platform: string,
  objective: string
): Promise<number[]> {
  const scores = await Promise.all(
    posts.map(post => criticEvaluate(post, platform, objective))
  );
  return scores;
}
