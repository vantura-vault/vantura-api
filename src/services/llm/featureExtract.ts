/**
 * Feature extraction for post analytics scoring
 */

export interface PostFeatures {
  hookStrength: number;      // 0-1
  hasQuestion: boolean;
  hasNumbers: boolean;
  hashtagCount: number;
  timeFit: number;           // 0-1
  platformWeight: number;    // 0-1
  wordCount: number;
  sentenceCount: number;
  avgSentenceLength: number;
  exclamationCount: number;
  emojiCount: number;
}

/**
 * Extract analytics features from post text
 */
export function extractFeatures(text: string, platform: string): PostFeatures {
  const lines = text.split('\n').filter(l => l.trim().length > 0);
  const words = text.split(/\s+/).filter(w => w.length > 0);
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);

  // Hook strength: analyze first line
  const firstLine = lines[0] || '';
  const hookStrength = calculateHookStrength(firstLine);

  // Has question?
  const hasQuestion = /\?/.test(text);

  // Has numbers?
  const hasNumbers = /\d+/.test(text);

  // Hashtag count
  const hashtagCount = (text.match(/#\w+/g) || []).length;

  // Time fit (simplified - could be time-of-day aware)
  const timeFit = 0.8; // Default good time

  // Platform weight
  const platformWeight = getPlatformWeight(platform, text);

  // Text metrics
  const wordCount = words.length;
  const sentenceCount = sentences.length;
  const avgSentenceLength = sentenceCount > 0 ? wordCount / sentenceCount : 0;
  const exclamationCount = (text.match(/!/g) || []).length;
  const emojiCount = (text.match(/[\p{Emoji}]/gu) || []).length;

  return {
    hookStrength,
    hasQuestion,
    hasNumbers,
    hashtagCount,
    timeFit,
    platformWeight,
    wordCount,
    sentenceCount,
    avgSentenceLength,
    exclamationCount,
    emojiCount,
  };
}

/**
 * Calculate hook strength based on first line characteristics
 */
function calculateHookStrength(firstLine: string): number {
  let score = 0.5; // Base score

  // Strong opening words
  const strongOpeners = [
    'imagine', 'what if', 'here\'s', 'stop', 'never', 'always',
    'the truth', 'secret', 'mistake', 'lesson', 'why', 'how'
  ];
  const lowerFirst = firstLine.toLowerCase();
  if (strongOpeners.some(opener => lowerFirst.startsWith(opener))) {
    score += 0.2;
  }

  // Has question or exclamation
  if (/[?!]/.test(firstLine)) {
    score += 0.15;
  }

  // Has numbers (specificity)
  if (/\d+/.test(firstLine)) {
    score += 0.1;
  }

  // Not too long
  if (firstLine.length <= 60) {
    score += 0.05;
  } else if (firstLine.length > 100) {
    score -= 0.1;
  }

  return Math.min(1.0, Math.max(0.0, score));
}

/**
 * Calculate platform-specific weight
 */
function getPlatformWeight(platform: string, text: string): number {
  const wordCount = text.split(/\s+/).length;

  switch (platform.toLowerCase()) {
    case 'linkedin':
      // LinkedIn prefers 150-300 words
      if (wordCount >= 150 && wordCount <= 300) return 1.0;
      if (wordCount >= 100 && wordCount <= 400) return 0.8;
      return 0.6;

    case 'twitter':
      // Twitter is concise
      if (text.length <= 280) return 1.0;
      return 0.3; // Penalize over-length

    case 'instagram':
      // Instagram allows longer, visual-first
      if (wordCount >= 50 && wordCount <= 200) return 1.0;
      if (wordCount < 50) return 0.7;
      return 0.9;

    default:
      return 0.8;
  }
}

/**
 * Compute analytics score from features
 */
export function computeAnalyticsScore(features: PostFeatures): number {
  let score = 0;

  // Hook strength (weight: 0.9)
  score += features.hookStrength * 0.9;

  // Has question (weight: 0.3)
  if (features.hasQuestion) score += 0.3;

  // Has numbers (weight: 0.2)
  if (features.hasNumbers) score += 0.2;

  // Hashtag penalty if too many (weight: -0.1 per excess)
  const optimalHashtags = 5;
  if (features.hashtagCount > optimalHashtags) {
    score -= (features.hashtagCount - optimalHashtags) * 0.1;
  }

  // Time fit (weight: 0.6)
  score += features.timeFit * 0.6;

  // Platform weight (weight: 0.2)
  score += features.platformWeight * 0.2;

  // Normalize to 0-1
  const maxPossibleScore = 0.9 + 0.3 + 0.2 + 0.6 + 0.2; // 2.2
  score = score / maxPossibleScore;

  return Math.min(1.0, Math.max(0.0, score));
}

/**
 * Full feature extraction and scoring
 */
export function scorePost(text: string, platform: string): number {
  const features = extractFeatures(text, platform);
  return computeAnalyticsScore(features);
}
