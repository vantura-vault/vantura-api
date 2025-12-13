import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';

// S3 client singleton
let s3Client: S3Client | null = null;

const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const AWS_S3_BUCKET = process.env.AWS_S3_BUCKET || '';

// Allowed file types with their extensions and magic bytes
const FILE_TYPE_CONFIG: Record<string, {
  extensions: string[];
  magicBytes: Buffer[];
  magicOffset?: number;
}> = {
  'application/pdf': {
    extensions: ['pdf'],
    magicBytes: [Buffer.from('%PDF', 'ascii')],
  },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
    extensions: ['docx'],
    magicBytes: [Buffer.from([0x50, 0x4B, 0x03, 0x04])], // ZIP/DOCX signature
  },
  'application/msword': {
    extensions: ['doc'],
    magicBytes: [Buffer.from([0xD0, 0xCF, 0x11, 0xE0])], // OLE compound document
  },
  'image/png': {
    extensions: ['png'],
    magicBytes: [Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])],
  },
  'image/jpeg': {
    extensions: ['jpg', 'jpeg'],
    magicBytes: [Buffer.from([0xFF, 0xD8, 0xFF])],
  },
  'image/gif': {
    extensions: ['gif'],
    magicBytes: [Buffer.from('GIF87a', 'ascii'), Buffer.from('GIF89a', 'ascii')],
  },
  'image/webp': {
    extensions: ['webp'],
    magicBytes: [Buffer.from('RIFF', 'ascii')], // WebP starts with RIFF, we'll check WEBP at offset 8
  },
};

const ALLOWED_MIME_TYPES = Object.keys(FILE_TYPE_CONFIG);
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILENAME_LENGTH = 255;

/**
 * Initialize S3 client
 */
function getS3Client(): S3Client | null {
  if (s3Client) return s3Client;

  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (!accessKeyId || !secretAccessKey || !AWS_S3_BUCKET) {
    console.log('⚠️ [FileUpload] AWS credentials not configured');
    return null;
  }

  s3Client = new S3Client({
    region: AWS_REGION,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  console.log('✅ [FileUpload] S3 client initialized');
  return s3Client;
}

/**
 * Check if S3 is configured
 */
export function isS3Configured(): boolean {
  return !!getS3Client() && !!AWS_S3_BUCKET;
}

/**
 * Get file extension from filename
 */
function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  if (parts.length < 2) return '';
  return parts.pop()?.toLowerCase() || '';
}

/**
 * Validate file extension matches MIME type
 */
function validateExtension(
  filename: string,
  mimeType: string
): { valid: boolean; error?: string } {
  const config = FILE_TYPE_CONFIG[mimeType];
  if (!config) {
    return { valid: false, error: 'Unknown file type' };
  }

  const extension = getFileExtension(filename);
  if (!extension) {
    return { valid: false, error: 'File must have an extension' };
  }

  if (!config.extensions.includes(extension)) {
    return {
      valid: false,
      error: `Extension .${extension} doesn't match file type. Expected: .${config.extensions.join(' or .')}`,
    };
  }

  return { valid: true };
}

/**
 * Verify file content matches claimed MIME type using magic bytes
 */
function validateMagicBytes(
  fileBuffer: Buffer,
  mimeType: string
): { valid: boolean; error?: string } {
  const config = FILE_TYPE_CONFIG[mimeType];
  if (!config) {
    return { valid: false, error: 'Unknown file type' };
  }

  // Check if any of the magic byte signatures match
  const matchesSignature = config.magicBytes.some((signature) => {
    const offset = config.magicOffset || 0;
    if (fileBuffer.length < offset + signature.length) {
      return false;
    }
    return fileBuffer.subarray(offset, offset + signature.length).equals(signature);
  });

  // Special case for WebP: also check for "WEBP" at offset 8
  if (mimeType === 'image/webp' && matchesSignature) {
    if (fileBuffer.length >= 12) {
      const webpMarker = fileBuffer.subarray(8, 12).toString('ascii');
      if (webpMarker !== 'WEBP') {
        return {
          valid: false,
          error: 'File content does not match WebP format',
        };
      }
    }
  }

  if (!matchesSignature) {
    return {
      valid: false,
      error: `File content does not match claimed type (${mimeType}). File may be corrupted or mislabeled.`,
    };
  }

  return { valid: true };
}

/**
 * Generate SHA-256 hash of file content
 */
export function generateContentHash(fileBuffer: Buffer): string {
  return crypto.createHash('sha256').update(fileBuffer).digest('hex');
}

/**
 * Validate file type, size, extension, and content
 */
export function validateFile(
  filename: string,
  mimeType: string,
  size: number,
  fileBuffer?: Buffer
): { valid: boolean; error?: string } {
  // Check filename length
  if (filename.length > MAX_FILENAME_LENGTH) {
    return {
      valid: false,
      error: `Filename too long. Maximum ${MAX_FILENAME_LENGTH} characters.`,
    };
  }

  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return {
      valid: false,
      error: `File type not allowed. Allowed types: PDF, DOCX, PNG, JPG, GIF, WebP`,
    };
  }

  // Check file size
  if (size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    };
  }

  // Check extension matches MIME type
  const extensionResult = validateExtension(filename, mimeType);
  if (!extensionResult.valid) {
    return extensionResult;
  }

  // Check magic bytes if buffer provided
  if (fileBuffer) {
    const magicResult = validateMagicBytes(fileBuffer, mimeType);
    if (!magicResult.valid) {
      return magicResult;
    }
  }

  return { valid: true };
}

/**
 * Generate unique S3 key for a file
 */
function generateS3Key(companyId: string, originalName: string, mimeType: string): string {
  const timestamp = Date.now();
  const hash = crypto.randomBytes(8).toString('hex');

  // Get file extension from mime type or original name
  let extension = getFileExtension(originalName);
  if (!extension) {
    const config = FILE_TYPE_CONFIG[mimeType];
    extension = config?.extensions[0] || 'bin';
  }

  // Sanitize original name for use in key
  const sanitizedName = originalName
    .replace(/\.[^/.]+$/, '') // Remove extension
    .replace(/[^a-zA-Z0-9-_]/g, '_') // Replace special chars
    .substring(0, 50); // Limit length

  return `files/${companyId}/${timestamp}-${hash}-${sanitizedName}.${extension}`;
}

/**
 * Upload a file to S3
 */
export async function uploadFileToS3(
  companyId: string,
  fileBuffer: Buffer,
  originalName: string,
  mimeType: string
): Promise<{ s3Key: string; s3Url: string; contentHash: string } | null> {
  const client = getS3Client();
  if (!client || !AWS_S3_BUCKET) {
    console.error('❌ [FileUpload] S3 not configured');
    return null;
  }

  try {
    const s3Key = generateS3Key(companyId, originalName, mimeType);
    const contentHash = generateContentHash(fileBuffer);

    console.log(`📤 [FileUpload] Uploading: ${originalName} -> ${s3Key}`);

    // Sanitize filename for Content-Disposition header (ASCII only, URL-encoded)
    const safeFilename = encodeURIComponent(originalName).replace(/['()]/g, escape);

    const command = new PutObjectCommand({
      Bucket: AWS_S3_BUCKET,
      Key: s3Key,
      Body: fileBuffer,
      ContentType: mimeType,
      ContentDisposition: `inline; filename*=UTF-8''${safeFilename}`,
    });

    await client.send(command);

    const s3Url = `https://${AWS_S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;
    console.log(`✅ [FileUpload] Uploaded: ${s3Url}`);

    return { s3Key, s3Url, contentHash };
  } catch (error) {
    console.error('❌ [FileUpload] Upload failed:', error);
    return null;
  }
}

/**
 * Delete a file from S3
 */
export async function deleteFileFromS3(s3Key: string): Promise<boolean> {
  const client = getS3Client();
  if (!client || !AWS_S3_BUCKET) {
    console.error('❌ [FileUpload] S3 not configured');
    return false;
  }

  try {
    console.log(`🗑️ [FileUpload] Deleting: ${s3Key}`);

    const command = new DeleteObjectCommand({
      Bucket: AWS_S3_BUCKET,
      Key: s3Key,
    });

    await client.send(command);
    console.log(`✅ [FileUpload] Deleted: ${s3Key}`);

    return true;
  } catch (error) {
    console.error('❌ [FileUpload] Delete failed:', error);
    return false;
  }
}

/**
 * Get file icon based on mime type
 */
export function getFileIcon(mimeType: string): string {
  if (mimeType.includes('pdf')) return 'pdf';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'doc';
  if (mimeType.startsWith('image/')) return 'image';
  return 'file';
}
