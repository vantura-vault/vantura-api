import Redis from 'ioredis';

// Redis client singleton
let redis: Redis | null = null;

// Cache key prefixes for organization
export const CacheKeys = {
  authToken: (token: string) => `auth:token:${token}`,
  companySettings: (companyId: string) => `company:settings:${companyId}`,
  competitors: (companyId: string) => `vault:competitors:${companyId}`,
  competitorDetails: (competitorId: string) => `vault:competitor:${competitorId}`,
  analytics: (companyId: string, platform: string, range: string) =>
    `analytics:${companyId}:${platform}:${range}`,
  dataHealth: (companyId: string) => `health:${companyId}`,
  platforms: (companyId: string) => `platforms:${companyId}`,
} as const;

// TTL values in seconds
export const CacheTTL = {
  authToken: 3600,        // 1 hour (tokens are validated against expiry anyway)
  companySettings: 300,   // 5 minutes
  competitors: 600,       // 10 minutes
  competitorDetails: 600, // 10 minutes
  analytics: 300,         // 5 minutes
  dataHealth: 120,        // 2 minutes (changes frequently)
  platforms: 600,         // 10 minutes
} as const;

/**
 * Initialize Redis connection
 * Falls back to no-op cache if Redis is not configured
 */
export function initRedis(): Redis | null {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    console.log('⚠️ [Cache] REDIS_URL not configured - caching disabled');
    return null;
  }

  try {
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });

    redis.on('connect', () => {
      console.log('✅ [Cache] Redis connected');
    });

    redis.on('error', (err) => {
      console.error('❌ [Cache] Redis error:', err.message);
    });

    redis.on('close', () => {
      console.log('⚠️ [Cache] Redis connection closed');
    });

    // Actually connect
    redis.connect().catch((err) => {
      console.error('❌ [Cache] Failed to connect to Redis:', err.message);
      redis = null;
    });

    return redis;
  } catch (error) {
    console.error('❌ [Cache] Failed to initialize Redis:', error);
    return null;
  }
}

/**
 * Get Redis client (may be null if not configured)
 */
export function getRedis(): Redis | null {
  return redis;
}

/**
 * Cache service with fallback to no-op when Redis is unavailable
 */
export const cache = {
  /**
   * Get a value from cache
   * Returns null if not found or Redis unavailable
   */
  async get<T>(key: string): Promise<T | null> {
    if (!redis) return null;

    try {
      const data = await redis.get(key);
      if (!data) return null;

      const parsed = JSON.parse(data);
      console.log(`🎯 [Cache] HIT: ${key}`);
      return parsed as T;
    } catch (error) {
      console.error(`❌ [Cache] GET error for ${key}:`, error);
      return null;
    }
  },

  /**
   * Set a value in cache with TTL
   */
  async set(key: string, value: unknown, ttlSeconds: number): Promise<boolean> {
    if (!redis) return false;

    try {
      await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
      console.log(`💾 [Cache] SET: ${key} (TTL: ${ttlSeconds}s)`);
      return true;
    } catch (error) {
      console.error(`❌ [Cache] SET error for ${key}:`, error);
      return false;
    }
  },

  /**
   * Delete a key from cache
   */
  async del(key: string): Promise<boolean> {
    if (!redis) return false;

    try {
      await redis.del(key);
      console.log(`🗑️ [Cache] DEL: ${key}`);
      return true;
    } catch (error) {
      console.error(`❌ [Cache] DEL error for ${key}:`, error);
      return false;
    }
  },

  /**
   * Delete multiple keys matching a pattern
   * Use with caution - KEYS command can be slow on large datasets
   */
  async delPattern(pattern: string): Promise<boolean> {
    if (!redis) return false;

    try {
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
        console.log(`🗑️ [Cache] DEL PATTERN: ${pattern} (${keys.length} keys)`);
      }
      return true;
    } catch (error) {
      console.error(`❌ [Cache] DEL PATTERN error for ${pattern}:`, error);
      return false;
    }
  },

  /**
   * Check if Redis is available
   */
  isAvailable(): boolean {
    return redis !== null && redis.status === 'ready';
  },

  /**
   * Get or set pattern - fetch from cache or compute and cache
   */
  async getOrSet<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds: number
  ): Promise<T> {
    // Try cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Cache miss - fetch data
    const data = await fetcher();

    // Store in cache (don't await - fire and forget)
    this.set(key, data, ttlSeconds).catch(() => {});

    return data;
  },
};

/**
 * Graceful shutdown - close Redis connection
 */
export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
    console.log('👋 [Cache] Redis connection closed');
  }
}
