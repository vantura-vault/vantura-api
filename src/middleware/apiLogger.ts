import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db.js';

/**
 * Middleware to log all API requests for admin analytics.
 * Logs endpoint, method, user info, status code, and response time.
 */
export async function apiLogger(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const startTime = Date.now();

  // Capture the original end function
  const originalEnd = res.end;

  // Override res.end to log after response is sent
  res.end = function (this: Response, ...args: Parameters<typeof originalEnd>) {
    const responseTime = Date.now() - startTime;

    // Log asynchronously (don't block response)
    setImmediate(async () => {
      try {
        // Skip logging for health checks and static assets
        if (req.path === '/health' || req.path.startsWith('/static')) {
          return;
        }

        await prisma.apiUsageLog.create({
          data: {
            endpoint: req.path,
            method: req.method,
            userId: req.user?.id || null,
            companyId: req.user?.companyId || null,
            statusCode: res.statusCode,
            responseTime,
            userAgent: req.headers['user-agent'] || null,
            ipAddress:
              req.ip ||
              (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
              null,
          },
        });
      } catch (error) {
        // Log error but don't fail the request
        console.error('[ApiLogger] Failed to log API usage:', error);
      }
    });

    return originalEnd.apply(this, args);
  } as typeof originalEnd;

  next();
}
