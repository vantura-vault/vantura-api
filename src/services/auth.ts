import { prisma } from '../config/database.js';
import { RegisterDTO, LoginDTO, AuthResponseDTO } from '../types/index.js';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import { prewarmCacheAsync } from './cacheWarmer.js';
import { config } from '../config/env.js';

const SALT_ROUNDS = 12;

/**
 * Normalize LinkedIn URL for consistent comparison
 * Handles variations like trailing slashes, www vs non-www, etc.
 */
function normalizeLinkedInUrl(url: string): string {
  let normalized = url.trim().toLowerCase();

  // Remove trailing slash
  normalized = normalized.replace(/\/+$/, '');

  // Ensure https://
  if (!normalized.startsWith('http')) {
    normalized = 'https://' + normalized;
  }

  // Remove www. if present
  normalized = normalized.replace('://www.', '://');

  return normalized;
}

/**
 * Validate LinkedIn URL format
 */
function isValidLinkedInUrl(url: string): boolean {
  const normalized = normalizeLinkedInUrl(url);
  // Match linkedin.com/company/xxx or linkedin.com/in/xxx
  const linkedInPattern = /^https:\/\/linkedin\.com\/(company|in)\/[\w-]+\/?$/;
  return linkedInPattern.test(normalized);
}

export const authService = {
  /**
   * Register a new user
   * - If LinkedIn URL exists, join existing company as "member"
   * - If LinkedIn URL is new, create company and user as "owner"
   */
  async register(data: RegisterDTO): Promise<AuthResponseDTO> {
    // Validate email doesn't already exist
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email }
    });

    if (existingUser) {
      throw new Error('An account with this email already exists. Please login or contact support.');
    }

    // Validate LinkedIn URL format
    if (!isValidLinkedInUrl(data.linkedInUrl)) {
      throw new Error('Invalid LinkedIn URL. Please provide a valid LinkedIn company or profile URL (e.g., linkedin.com/company/your-company or linkedin.com/in/your-profile)');
    }

    // Normalize the LinkedIn URL for consistent storage/lookup
    const normalizedLinkedInUrl = normalizeLinkedInUrl(data.linkedInUrl);

    // Hash the password
    const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);

    // Check if a company with this LinkedIn URL already exists
    const existingCompany = await prisma.company.findUnique({
      where: { linkedInUrl: normalizedLinkedInUrl }
    });

    let company;
    let isNewCompany = false;
    let userRole: string;

    if (existingCompany) {
      // Company exists - user joins as member
      company = existingCompany;
      userRole = 'member';
      console.log(`[Auth] User joining existing company: ${company.name} (${company.id})`);
    } else {
      // Company doesn't exist - create new company, user becomes owner
      company = await prisma.company.create({
        data: {
          name: data.companyName,
          industry: data.companyIndustry || null,
          linkedInUrl: normalizedLinkedInUrl,
          linkedInType: data.linkedInType,
        }
      });
      isNewCompany = true;
      userRole = 'owner';
      console.log(`[Auth] Created new company: ${company.name} (${company.id})`);
    }

    // Create the user
    const user = await prisma.user.create({
      data: {
        email: data.email,
        name: data.name,
        passwordHash,
        companyId: company.id,
        role: userRole,
      }
    });

    console.log(`[Auth] Created user: ${user.email} with role: ${userRole}`);

    // Generate auth token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + (365 * 24 * 3600 * 1000)); // 1 year

    await prisma.authToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt
      }
    });

    // Pre-warm cache for the company (async - doesn't block response)
    if (company.id) {
      prewarmCacheAsync(company.id);
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        companyId: user.companyId,
        role: user.role,
      },
      token,
      expiresAt: expiresAt.toISOString(),
      isNewCompany,
    };
  },

  /**
   * Login an existing user
   */
  async login(data: LoginDTO): Promise<AuthResponseDTO> {
    const user = await prisma.user.findUnique({
      where: { email: data.email }
    });

    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Verify password if hash exists
    if (user.passwordHash) {
      const isValidPassword = await bcrypt.compare(data.password, user.passwordHash);
      if (!isValidPassword) {
        throw new Error('Invalid email or password');
      }
    } else {
      // Legacy user without password - for now, allow login
      // In production, you'd want to force a password reset
      console.warn(`[Auth] User ${user.email} has no password hash - allowing legacy login`);
    }

    // Auto-promote to super_admin if email is in SUPER_ADMIN_EMAILS
    if (
      config.superAdminEmails.includes(user.email.toLowerCase()) &&
      user.role !== 'super_admin'
    ) {
      await prisma.user.update({
        where: { id: user.id },
        data: { role: 'super_admin' },
      });
      user.role = 'super_admin';
      console.log(`[Auth] Auto-promoted ${user.email} to super_admin`);
    }

    // Generate auth token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000); // 7 days

    await prisma.authToken.create({
      data: {
        userId: user.id,
        token,
        expiresAt
      }
    });

    // Pre-warm cache for the company (async - doesn't block response)
    if (user.companyId) {
      prewarmCacheAsync(user.companyId);
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        companyId: user.companyId,
        role: user.role,
      },
      token,
      expiresAt: expiresAt.toISOString(),
      isNewCompany: false,
    };
  },

  /**
   * Verify an auth token
   */
  async verifyToken(token: string) {
    const authToken = await prisma.authToken.findUnique({
      where: { token },
      include: { user: true }
    });

    if (!authToken) {
      throw new Error('Invalid token');
    }

    if (authToken.expiresAt < new Date()) {
      throw new Error('Token expired');
    }

    return authToken.user;
  },

  /**
   * Logout (delete auth token)
   */
  async logout(token: string): Promise<void> {
    await prisma.authToken.delete({
      where: { token }
    });
  },

  /**
   * Check if a LinkedIn URL is already registered
   */
  async checkLinkedInUrl(linkedInUrl: string): Promise<{ exists: boolean; companyName?: string }> {
    const normalized = normalizeLinkedInUrl(linkedInUrl);
    const company = await prisma.company.findUnique({
      where: { linkedInUrl: normalized },
      select: { name: true }
    });

    return {
      exists: !!company,
      companyName: company?.name
    };
  },

  /**
   * Get token expiry date (for caching)
   */
  async getTokenExpiry(token: string): Promise<{ expiresAt: Date } | null> {
    const authToken = await prisma.authToken.findUnique({
      where: { token },
      select: { expiresAt: true }
    });

    return authToken;
  }
};
