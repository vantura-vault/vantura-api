import axios from 'axios';

// BrightData API configuration
const BRIGHTDATA_API_KEY = process.env.BRIGHTDATA_API_KEY;
const BRIGHTDATA_DATASET_ID = 'gd_l1vikfnt1wgvvqz95w'; // LinkedIn Company Scraper dataset ID
const BRIGHTDATA_SCRAPE_URL = 'https://api.brightdata.com/datasets/v3/scrape';

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

/**
 * Scrape LinkedIn company page using BrightData (synchronous API)
 * Returns the scraped data directly
 */
export async function scrapeLinkedInCompany(linkedinUrl: string): Promise<BrightDataLinkedInCompany[]> {
  if (!BRIGHTDATA_API_KEY) {
    throw new Error('BRIGHTDATA_API_KEY is not configured');
  }

  try {
    const response = await axios.post<BrightDataLinkedInCompany[] | BrightDataLinkedInCompany>(
      BRIGHTDATA_SCRAPE_URL,
      {
        input: [{ url: linkedinUrl }],
      },
      {
        headers: {
          Authorization: `Bearer ${BRIGHTDATA_API_KEY}`,
          'Content-Type': 'application/json',
        },
        params: {
          dataset_id: BRIGHTDATA_DATASET_ID,
          notify: false,
          include_errors: true,
        },
        timeout: 120000, // 2 minute timeout
      }
    );

    // BrightData can return either an array or a single object
    // Normalize to always return an array
    const data = response.data;
    return Array.isArray(data) ? data : [data];
  } catch (error) {
    console.error('BrightData scrape error:', error);
    if (axios.isAxiosError(error)) {
      console.error('Response data:', error.response?.data);
      console.error('Response status:', error.response?.status);
    }
    throw new Error('Failed to trigger LinkedIn scraping');
  }
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
