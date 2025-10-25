// import { prisma } from '../db.js';
// import { chatCompletionWithRetry } from './llm/client.js';
// import { buildMessages, PromptContext } from './llm/prompts.js';
// import { scorePost } from './llm/featureExtract.js';
// import { batchCriticEvaluate } from './llm/critic.js';

// export interface SuggestPostsInput {
//   companyId: string;
//   platform: string;
//   objective?: string;
//   topicTags?: string[];
//   nVariants?: number;
// }

// export interface PostVariant {
//   text: string;
//   analyticsScore: number;
//   criticScore: number;
//   finalScore: number;
// }

// export interface SuggestPostsOutput {
//   variants: PostVariant[];
//   meta: {
//     brief: PromptContext;
//     examplesUsed: string[];
//     competitorAngles: string[];
//   };
// }

// /**
//  * Main post suggestion orchestration service
//  */
// export async function suggestPosts(input: SuggestPostsInput): Promise<SuggestPostsOutput> {
//   const {
//     companyId,
//     platform,
//     objective = 'engagement',
//     topicTags = [],
//     nVariants = 3,
//   } = input;

//   // 1. Fetch high-performing post examples
//   const examplePosts = await prisma.post.findMany({
//     where: { companyId, platform },
//     include: { analytics: true },
//     orderBy: { postedAt: 'desc' },
//     take: 5,
//   });

//   const examples = examplePosts
//     .filter(p => p.analytics && p.analytics.engagementRate > 5) // Filter high performers
//     .map(p => p.content)
//     .slice(0, 3);

//   // 2. Fetch competitor insights (optional)
//   const competitors = await prisma.companyRelation.findMany({
//     where: { companyId, type: 'COMPETITOR' },
//     include: { competitorCompany: true },
//     take: 3,
//   });

//   const competitorAngles = competitors
//     .filter(c => c.competitorCompany)
//     .map(c => `${c.competitorCompany!.name} focuses on ${c.competitorCompany!.industry || 'their market'}`);

//   // 3. Build prompt context (simplified - no brand rules or personas)
//   const promptContext: PromptContext = {
//     platform,
//     objective,
//     topicTags,
//     competitorAngles: competitorAngles.length > 0 ? competitorAngles : undefined,
//     examples: examples.length > 0 ? examples : undefined,
//   };

//   // 4. Generate N variants using LLM
//   const messages = buildMessages(promptContext);
//   const variants: string[] = [];

//   for (let i = 0; i < nVariants; i++) {
//     try {
//       const response = await chatCompletionWithRetry({
//         messages,
//         temperature: 0.8 + (i * 0.05), // Slight temperature variation for diversity
//         maxTokens: 500,
//       });
//       variants.push(response.content.trim());
//     } catch (error) {
//       console.error(`Failed to generate variant ${i + 1}:`, error);
//       // Continue with fewer variants if some fail
//     }
//   }

//   if (variants.length === 0) {
//     throw new Error('Failed to generate any post variants');
//   }

//   // 5. Score each variant
//   const analyticsScores = variants.map(text => scorePost(text, platform));
//   const criticScores = await batchCriticEvaluate(variants, platform, objective);

//   // 6. Compute final scores and rank
//   const scoredVariants: PostVariant[] = variants.map((text, i) => {
//     const analyticsScore = analyticsScores[i];
//     const criticScore = criticScores[i];
//     const finalScore = 0.6 * analyticsScore + 0.4 * criticScore;

//     return {
//       text,
//       analyticsScore: Number(analyticsScore.toFixed(2)),
//       criticScore: Number(criticScore.toFixed(2)),
//       finalScore: Number(finalScore.toFixed(2)),
//     };
//   });

//   // Sort by final score descending
//   scoredVariants.sort((a, b) => b.finalScore - a.finalScore);

//   // 7. Cache suggestions in database (optional, for analytics)
//   for (const variant of scoredVariants) {
//     await prisma.postSuggestion.create({
//       data: {
//         companyId,
//         platform,
//         objective,
//         topicTags: topicTags.length > 0 ? topicTags : null,
//         text: variant.text,
//         analyticsScore: variant.analyticsScore,
//         criticScore: variant.criticScore,
//         finalScore: variant.finalScore,
//         metadata: {
//           examplesUsed: examples.length,
//           competitorsConsidered: competitorAngles.length,
//         },
//       },
//     });
//   }

//   return {
//     variants: scoredVariants,
//     meta: {
//       brief: promptContext,
//       examplesUsed: examples,
//       competitorAngles,
//     },
//   };
// }
