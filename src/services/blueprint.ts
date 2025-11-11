import { prisma } from '../db.js';

export interface CreateBlueprintInput {
  companyId: string;
  title: string;
  platform: string;
  objective: string;
  topicTags: string[];
  useDataChamber?: boolean;
  useYourTopPosts?: boolean;
  useCompetitorPosts?: boolean;
  visualDescription: string;
  references?: string;
  hook: string;
  context: string;
  hashtags: Array<{ tag: string; engagement: string }>;
  mentions?: Array<{ handle: string; engagement: string }>;
  bestTimeToPost?: string;
  recommendedFormat?: string;
  postingInsight?: string;
  dataSources: string[];
  timeWindow?: string;
  confidence?: number;
  yourPerformanceScore?: number;
  competitorScore?: number;
  vanturaScore?: number;
  estimatedReachMin?: number;
  estimatedReachMax?: number;
  estimatedEngagementMin?: number;
  estimatedEngagementMax?: number;
  optimizationNote?: string;
}

export async function createBlueprint(input: CreateBlueprintInput) {
  const blueprint = await prisma.blueprint.create({
    data: {
      companyId: input.companyId,
      title: input.title,
      platform: input.platform,
      objective: input.objective,
      topicTags: input.topicTags,
      useDataChamber: input.useDataChamber ?? true,
      useYourTopPosts: input.useYourTopPosts ?? true,
      useCompetitorPosts: input.useCompetitorPosts ?? true,
      visualDescription: input.visualDescription,
      references: input.references,
      hook: input.hook,
      context: input.context,
      hashtags: input.hashtags,
      mentions: input.mentions,
      bestTimeToPost: input.bestTimeToPost,
      recommendedFormat: input.recommendedFormat,
      postingInsight: input.postingInsight,
      dataSources: input.dataSources,
      timeWindow: input.timeWindow,
      confidence: input.confidence,
      yourPerformanceScore: input.yourPerformanceScore,
      competitorScore: input.competitorScore,
      vanturaScore: input.vanturaScore,
      estimatedReachMin: input.estimatedReachMin,
      estimatedReachMax: input.estimatedReachMax,
      estimatedEngagementMin: input.estimatedEngagementMin,
      estimatedEngagementMax: input.estimatedEngagementMax,
      optimizationNote: input.optimizationNote,
    },
  });

  return blueprint;
}

export async function getBlueprints(companyId: string) {
  const blueprints = await prisma.blueprint.findMany({
    where: { companyId },
    orderBy: { createdAt: 'desc' },
  });

  return blueprints;
}

export async function getBlueprintById(id: string, companyId: string) {
  const blueprint = await prisma.blueprint.findFirst({
    where: { id, companyId },
  });

  return blueprint;
}

export async function deleteBlueprint(id: string, companyId: string) {
  const blueprint = await prisma.blueprint.deleteMany({
    where: { id, companyId },
  });

  return blueprint;
}
