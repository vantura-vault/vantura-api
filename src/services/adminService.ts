import { prisma } from '../db.js';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const SALT_ROUNDS = 12;

export const adminService = {
  /**
   * Get all users with company info
   */
  async getUsers(options: {
    limit?: number;
    offset?: number;
    search?: string;
  }) {
    const { limit = 50, offset = 0, search } = options;

    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' as const } },
            { name: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          company: {
            select: { id: true, name: true, industry: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.user.count({ where }),
    ]);

    // Remove sensitive data
    const safeUsers = users.map((user) => ({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      company: user.company,
    }));

    return { users: safeUsers, total, limit, offset };
  },

  /**
   * Get all companies with stats
   */
  async getCompanies(options: {
    limit?: number;
    offset?: number;
    search?: string;
  }) {
    const { limit = 50, offset = 0, search } = options;

    const where = search
      ? {
          name: { contains: search, mode: 'insensitive' as const },
        }
      : {};

    const [companies, total] = await Promise.all([
      prisma.company.findMany({
        where,
        include: {
          _count: {
            select: {
              users: true,
              platforms: true,
              blueprints: true,
              drafts: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.company.count({ where }),
    ]);

    return { companies, total, limit, offset };
  },

  /**
   * Get aggregate stats for admin dashboard
   */
  async getStats() {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      totalCompanies,
      totalBlueprints,
      totalPosts,
      totalDrafts,
      apiCallsToday,
      apiCallsThisWeek,
      newUsersThisWeek,
      newCompaniesThisWeek,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.company.count(),
      prisma.blueprint.count(),
      prisma.post.count(),
      prisma.postDraft.count(),
      prisma.apiUsageLog.count({
        where: { createdAt: { gte: oneDayAgo } },
      }),
      prisma.apiUsageLog.count({
        where: { createdAt: { gte: oneWeekAgo } },
      }),
      prisma.user.count({
        where: { createdAt: { gte: oneWeekAgo } },
      }),
      prisma.company.count({
        where: { createdAt: { gte: oneWeekAgo } },
      }),
    ]);

    return {
      totalUsers,
      totalCompanies,
      totalBlueprints,
      totalPosts,
      totalDrafts,
      apiCallsToday,
      apiCallsThisWeek,
      newUsersThisWeek,
      newCompaniesThisWeek,
    };
  },

  /**
   * Deactivate a user (invalidate all sessions)
   */
  async deactivateUser(userId: string) {
    // Check user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Delete all auth tokens to log them out
    const result = await prisma.authToken.deleteMany({
      where: { userId },
    });

    return {
      success: true,
      message: `User sessions invalidated (${result.count} tokens deleted)`,
    };
  },

  /**
   * Reset a user's password (generate temporary password)
   */
  async resetPassword(userId: string) {
    // Check user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Generate temporary password
    const tempPassword = crypto.randomBytes(8).toString('hex');
    const passwordHash = await bcrypt.hash(tempPassword, SALT_ROUNDS);

    // Update user password
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    // Delete existing tokens to force re-login
    await prisma.authToken.deleteMany({
      where: { userId },
    });

    return {
      success: true,
      tempPassword,
      message: 'Password reset. User must login with temporary password.',
    };
  },

  /**
   * Get API usage metrics
   */
  async getApiUsage(options: { range?: '24h' | '7d' | '30d' }) {
    const { range = '7d' } = options;

    const rangeMs: Record<string, number> = {
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
    };

    const since = new Date(Date.now() - rangeMs[range]);

    // Get calls grouped by endpoint
    const byEndpoint = await prisma.apiUsageLog.groupBy({
      by: ['endpoint', 'method'],
      where: { createdAt: { gte: since } },
      _count: { id: true },
      _avg: { responseTime: true },
    });

    // Get total and error counts
    const [totalCalls, errorCalls] = await Promise.all([
      prisma.apiUsageLog.count({
        where: { createdAt: { gte: since } },
      }),
      prisma.apiUsageLog.count({
        where: {
          createdAt: { gte: since },
          statusCode: { gte: 400 },
        },
      }),
    ]);

    // Get calls by user (top 10)
    const byUser = await prisma.apiUsageLog.groupBy({
      by: ['userId'],
      where: {
        createdAt: { gte: since },
        userId: { not: null },
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    });

    // Get user info for top users
    const userIds = byUser
      .map((u) => u.userId)
      .filter((id): id is string => id !== null);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, name: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    return {
      range,
      totalCalls,
      errorCalls,
      errorRate: totalCalls > 0 ? (errorCalls / totalCalls) * 100 : 0,
      byEndpoint: byEndpoint
        .map((e) => ({
          endpoint: e.endpoint,
          method: e.method,
          count: e._count.id,
          avgResponseTime: Math.round(e._avg.responseTime || 0),
        }))
        .sort((a, b) => b.count - a.count),
      topUsers: byUser.map((u) => ({
        userId: u.userId,
        user: u.userId ? userMap.get(u.userId) || null : null,
        count: u._count.id,
      })),
    };
  },
};
