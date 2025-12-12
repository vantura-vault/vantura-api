import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';

// S3 client singleton
let s3Client: S3Client | null = null;

const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET || '';

/**
 * Initialize S3 client
 */
function getS3Client(): S3Client | null {
  if (s3Client) return s3Client;

  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (!accessKeyId || !secretAccessKey || !AWS_S3_BUCKET) {
    console.log('⚠️ [ImageStorage] AWS credentials not configured - image proxying disabled');
    return null;
  }

  s3Client = new S3Client({
    region: AWS_REGION,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  console.log('✅ [ImageStorage] S3 client initialized');
  return s3Client;
}

/**
 * Check if S3 is configured and available
 */
export function isS3Available(): boolean {
  return !!getS3Client() && !!AWS_S3_BUCKET;
}

/**
 * Download image from URL and upload to S3
 * Returns the S3 URL or null if failed
 */
export async function proxyImageToS3(
  imageUrl: string,
  companyId: string,
  type: 'profile' | 'logo' = 'profile'
): Promise<string | null> {
  const client = getS3Client();
  if (!client || !AWS_S3_BUCKET) {
    console.log('⚠️ [ImageStorage] S3 not configured, returning original URL');
    return null;
  }

  try {
    console.log(`📸 [ImageStorage] Proxying image: ${imageUrl.substring(0, 50)}...`);

    // Download the image
    const response = await fetch(imageUrl, {
      headers: {
        // Some CDNs require a user agent
        'User-Agent': 'Mozilla/5.0 (compatible; VanturaBot/1.0)',
      },
    });

    if (!response.ok) {
      console.error(`❌ [ImageStorage] Failed to download image: ${response.status}`);
      return null;
    }

    // Get image data
    const imageBuffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    // Determine file extension from content type
    let extension = 'jpg';
    if (contentType.includes('png')) extension = 'png';
    else if (contentType.includes('gif')) extension = 'gif';
    else if (contentType.includes('webp')) extension = 'webp';

    // Generate unique filename
    const hash = crypto.createHash('md5').update(imageUrl).digest('hex').substring(0, 8);
    const filename = `${type}/${companyId}/${hash}.${extension}`;

    // Upload to S3
    const command = new PutObjectCommand({
      Bucket: AWS_S3_BUCKET,
      Key: filename,
      Body: imageBuffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000', // Cache for 1 year
    });

    await client.send(command);

    // Build the S3 URL
    const s3Url = `https://${AWS_S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${filename}`;
    console.log(`✅ [ImageStorage] Uploaded to S3: ${s3Url}`);

    return s3Url;
  } catch (error) {
    console.error('❌ [ImageStorage] Failed to proxy image:', error);
    return null;
  }
}

/**
 * Check if a URL is already an S3 URL (don't re-proxy)
 */
export function isS3Url(url: string): boolean {
  return url.includes('.s3.') && url.includes('amazonaws.com');
}

/**
 * Proxy image to S3 only if it's not already an S3 URL
 */
export async function ensureS3Image(
  imageUrl: string | null | undefined,
  companyId: string,
  type: 'profile' | 'logo' = 'profile'
): Promise<string | null> {
  if (!imageUrl) return null;

  // Already on S3, no need to proxy
  if (isS3Url(imageUrl)) {
    return imageUrl;
  }

  // Proxy to S3
  const s3Url = await proxyImageToS3(imageUrl, companyId, type);

  // Return S3 URL if successful, otherwise return original
  return s3Url || imageUrl;
}
