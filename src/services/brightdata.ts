import axios from 'axios';

// BrightData API configuration
const BRIGHTDATA_API_KEY = process.env.BRIGHTDATA_API_KEY;
const BRIGHTDATA_COMPANY_DATASET_ID = 'gd_l1vikfnt1wgvvqz95w'; // LinkedIn Company Scraper dataset ID
const BRIGHTDATA_PROFILE_DATASET_ID = 'gd_l1viktl72bvl7bjuj0'; // LinkedIn Profile Scraper dataset ID
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

export interface BrightDataLinkedInProfile {
  id: string;
  name: string;
  headline?: string;
  location?: string;
  connections?: number;
  followers?: number;
  about?: string;
  profile_picture?: string;
  url: string;
  posts?: Array<{
    likes_count: number;
    text: string;
    time: string;
    comments_count: number;
    reposts_count?: number;
    images?: string[];
    videos?: string[];
    post_url: string;
    post_id: string;
    date: string;
  }>;
  experiences?: Array<{
    title: string;
    company: string;
    location?: string;
    start_date?: string;
    end_date?: string;
  }>;
  education?: Array<{
    school: string;
    degree?: string;
    field?: string;
    start_year?: string;
    end_year?: string;
  }>;
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
          dataset_id: BRIGHTDATA_COMPANY_DATASET_ID,
          notify: false,
          include_errors: true,
        },
        timeout: 180000, // 3 minute timeout
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
 * Scrape LinkedIn profile page using BrightData
 * Uses scrape API endpoint (synchronous) like company scraper
 */
export async function scrapeLinkedInProfile(linkedinUrl: string): Promise<BrightDataLinkedInProfile[]> {
  if (!BRIGHTDATA_API_KEY) {
    throw new Error('BRIGHTDATA_API_KEY is not configured');
  }

  try {
    // Use scrape API with same format as company scraper
    const response = await axios.post<BrightDataLinkedInProfile[] | BrightDataLinkedInProfile>(
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
          dataset_id: BRIGHTDATA_PROFILE_DATASET_ID,
          notify: false,
          include_errors: true,
        },
        timeout: 150000, // 2.5 minute timeout (profiles take ~90 seconds)
      }
    );

    // BrightData can return either an array or a single object
    // Normalize to always return an array
    const data = response.data;
    return Array.isArray(data) ? data : [data];
  } catch (error) {
    console.error('BrightData profile scrape error:', error);
    if (axios.isAxiosError(error)) {
      console.error('Response data:', error.response?.data);
      console.error('Response status:', error.response?.status);
    }
    throw new Error('Failed to scrape LinkedIn profile');
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

/**
 * Extract LinkedIn profile slug from URL
 */
export function extractLinkedInProfileSlug(url: string): string | null {
  try {
    const regex = /linkedin\.com\/in\/([^\/\?]+)/i;
    const match = url.match(regex);
    return match ? match[1] : null;
  } catch (error) {
    return null;
  }
}
