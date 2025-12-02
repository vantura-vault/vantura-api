import axios from 'axios';

// BrightData API configuration
const BRIGHTDATA_API_KEY = process.env.BRIGHTDATA_API_KEY;
const BRIGHTDATA_COMPANY_DATASET_ID = 'gd_l1vikfnt1wgvvqz95w'; // LinkedIn Company Scraper dataset ID
const BRIGHTDATA_PROFILE_DATASET_ID = 'gd_l1viktl72bvl7bjuj0'; // LinkedIn Profile Scraper dataset ID
const BRIGHTDATA_POSTS_DATASET_ID = 'gd_lyy3tktm25m4avu764'; // LinkedIn Posts Discovery dataset ID
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
  avatar?: string; // Profile picture URL
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
    const response = await axios.post(
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
        // Request raw text to handle NDJSON format
        responseType: 'text',
        transformResponse: [(data) => data],
      }
    );

    // BrightData returns NDJSON (newline-delimited JSON) - parse each line
    const rawData = response.data as string;
    const companies: BrightDataLinkedInCompany[] = [];

    const lines = rawData.split('\n').filter(line => line.trim());
    for (const line of lines) {
      try {
        const company = JSON.parse(line) as BrightDataLinkedInCompany;
        companies.push(company);
      } catch (parseError) {
        console.warn('[BrightData] Failed to parse company line:', line.substring(0, 100));
      }
    }

    console.log(`[BrightData] Parsed ${companies.length} companies from NDJSON response`);
    return companies;
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
    const response = await axios.post(
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
        // Request raw text to handle NDJSON format
        responseType: 'text',
        transformResponse: [(data) => data],
      }
    );

    // BrightData returns NDJSON (newline-delimited JSON) - parse each line
    const rawData = response.data as string;
    const profiles: BrightDataLinkedInProfile[] = [];

    const lines = rawData.split('\n').filter(line => line.trim());
    for (const line of lines) {
      try {
        const profile = JSON.parse(line) as BrightDataLinkedInProfile;
        profiles.push(profile);
      } catch (parseError) {
        console.warn('[BrightData] Failed to parse profile line:', line.substring(0, 100));
      }
    }

    console.log(`[BrightData] Parsed ${profiles.length} profiles from NDJSON response`);
    return profiles;
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
 * BrightData LinkedIn Post response from discovery API
 */
export interface BrightDataLinkedInPost {
  url: string;              // Post URL
  id: string;               // Post ID (e.g., "7400624294864801792")
  user_id: string;          // Author's LinkedIn ID
  use_url: string;          // Author's profile URL
  title: string | null;
  headline: string | null;
  post_text: string;        // Post content
  date_posted: string;      // ISO datetime
  hashtags: string[] | null;
  embedded_links: string[] | null;
  images: string[] | null;
  videos: string[] | null;
  num_likes: number;
  num_comments: number;
  top_visible_comments: Array<{
    comment: string;
    comment_date: string;
    comment_images: string[] | null;
    num_reactions: number;
    tagged_users: string[] | null;
    use_url: string;
    user_id: string;
    user_name: string;
    user_title: string | null;
  }> | null;
  user_followers: number;
  user_posts: number;
  user_articles: number;
  post_type: string;        // "post", "article", etc.
  account_type: string;     // "Organization", "Person"
  post_text_html: string | null;
  repost: {
    repost_attachments: string | null;
    repost_date: string | null;
    repost_hangtags: string | null;
    repost_id: string | null;
    repost_text: string | null;
    repost_url: string | null;
    repost_user_id: string | null;
    repost_user_name: string | null;
    repost_user_title: string | null;
    tagged_companies: string[] | null;
    tagged_users: string[] | null;
  } | null;
  tagged_companies: string[];
  tagged_people: string[];
  user_title: string | null;
  author_profile_pic: string | null;
  num_connections: number | null;
  video_duration: string | null;
  external_link_data: any | null;
  video_thumbnail: string | null;
  document_cover_image: string | null;
  document_page_count: number | null;
  original_post_text: string | null;
}

/**
 * Scrape LinkedIn posts using BrightData Posts Discovery API
 * @param linkedinUrl - The LinkedIn company or profile URL
 * @param discoverBy - 'company_url' or 'profile_url'
 * @param dateRange - Optional date range for profile scraping
 */
export async function scrapeLinkedInPosts(
  linkedinUrl: string,
  discoverBy: 'company_url' | 'profile_url',
  dateRange?: { startDate: string; endDate: string }
): Promise<BrightDataLinkedInPost[]> {
  if (!BRIGHTDATA_API_KEY) {
    throw new Error('BRIGHTDATA_API_KEY is not configured');
  }

  console.log(`\n🌐 [BrightData Posts API] Request:`);
  console.log(`   - URL: ${linkedinUrl}`);
  console.log(`   - Discover by: ${discoverBy}`);
  console.log(`   - Dataset ID: ${BRIGHTDATA_POSTS_DATASET_ID}`);

  try {
    // Build input based on discover type
    const input = discoverBy === 'profile_url' && dateRange
      ? [{ url: linkedinUrl, start_date: dateRange.startDate, end_date: dateRange.endDate }]
      : [{ url: linkedinUrl }];

    console.log(`   - Input: ${JSON.stringify(input)}`);
    console.log(`   - Timeout: 300000ms (5 min)`);
    console.log(`   ⏳ Waiting for BrightData response...`);

    const startTime = Date.now();
    const response = await axios.post(
      BRIGHTDATA_SCRAPE_URL,
      { input },
      {
        headers: {
          Authorization: `Bearer ${BRIGHTDATA_API_KEY}`,
          'Content-Type': 'application/json',
        },
        params: {
          dataset_id: BRIGHTDATA_POSTS_DATASET_ID,
          notify: false,
          include_errors: true,
          type: 'discover_new',
          discover_by: discoverBy,
        },
        timeout: 300000, // 5 minute timeout (posts discovery can be slow)
        // Request raw text to handle NDJSON format
        responseType: 'text',
        transformResponse: [(data) => data], // Prevent axios from auto-parsing
      }
    );

    const elapsed = Date.now() - startTime;
    console.log(`\n✅ [BrightData Posts API] Response received in ${elapsed}ms`);

    // BrightData returns NDJSON (newline-delimited JSON) - parse each line
    const rawData = response.data as string;
    console.log(`   - Raw response length: ${rawData.length} chars`);
    console.log(`   - First 200 chars: ${rawData.substring(0, 200)}...`);

    const posts: BrightDataLinkedInPost[] = [];

    // Split by newlines and parse each JSON object
    const lines = rawData.split('\n').filter(line => line.trim());
    console.log(`   - Lines in NDJSON: ${lines.length}`);

    for (const line of lines) {
      try {
        const post = JSON.parse(line) as BrightDataLinkedInPost;
        posts.push(post);
      } catch (parseError) {
        console.warn(`   ⚠️  Failed to parse line: ${line.substring(0, 100)}`);
      }
    }

    console.log(`📊 [BrightData Posts API] Parsed ${posts.length} posts from NDJSON response`);
    return posts;
  } catch (error) {
    console.error('BrightData posts scrape error:', error);
    if (axios.isAxiosError(error)) {
      console.error('Response data:', error.response?.data);
      console.error('Response status:', error.response?.status);
    }
    throw new Error('Failed to scrape LinkedIn posts');
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
