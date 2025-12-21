import { prisma } from '../config/database.js';

export interface CreateDraftDTO {
  companyId: string;
  blueprintId: string;
}

export interface UpdateDraftDTO {
  imageUrl?: string | null;
  caption?: string | null;
  selectedHashtags?: string[];
  currentStep?: number;
  status?: string;
}

export interface DraftWithBlueprint {
  id: string;
  companyId: string;
  blueprintId: string;
  platform: string;
  imageUrl: string | null;
  caption: string | null;
  selectedHashtags: string[];
  currentStep: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  blueprint: {
    id: string;
    title: string;
    platform: string;
    objective: string;
    hook: string;
    context: string;
    visualDescription: string;
    hashtags: unknown;
    mentions: unknown;
    contentFramework: unknown;
    whatToInclude: unknown;
    whatNotToDo: unknown;
    bestTimeToPost: string | null;
    recommendedFormat: string | null;
    postingInsight: string | null;
  };
}

export const draftService = {
  /**
   * Create a new draft from a blueprint
   */
  async createDraft(data: CreateDraftDTO): Promise<DraftWithBlueprint> {
    // First, get the blueprint to copy its platform
    const blueprint = await prisma.blueprint.findUnique({
      where: { id: data.blueprintId },
      select: {
        id: true,
        title: true,
        platform: true,
        objective: true,
        hook: true,
        context: true,
        visualDescription: true,
        hashtags: true,
        mentions: true,
        contentFramework: true,
        whatToInclude: true,
        whatNotToDo: true,
        bestTimeToPost: true,
        recommendedFormat: true,
        postingInsight: true,
      },
    });

    if (!blueprint) {
      throw new Error('Blueprint not found');
    }

    // Check if there's already an in-progress draft for this blueprint
    const existingDraft = await prisma.postDraft.findFirst({
      where: {
        companyId: data.companyId,
        blueprintId: data.blueprintId,
        status: 'in_progress',
      },
      include: {
        blueprint: {
          select: {
            id: true,
            title: true,
            platform: true,
            objective: true,
            hook: true,
            context: true,
            visualDescription: true,
            hashtags: true,
            mentions: true,
            contentFramework: true,
            whatToInclude: true,
            whatNotToDo: true,
            bestTimeToPost: true,
            recommendedFormat: true,
            postingInsight: true,
          },
        },
      },
    });

    if (existingDraft) {
      // Return existing draft instead of creating new one
      return existingDraft as DraftWithBlueprint;
    }

    // Create new draft
    const draft = await prisma.postDraft.create({
      data: {
        companyId: data.companyId,
        blueprintId: data.blueprintId,
        platform: blueprint.platform,
        currentStep: 1,
        status: 'in_progress',
        selectedHashtags: [],
      },
      include: {
        blueprint: {
          select: {
            id: true,
            title: true,
            platform: true,
            objective: true,
            hook: true,
            context: true,
            visualDescription: true,
            hashtags: true,
            mentions: true,
            contentFramework: true,
            whatToInclude: true,
            whatNotToDo: true,
            bestTimeToPost: true,
            recommendedFormat: true,
            postingInsight: true,
          },
        },
      },
    });

    return draft as DraftWithBlueprint;
  },

  /**
   * Get all drafts for a company
   */
  async getDrafts(companyId: string): Promise<DraftWithBlueprint[]> {
    const drafts = await prisma.postDraft.findMany({
      where: { companyId },
      include: {
        blueprint: {
          select: {
            id: true,
            title: true,
            platform: true,
            objective: true,
            hook: true,
            context: true,
            visualDescription: true,
            hashtags: true,
            mentions: true,
            contentFramework: true,
            whatToInclude: true,
            whatNotToDo: true,
            bestTimeToPost: true,
            recommendedFormat: true,
            postingInsight: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return drafts as DraftWithBlueprint[];
  },

  /**
   * Get a single draft by ID
   */
  async getDraft(id: string, companyId: string): Promise<DraftWithBlueprint | null> {
    const draft = await prisma.postDraft.findFirst({
      where: {
        id,
        companyId, // Ensure user can only access their own drafts
      },
      include: {
        blueprint: {
          select: {
            id: true,
            title: true,
            platform: true,
            objective: true,
            hook: true,
            context: true,
            visualDescription: true,
            hashtags: true,
            mentions: true,
            contentFramework: true,
            whatToInclude: true,
            whatNotToDo: true,
            bestTimeToPost: true,
            recommendedFormat: true,
            postingInsight: true,
          },
        },
      },
    });

    return draft as DraftWithBlueprint | null;
  },

  /**
   * Update a draft (auto-save)
   */
  async updateDraft(id: string, companyId: string, data: UpdateDraftDTO): Promise<DraftWithBlueprint> {
    // Verify draft belongs to company
    const existingDraft = await prisma.postDraft.findFirst({
      where: { id, companyId },
    });

    if (!existingDraft) {
      throw new Error('Draft not found');
    }

    const draft = await prisma.postDraft.update({
      where: { id },
      data: {
        ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
        ...(data.caption !== undefined && { caption: data.caption }),
        ...(data.selectedHashtags !== undefined && { selectedHashtags: data.selectedHashtags }),
        ...(data.currentStep !== undefined && { currentStep: data.currentStep }),
        ...(data.status !== undefined && { status: data.status }),
      },
      include: {
        blueprint: {
          select: {
            id: true,
            title: true,
            platform: true,
            objective: true,
            hook: true,
            context: true,
            visualDescription: true,
            hashtags: true,
            mentions: true,
            contentFramework: true,
            whatToInclude: true,
            whatNotToDo: true,
            bestTimeToPost: true,
            recommendedFormat: true,
            postingInsight: true,
          },
        },
      },
    });

    return draft as DraftWithBlueprint;
  },

  /**
   * Delete a draft
   */
  async deleteDraft(id: string, companyId: string): Promise<void> {
    // Verify draft belongs to company
    const existingDraft = await prisma.postDraft.findFirst({
      where: { id, companyId },
    });

    if (!existingDraft) {
      throw new Error('Draft not found');
    }

    await prisma.postDraft.delete({
      where: { id },
    });
  },

  /**
   * Get draft by blueprint ID (for "Send to Studio" resumption)
   */
  async getDraftByBlueprint(blueprintId: string, companyId: string): Promise<DraftWithBlueprint | null> {
    const draft = await prisma.postDraft.findFirst({
      where: {
        blueprintId,
        companyId,
        status: 'in_progress',
      },
      include: {
        blueprint: {
          select: {
            id: true,
            title: true,
            platform: true,
            objective: true,
            hook: true,
            context: true,
            visualDescription: true,
            hashtags: true,
            mentions: true,
            contentFramework: true,
            whatToInclude: true,
            whatNotToDo: true,
            bestTimeToPost: true,
            recommendedFormat: true,
            postingInsight: true,
          },
        },
      },
    });

    return draft as DraftWithBlueprint | null;
  },
};
