import axios from 'axios';

// BrightData API configuration
const BRIGHTDATA_API_KEY = process.env.BRIGHTDATA_API_KEY;
const BRIGHTDATA_COMPANY_DATASET_ID = 'gd_l1vikfnt1wgvvqz95w'; // LinkedIn Company Scraper dataset ID
const BRIGHTDATA_PROFILE_DATASET_ID = 'gd_l1viktl72bvl7bjuj0'; // LinkedIn Profile Scraper dataset ID
const BRIGHTDATA_POSTS_DATASET_ID = 'gd_lyy3tktm25m4avu764'; // LinkedIn Posts Discovery dataset ID
const BRIGHTDATA_SCRAPE_URL = 'https://api.brightdata.com/datasets/v3/scrape';
const BRIGHTDATA_SNAPSHOT_URL = 'https://api.brightdata.com/datasets/v3/snapshot';

// Polling configuration
const SNAPSHOT_POLL_INTERVAL_MS = 5000; // Poll every 5 seconds
const SNAPSHOT_MAX_WAIT_MS = 300000; // Max 5 minutes wait
const SNAPSHOT_RETRY_DELAY_MS = 10000; // Wait 10 seconds if status is "starting"

/**
 * Helper to sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check the status of a BrightData snapshot
 */
async function checkSnapshotStatus(snapshotId: string): Promise<{ status: string; data?: unknown[] }> {
  const response = await axios.get(`${BRIGHTDATA_SNAPSHOT_URL}/${snapshotId}`, {
    headers: {
      Authorization: `Bearer ${BRIGHTDATA_API_KEY}`,
    },
    params: {
      format: 'json',
    },
    timeout: 30000,
    validateStatus: () => true, // Don't throw on any status code
  });

  // BrightData returns different status codes:
  // 200 = ready, data in body
  // 202 = still processing
  // Other = error

  if (response.status === 200) {
    // Data is ready
    const data = Array.isArray(response.data) ? response.data : [response.data];
    return { status: 'ready', data };
  }

  if (response.status === 202) {
    // Still processing - check the response for status info
    const statusInfo = response.data as { status?: string; message?: string };
    return { status: statusInfo?.status || 'processing' };
  }

  // Error
  console.error(`[BrightData] Snapshot check failed:`, response.status, response.data);
  return { status: 'error' };
}

/**
 * Poll a snapshot until it's ready or timeout
 */
async function pollSnapshot<T>(snapshotId: string, description: string): Promise<T[]> {
  console.log(`⏳ [BrightData] Polling snapshot ${snapshotId} (${description})...`);

  const startTime = Date.now();
  let pollCount = 0;

  while (Date.now() - startTime < SNAPSHOT_MAX_WAIT_MS) {
    pollCount++;
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`   📡 Poll #${pollCount} (${elapsed}s elapsed)...`);

    const result = await checkSnapshotStatus(snapshotId);

    if (result.status === 'ready' && result.data) {
      console.log(`   ✅ Snapshot ready! Got ${result.data.length} items`);
      return result.data as T[];
    }

    if (result.status === 'error') {
      throw new Error(`Snapshot ${snapshotId} returned error`);
    }

    if (result.status === 'starting') {
      // BrightData hasn't started yet, wait a bit longer
      console.log(`   ⏳ Status: starting - waiting ${SNAPSHOT_RETRY_DELAY_MS / 1000}s...`);
      await sleep(SNAPSHOT_RETRY_DELAY_MS);
    } else {
      // Normal processing, poll again after interval
      await sleep(SNAPSHOT_POLL_INTERVAL_MS);
    }
  }

  throw new Error(`Snapshot ${snapshotId} timed out after ${SNAPSHOT_MAX_WAIT_MS / 1000}s`);
}

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
 * Scrape LinkedIn company page using BrightData
 * Now with proper async snapshot polling support
 */
export async function scrapeLinkedInCompany(linkedinUrl: string): Promise<BrightDataLinkedInCompany[]> {
  if (!BRIGHTDATA_API_KEY) {
    throw new Error('BRIGHTDATA_API_KEY is not configured');
  }

  console.log(`\n🏢 [BrightData Company API] Request: ${linkedinUrl}`);

  const MAX_STARTING_RETRIES = 3;
  let startingRetries = 0;

  while (startingRetries < MAX_STARTING_RETRIES) {
    try {
      console.log(`   ⏳ Making request to BrightData...`);
      const startTime = Date.now();

      const response = await axios.post(
        BRIGHTDATA_SCRAPE_URL,
        { input: [{ url: linkedinUrl }] },
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
          timeout: 180000,
          validateStatus: () => true,
        }
      );

      const elapsed = Date.now() - startTime;
      console.log(`   ✅ Response in ${elapsed}ms (status: ${response.status})`);

      // Parse response
      let responseData = response.data;
      if (typeof responseData === 'string') {
        try {
          responseData = JSON.parse(responseData);
        } catch {
          const firstLine = responseData.split('\n')[0];
          try { responseData = JSON.parse(firstLine); } catch { /* ignore */ }
        }
      }

      // Check for async snapshot
      if (typeof responseData === 'object' && responseData !== null) {
        const obj = responseData as Record<string, unknown>;

        if ('snapshot_id' in obj && typeof obj.snapshot_id === 'string') {
          console.log(`   📋 Got async snapshot: ${obj.snapshot_id}`);
          return pollSnapshot<BrightDataLinkedInCompany>(obj.snapshot_id, `Company ${linkedinUrl}`);
        }

        if ('status' in obj && obj.status === 'starting') {
          startingRetries++;
          console.log(`   ⏳ Status: starting (retry ${startingRetries}/${MAX_STARTING_RETRIES})`);
          await sleep(SNAPSHOT_RETRY_DELAY_MS);
          continue;
        }

        if ('error' in obj) {
          console.warn(`   ⚠️ BrightData error: ${obj.error}`);
          return [];
        }
      }

      // Parse NDJSON response
      const rawData = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
      const companies: BrightDataLinkedInCompany[] = [];
      const lines = rawData.split('\n').filter((line: string) => line.trim());

      for (const line of lines) {
        try {
          const company = JSON.parse(line) as BrightDataLinkedInCompany;
          if (!('error' in company) && !('snapshot_id' in company) && !('status' in company)) {
            companies.push(company);
          }
        } catch { /* skip */ }
      }

      console.log(`   📊 Parsed ${companies.length} companies`);
      return companies;

    } catch (error) {
      console.error('BrightData company scrape error:', error);
      throw new Error('Failed to scrape LinkedIn company');
    }
  }

  console.warn(`   ⚠️ BrightData still "starting" after retries`);
  return [];
}


/**
 * Scrape LinkedIn profile page using BrightData
 * Now with proper async snapshot polling support
 */
export async function scrapeLinkedInProfile(linkedinUrl: string): Promise<BrightDataLinkedInProfile[]> {
  if (!BRIGHTDATA_API_KEY) {
    throw new Error('BRIGHTDATA_API_KEY is not configured');
  }

  console.log(`\n👤 [BrightData Profile API] Request: ${linkedinUrl}`);

  const MAX_STARTING_RETRIES = 3;
  let startingRetries = 0;

  while (startingRetries < MAX_STARTING_RETRIES) {
    try {
      console.log(`   ⏳ Making request to BrightData...`);
      const startTime = Date.now();

      const response = await axios.post(
        BRIGHTDATA_SCRAPE_URL,
        { input: [{ url: linkedinUrl }] },
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
          timeout: 180000,
          validateStatus: () => true,
        }
      );

      const elapsed = Date.now() - startTime;
      console.log(`   ✅ Response in ${elapsed}ms (status: ${response.status})`);

      // Parse response
      let responseData = response.data;
      if (typeof responseData === 'string') {
        try {
          responseData = JSON.parse(responseData);
        } catch {
          const firstLine = responseData.split('\n')[0];
          try { responseData = JSON.parse(firstLine); } catch { /* ignore */ }
        }
      }

      // Check for async snapshot
      if (typeof responseData === 'object' && responseData !== null) {
        const obj = responseData as Record<string, unknown>;

        if ('snapshot_id' in obj && typeof obj.snapshot_id === 'string') {
          console.log(`   📋 Got async snapshot: ${obj.snapshot_id}`);
          return pollSnapshot<BrightDataLinkedInProfile>(obj.snapshot_id, `Profile ${linkedinUrl}`);
        }

        if ('status' in obj && obj.status === 'starting') {
          startingRetries++;
          console.log(`   ⏳ Status: starting (retry ${startingRetries}/${MAX_STARTING_RETRIES})`);
          await sleep(SNAPSHOT_RETRY_DELAY_MS);
          continue;
        }

        if ('error' in obj) {
          console.warn(`   ⚠️ BrightData error: ${obj.error}`);
          return [];
        }
      }

      // Parse NDJSON response
      const rawData = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
      const profiles: BrightDataLinkedInProfile[] = [];
      const lines = rawData.split('\n').filter((line: string) => line.trim());

      for (const line of lines) {
        try {
          const profile = JSON.parse(line) as BrightDataLinkedInProfile;
          if (!('error' in profile) && !('snapshot_id' in profile) && !('status' in profile)) {
            profiles.push(profile);
          }
        } catch { /* skip */ }
      }

      console.log(`   📊 Parsed ${profiles.length} profiles`);
      return profiles;

    } catch (error) {
      console.error('BrightData profile scrape error:', error);
      throw new Error('Failed to scrape LinkedIn profile');
    }
  }

  console.warn(`   ⚠️ BrightData still "starting" after retries`);
  return [];
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
 * Now with proper async snapshot polling support
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

  // Retry logic for "starting" status
  const MAX_STARTING_RETRIES = 3;
  let startingRetries = 0;

  while (startingRetries < MAX_STARTING_RETRIES) {
    try {
      // Build input based on discover type
      // For profile_url, BrightData REQUIRES start_date and end_date
      let input: Array<{ url: string; start_date?: string; end_date?: string }>;

      if (discoverBy === 'profile_url') {
        // Use provided dateRange or default to last 2 years
        const endDate = dateRange?.endDate || new Date().toISOString();
        const startDate = dateRange?.startDate || new Date(Date.now() - 2 * 365 * 24 * 60 * 60 * 1000).toISOString();
        input = [{ url: linkedinUrl, start_date: startDate, end_date: endDate }];
        console.log(`   - Date range: ${startDate.split('T')[0]} to ${endDate.split('T')[0]}`);
      } else {
        input = [{ url: linkedinUrl }];
      }

      console.log(`   - Input: ${JSON.stringify(input)}`);
      console.log(`   ⏳ Making initial request to BrightData...`);

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
          timeout: 180000, // 3 minute timeout for initial request
          validateStatus: () => true, // Don't throw on any status code
        }
      );

      const elapsed = Date.now() - startTime;
      console.log(`   ✅ Initial response in ${elapsed}ms (status: ${response.status})`);

      // Parse the response (might be JSON or NDJSON string)
      let responseData = response.data;
      if (typeof responseData === 'string') {
        try {
          // Try to parse as single JSON first
          responseData = JSON.parse(responseData);
        } catch {
          // Might be NDJSON - parse first line to check for snapshot
          const firstLine = responseData.split('\n')[0];
          try {
            responseData = JSON.parse(firstLine);
          } catch {
            // Not valid JSON at all
          }
        }
      }

      // Check for async snapshot response
      if (typeof responseData === 'object' && responseData !== null) {
        const obj = responseData as Record<string, unknown>;

        // Check for snapshot_id - need to poll
        if ('snapshot_id' in obj && typeof obj.snapshot_id === 'string') {
          console.log(`   📋 Got async snapshot: ${obj.snapshot_id}`);
          console.log(`   ⏳ Starting polling (max ${SNAPSHOT_MAX_WAIT_MS / 1000}s)...`);

          const posts = await pollSnapshot<BrightDataLinkedInPost>(
            obj.snapshot_id,
            `Posts for ${linkedinUrl}`
          );

          console.log(`📊 [BrightData Posts API] Got ${posts.length} posts from snapshot`);
          return posts;
        }

        // Check for "starting" status - retry after delay
        if ('status' in obj && obj.status === 'starting') {
          startingRetries++;
          console.log(`   ⏳ Status: starting (retry ${startingRetries}/${MAX_STARTING_RETRIES})`);
          console.log(`   ⏳ Waiting ${SNAPSHOT_RETRY_DELAY_MS / 1000}s before retry...`);
          await sleep(SNAPSHOT_RETRY_DELAY_MS);
          continue;
        }

        // Check for error response
        if ('error' in obj) {
          console.warn(`   ⚠️ BrightData error: ${obj.error}`);
          return []; // Return empty array for errors like "No posts found"
        }
      }

      // Response contains actual data - parse NDJSON
      const rawData = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
      const posts: BrightDataLinkedInPost[] = [];
      const lines = rawData.split('\n').filter((line: string) => line.trim());

      for (const line of lines) {
        try {
          const post = JSON.parse(line) as BrightDataLinkedInPost;
          // Skip error/status responses in the data
          if (!('error' in post) && !('snapshot_id' in post) && !('status' in post)) {
            posts.push(post);
          }
        } catch {
          // Skip unparseable lines
        }
      }

      console.log(`📊 [BrightData Posts API] Parsed ${posts.length} posts from response`);
      return posts;

    } catch (error) {
      console.error('BrightData posts scrape error:', error);
      if (axios.isAxiosError(error)) {
        console.error('Response status:', error.response?.status);
      }
      throw new Error('Failed to scrape LinkedIn posts');
    }
  }

  console.warn(`   ⚠️ BrightData still "starting" after ${MAX_STARTING_RETRIES} retries`);
  return []; // Return empty if we exhausted retries
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
