import { prisma } from '../db.js';

interface StrategicGoal {
  label: string;
  current: number;
  target: number;
  unit?: string;
  achieved: boolean;
}

interface DataChamberSettings {
  values: string[];
  brandVoice: string;
  targetAudience: string;
  strategicGoals: StrategicGoal[];
  profilePictureUrl?: string;
}

export const dataChamberService = {
  /**
   * Get company data chamber settings
   */
  async getSettings(companyId: string): Promise<DataChamberSettings> {
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: {
        values: true,
        brandVoice: true,
        targetAudience: true,
        strategicGoals: true,
        profilePictureUrl: true,
      },
    });

    if (!company) {
      throw new Error('Company not found');
    }

    // Parse JSON fields or return defaults
    const values = company.values ? JSON.parse(company.values) : [];
    const brandVoice = company.brandVoice || '';
    const targetAudience = company.targetAudience || '';
    const strategicGoals = company.strategicGoals ? JSON.parse(company.strategicGoals) : [];

    return {
      values,
      brandVoice,
      targetAudience,
      strategicGoals,
      profilePictureUrl: company.profilePictureUrl || undefined,
    };
  },

  /**
   * Update company data chamber settings
   */
  async updateSettings(
    companyId: string,
    settings: Partial<DataChamberSettings>
  ): Promise<DataChamberSettings> {
    // Prepare update data
    const updateData: any = {};

    if (settings.values !== undefined) {
      updateData.values = JSON.stringify(settings.values);
    }
    if (settings.brandVoice !== undefined) {
      updateData.brandVoice = settings.brandVoice;
    }
    if (settings.targetAudience !== undefined) {
      updateData.targetAudience = settings.targetAudience;
    }
    if (settings.strategicGoals !== undefined) {
      updateData.strategicGoals = JSON.stringify(settings.strategicGoals);
    }
    if (settings.profilePictureUrl !== undefined) {
      updateData.profilePictureUrl = settings.profilePictureUrl;
    }

    // Update company
    const company = await prisma.company.update({
      where: { id: companyId },
      data: updateData,
      select: {
        values: true,
        brandVoice: true,
        targetAudience: true,
        strategicGoals: true,
        profilePictureUrl: true,
      },
    });

    // Parse and return updated settings
    return {
      values: company.values ? JSON.parse(company.values) : [],
      brandVoice: company.brandVoice || '',
      targetAudience: company.targetAudience || '',
      strategicGoals: company.strategicGoals ? JSON.parse(company.strategicGoals) : [],
      profilePictureUrl: company.profilePictureUrl || undefined,
    };
  },
};
