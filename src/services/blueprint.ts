import { prisma } from '../db.js';

export type ActionType = 'post' | 'comment' | 'repost' | 'story' | 'video';

export interface CreateBlueprintInput {
  companyId: string;
  title: string;
  platform: string;
  actionType?: ActionType;
  objective: string;
  topicTags: string[];
  contentAngle?: string;
  useDataChamber?: boolean;
  useYourTopPosts?: boolean;
  useCompetitorPosts?: boolean;
  reasoning?: string;
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
      actionType: input.actionType,
      objective: input.objective,
      topicTags: input.topicTags,
      contentAngle: input.contentAngle,
      useDataChamber: input.useDataChamber ?? true,
      useYourTopPosts: input.useYourTopPosts ?? true,
      useCompetitorPosts: input.useCompetitorPosts ?? true,
      reasoning: input.reasoning,
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

export interface GetBlueprintsParams {
  companyId: string;
  platform?: string;
  actionType?: string;
  sortBy?: 'createdAt' | 'vanturaScore' | 'title';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export async function getBlueprints(params: GetBlueprintsParams) {
  const {
    companyId,
    platform,
    actionType,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    limit = 20,
    offset = 0,
  } = params;

  const where: any = { companyId };
  if (platform) {
    where.platform = platform;
  }
  if (actionType) {
    where.actionType = actionType;
  }

  const orderBy: any = {};
  orderBy[sortBy] = sortOrder;

  const [blueprints, total] = await Promise.all([
    prisma.blueprint.findMany({
      where,
      orderBy,
      take: limit,
      skip: offset,
    }),
    prisma.blueprint.count({ where }),
  ]);

  return {
    blueprints,
    total,
    limit,
    offset,
  };
}

export async function getBlueprintById(id: string, companyId: string) {
  const blueprint = await prisma.blueprint.findFirst({
    where: { id, companyId },
  });

  return blueprint;
}

export async function updateBlueprintTitle(id: string, companyId: string, title: string) {
  const blueprint = await prisma.blueprint.updateMany({
    where: { id, companyId },
    data: { title },
  });

  if (blueprint.count === 0) {
    throw new Error('Blueprint not found or unauthorized');
  }

  // Fetch the updated blueprint to return it
  const updatedBlueprint = await prisma.blueprint.findUnique({
    where: { id },
  });

  return updatedBlueprint;
}

export async function deleteBlueprint(id: string, companyId: string) {
  const blueprint = await prisma.blueprint.deleteMany({
    where: { id, companyId },
  });

  if (blueprint.count === 0) {
    throw new Error('Blueprint not found or unauthorized');
  }

  return blueprint;
}
