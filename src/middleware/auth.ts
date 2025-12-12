import { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.js';
import { cache, CacheKeys, CacheTTL } from '../services/cache.js';

// Type for cached user data
interface CachedUser {
  id: string;
  email: string;
  name: string;
  companyId: string | null;
  role: string;
  tokenExpiresAt: string;
}

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No token provided'
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const cacheKey = CacheKeys.authToken(token);

    // Try to get user from cache first
    const cachedUser = await cache.get<CachedUser>(cacheKey);

    if (cachedUser) {
      // Check if token is still valid (not expired)
      if (new Date(cachedUser.tokenExpiresAt) < new Date()) {
        // Token expired - delete from cache and reject
        await cache.del(cacheKey);
        return res.status(401).json({
          success: false,
          error: 'Token expired'
        });
      }

      // Cache hit - use cached user data
      // Cast to User type - auth middleware only needs id/email/name/companyId/role
      req.user = {
        id: cachedUser.id,
        email: cachedUser.email,
        name: cachedUser.name,
        companyId: cachedUser.companyId,
        role: cachedUser.role,
        passwordHash: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      return next();
    }

    // Cache miss - verify token from database
    const user = await authService.verifyToken(token);

    // Get token expiry for caching
    const tokenData = await authService.getTokenExpiry(token);

    // Cache the user data (with token expiry info)
    if (tokenData) {
      const userToCache: CachedUser = {
        id: user.id,
        email: user.email,
        name: user.name,
        companyId: user.companyId,
        role: user.role,
        tokenExpiresAt: tokenData.expiresAt.toISOString(),
      };
      await cache.set(cacheKey, userToCache, CacheTTL.authToken);
    }

    // Attach user to request
    req.user = user;

    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: error instanceof Error ? error.message : 'Authentication failed'
    });
  }
}
