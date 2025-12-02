import { prisma } from '../db.js';

interface DataChamberSettings {
  values: string[];
  brandVoice: string;
  targetAudience: string;
  personalNotes: string;
  profilePictureUrl?: string;
  linkedInUrl?: string;
  linkedInType?: string;
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
        personalNotes: true,
        profilePictureUrl: true,
        linkedInUrl: true,
        linkedInType: true,
      },
    });

    if (!company) {
      throw new Error('Company not found');
    }

    // Parse JSON fields or return defaults
    const values = company.values ? JSON.parse(company.values) : [];
    const brandVoice = company.brandVoice || '';
    const targetAudience = company.targetAudience || '';
    const personalNotes = company.personalNotes || '';

    return {
      values,
      brandVoice,
      targetAudience,
      personalNotes,
      profilePictureUrl: company.profilePictureUrl || undefined,
      linkedInUrl: company.linkedInUrl || undefined,
      linkedInType: company.linkedInType || undefined,
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
    if (settings.personalNotes !== undefined) {
      updateData.personalNotes = settings.personalNotes;
    }
    if (settings.profilePictureUrl !== undefined) {
      updateData.profilePictureUrl = settings.profilePictureUrl;
    }
    if (settings.linkedInUrl !== undefined) {
      updateData.linkedInUrl = settings.linkedInUrl;
    }
    if (settings.linkedInType !== undefined) {
      updateData.linkedInType = settings.linkedInType;
    }

    // Update company
    const company = await prisma.company.update({
      where: { id: companyId },
      data: updateData,
      select: {
        values: true,
        brandVoice: true,
        targetAudience: true,
        personalNotes: true,
        profilePictureUrl: true,
        linkedInUrl: true,
        linkedInType: true,
      },
    });

    // Parse and return updated settings
    return {
      values: company.values ? JSON.parse(company.values) : [],
      brandVoice: company.brandVoice || '',
      targetAudience: company.targetAudience || '',
      personalNotes: company.personalNotes || '',
      profilePictureUrl: company.profilePictureUrl || undefined,
      linkedInUrl: company.linkedInUrl || undefined,
      linkedInType: company.linkedInType || undefined,
    };
  },

  /**
   * Sync LinkedIn profile/company data and return profile picture
   */
  async syncLinkedIn(
    companyId: string,
    url: string,
    type: 'profile' | 'company'
  ): Promise<{ profilePictureUrl?: string; name?: string }> {
    // Import BrightData scraper functions dynamically to avoid circular imports
    const { scrapeLinkedInCompany, scrapeLinkedInProfile } = await import('./brightdata.js');

    let profilePictureUrl: string | undefined;
    let name: string | undefined;

    try {
      if (type === 'company') {
        console.log(`🔍 [DataChamber] Syncing LinkedIn company: ${url}`);
        const results = await scrapeLinkedInCompany(url);
        if (results && results.length > 0) {
          const data = results[0];
          profilePictureUrl = data.logo;
          name = data.name;
          console.log(`✅ [DataChamber] Got company logo: ${profilePictureUrl}`);
        }
      } else {
        console.log(`🔍 [DataChamber] Syncing LinkedIn profile: ${url}`);
        const results = await scrapeLinkedInProfile(url);
        if (results && results.length > 0) {
          const data = results[0];
          profilePictureUrl = data.avatar;
          name = data.name;
          console.log(`✅ [DataChamber] Got profile avatar: ${profilePictureUrl}`);
        }
      }

      // Update company with the new data
      if (profilePictureUrl) {
        await prisma.company.update({
          where: { id: companyId },
          data: {
            profilePictureUrl,
            linkedInUrl: url,
            linkedInType: type,
          },
        });
      }

      return { profilePictureUrl, name };
    } catch (error) {
      console.error(`❌ [DataChamber] Failed to sync LinkedIn:`, error);
      throw error;
    }
  },
};
