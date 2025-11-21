import axios from 'axios';

// BrightData API configuration
const BRIGHTDATA_API_KEY = process.env.BRIGHTDATA_API_KEY;
const BRIGHTDATA_LINKEDIN_SCRAPER_URL = 'https://api.brightdata.com/datasets/v3/trigger';

export interface BrightDataLinkedInCompany {
  id: string;
  name: string;
  country_code: string;
  followers: number;
  employees_in_linkedin: number;
  about?: string;
  specialties?: string;
  company_size?: string;
  industries?: string;
  website?: string;
  company_id: string;
  headquarters?: string;
  logo?: string;
  url: string;
  updates?: Array<{
    likes_count: number;
    text: string;
    time: string;
    title: string;
    comments_count: number;
    images?: string[];
    videos?: string[];
    post_url: string;
    post_id: string;
    date: string;
  }>;
  description?: string;
  unformatted_about?: string;
  founded?: number;
  timestamp: string;
}

interface BrightDataResponse {
  snapshot_id: string;
  status: string;
}

/**
 * Trigger BrightData to scrape a LinkedIn company page
 */
export async function scrapeLinkedInCompany(linkedinUrl: string): Promise<string> {
  if (!BRIGHTDATA_API_KEY) {
    throw new Error('BRIGHTDATA_API_KEY is not configured');
  }

  try {
    const response = await axios.post<BrightDataResponse>(
      BRIGHTDATA_LINKEDIN_SCRAPER_URL,
      [
        {
          url: linkedinUrl,
        },
      ],
      {
        headers: {
          Authorization: `Bearer ${BRIGHTDATA_API_KEY}`,
          'Content-Type': 'application/json',
        },
        params: {
          dataset_id: 'gd_l7q7dkf244hwjntr0', // BrightData LinkedIn Company Scraper dataset ID
          include_errors: true,
        },
      }
    );

    return response.data.snapshot_id;
  } catch (error) {
    console.error('BrightData scrape error:', error);
    throw new Error('Failed to trigger LinkedIn scraping');
  }
}

/**
 * Get the results of a BrightData scraping job
 */
export async function getBrightDataSnapshot(snapshotId: string): Promise<BrightDataLinkedInCompany[]> {
  if (!BRIGHTDATA_API_KEY) {
    throw new Error('BRIGHTDATA_API_KEY is not configured');
  }

  try {
    const response = await axios.get<BrightDataLinkedInCompany[]>(
      `https://api.brightdata.com/datasets/v3/snapshot/${snapshotId}`,
      {
        headers: {
          Authorization: `Bearer ${BRIGHTDATA_API_KEY}`,
        },
        params: {
          format: 'json',
        },
      }
    );

    return response.data;
  } catch (error) {
    console.error('BrightData snapshot fetch error:', error);
    throw new Error('Failed to fetch scraping results');
  }
}

/**
 * Poll BrightData until the scraping job is complete (with timeout)
 */
export async function pollBrightDataSnapshot(
  snapshotId: string,
  maxAttempts = 30,
  delayMs = 2000
): Promise<BrightDataLinkedInCompany[]> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const data = await getBrightDataSnapshot(snapshotId);
      if (data && data.length > 0) {
        return data;
      }
    } catch (error) {
      // Continue polling if not ready yet
    }

    // Wait before next attempt
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new Error('BrightData scraping timed out');
}

/**
 * Extract LinkedIn company ID/slug from URL
 */
export function extractLinkedInCompanySlug(url: string): string | null {
  try {
    const regex = /linkedin\.com\/company\/([^\/\?]+)/i;
    const match = url.match(regex);
    return match ? match[1] : null;
  } catch (error) {
    return null;
  }
}
