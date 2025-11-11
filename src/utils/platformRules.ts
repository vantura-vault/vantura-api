import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface PlatformRules {
  platform: string;
  description: string;
  hookPatterns: any;
  postStructure: any;
  hashtags: any;
  mentions?: any;
  timing: any;
  contentFormat: any;
  toneGuidelines: any;
  engagementTriggers: any;
}

/**
 * Load platform-specific rules from JSON config files
 * Files are hot-reloadable - changes take effect immediately
 */
export function loadPlatformRules(platform: string): PlatformRules {
  const normalizedPlatform = platform.toLowerCase();

  // Try multiple paths to support both dev and production environments
  const possiblePaths = [
    // Development: src/config/platform-rules
    path.join(__dirname, '../config/platform-rules', `${normalizedPlatform}.json`),
    // Production (compiled): dist/config/platform-rules
    path.join(__dirname, '../../config/platform-rules', `${normalizedPlatform}.json`),
    // Production (alternative): from project root
    path.join(process.cwd(), 'src/config/platform-rules', `${normalizedPlatform}.json`),
  ];

  let rulesPath: string | null = null;
  for (const testPath of possiblePaths) {
    if (fs.existsSync(testPath)) {
      rulesPath = testPath;
      break;
    }
  }

  if (!rulesPath) {
    throw new Error(`No rules found for platform: ${platform}. Tried paths: ${possiblePaths.join(', ')}`);
  }

  try {
    const rulesData = fs.readFileSync(rulesPath, 'utf-8');
    return JSON.parse(rulesData) as PlatformRules;
  } catch (error) {
    throw new Error(`Failed to load platform rules for ${platform}: ${error}`);
  }
}

/**
 * Get list of available platforms with rules configured
 */
export function getAvailablePlatforms(): string[] {
  const rulesDir = path.join(__dirname, '../config/platform-rules');

  if (!fs.existsSync(rulesDir)) {
    return [];
  }

  const files = fs.readdirSync(rulesDir);
  return files
    .filter(file => file.endsWith('.json'))
    .map(file => file.replace('.json', ''));
}
