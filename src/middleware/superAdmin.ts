import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to require super_admin role for protected routes.
 * Must be used after the authenticate middleware.
 */
export function requireSuperAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
    });
    return;
  }

  if (req.user.role !== 'super_admin') {
    res.status(403).json({
      success: false,
      error: 'Super admin access required',
    });
    return;
  }

  next();
}
