import { prisma } from '../config/database';

export interface CreateSnapshotDTO {
    companyPlatformId: string;
    followerCount: number;
    postCount: number;
}

export const snapshotService = {
    // create new snapshot for a platform

    async createSnapshot(_userId: string, data: CreateSnapshotDTO) {
        const companyPlatform = await prisma.companyPlatform.findUnique({
            where: {id: data.companyPlatformId},
            include:{
                company:{
                    include:{
                        users: true
                    }
                },
                platform: true
            }
        });

        if (!companyPlatform) {
            throw new Error('Platform not found');
        }

        const hasAccess = companyPlatform.company.users.some(
            (user) => user.id === user.companyId
        );

        if (!hasAccess){
            throw new Error('This user does not have access. Access denied.');
        }

        const snapshot = await prisma.platformSnapshot.create({
            data: {
                companyId: companyPlatform.companyId,
                platformId: companyPlatform.id,
                followerCount: data.followerCount,
                postCount: data.postCount
            },
            include:{
                companyPlatform:{
                    include:{
                        platform: true
                    }
                }
            }
        });

        return snapshot;
    },

    // get snapshots for a specific platform with optional date filtering
    async getSnapshotsByPlatform(
        userId: string,
        companyPlatformId: string,
        options?: {
            startDate?: Date;
            endDate?: Date;
            limit?: number;
        }
    ) {
        // verify access
        const companyPlatform = await prisma.companyPlatform.findUnique({
            where: { id: companyPlatformId },
            include: {
                company:{
                    include: { users: true}
                }
            }
        });

        if (!companyPlatform){
            throw new Error('Platform not found.');
        }

        const hasAccess = companyPlatform.company.users.some(
            (user) => user.id === userId
        );

        if (!hasAccess){
            throw new Error('Access denied');
        }

        const where: any = {
            platformId: companyPlatformId
        };

        if (options?.startDate || options?.endDate) {
            where.capturedAt = {};
            if (options.startDate) {
                where.capturedAt.gte = options.startDate;
            }
            if (options.endDate) {
                where.capturedAt.lte = options.endDate;
            }
            }

            // Fetch snapshots
            const snapshots = await prisma.platformSnapshot.findMany({
            where,
            orderBy: { capturedAt: 'desc' },
            take: options?.limit || 100,
            include: {
                companyPlatform: {
                include: {
                    platform: true
                }
                }
            }
        });

        return snapshots;
    },

    /**
   * Get latest snapshot for each platform in a company
   */
    async getLatestSnapshotsByCompany(userId: string, companyId: string) {
        // Verify user has access
        const user = await prisma.user.findUnique({
        where: { id: userId }
        });

        if (user?.companyId !== companyId) {
        throw new Error('Access denied');
        }

        // Get all company platforms
        const companyPlatforms = await prisma.companyPlatform.findMany({
        where: { companyId },
        include: {
            platform: true
        }
        });

        // Get latest snapshot for each platform
        const latestSnapshots = await Promise.all(
        companyPlatforms.map(async (cp) => {
            const latest = await prisma.platformSnapshot.findFirst({
            where: { platformId: cp.id },
            orderBy: { capturedAt: 'desc' }
            });

            const previous = await prisma.platformSnapshot.findFirst({
            where: {
                platformId: cp.id,
                capturedAt: { lt: latest?.capturedAt || new Date() }
            },
            orderBy: { capturedAt: 'desc' }
            });

            let growth = null;
            if (latest && previous) {
            const followerGrowth = latest.followerCount - previous.followerCount;
            const followerGrowthPercent =
                previous.followerCount > 0
                ? (followerGrowth / previous.followerCount) * 100
                : 0;

            const postGrowth = latest.postCount - previous.postCount;

            growth = {
                followers: {
                absolute: followerGrowth,
                percentage: followerGrowthPercent
                },
                posts: {
                absolute: postGrowth
                },
                timeBetween: latest.capturedAt.getTime() - previous.capturedAt.getTime()
            };
            }

            return {
            companyPlatform: cp,
            latestSnapshot: latest,
            previousSnapshot: previous,
            growth
            };
        })
        );

        return latestSnapshots;
    },

    /**
     * Get growth analytics for a platform over time
     */
    async getGrowthAnalytics(
        userId: string,
        companyPlatformId: string,
        options?: {
        startDate?: Date;
        endDate?: Date;
        }
    ) {
        const snapshots = await this.getSnapshotsByPlatform(
        userId,
        companyPlatformId,
        options
        );

        if (snapshots.length < 2) {
        return {
            snapshots,
            analytics: {
            totalFollowerGrowth: 0,
            totalPostGrowth: 0,
            averageFollowerGrowthPerDay: 0,
            growthRate: 0
            }
        };
        }

        // Sort oldest to newest for calculations
        const sortedSnapshots = [...snapshots].reverse();

        const firstSnapshot = sortedSnapshots[0];
        const lastSnapshot = sortedSnapshots[sortedSnapshots.length - 1];

        const totalFollowerGrowth =
        lastSnapshot.followerCount - firstSnapshot.followerCount;
        const totalPostGrowth = lastSnapshot.postCount - firstSnapshot.postCount;

        // Calculate time difference in days
        const timeDiff =
        lastSnapshot.capturedAt.getTime() - firstSnapshot.capturedAt.getTime();
        const daysDiff = timeDiff / (1000 * 60 * 60 * 24);

        const averageFollowerGrowthPerDay =
        daysDiff > 0 ? totalFollowerGrowth / daysDiff : 0;

        const growthRate =
        firstSnapshot.followerCount > 0
            ? (totalFollowerGrowth / firstSnapshot.followerCount) * 100
            : 0;

        // Calculate daily growth points
        const dailyGrowth = sortedSnapshots.slice(1).map((snapshot, index) => {
        const previous = sortedSnapshots[index];
        const followerChange = snapshot.followerCount - previous.followerCount;
        const postChange = snapshot.postCount - previous.postCount;

        return {
            date: snapshot.capturedAt,
            followerCount: snapshot.followerCount,
            postCount: snapshot.postCount,
            followerChange,
            postChange
        };
        });

        return {
        snapshots,
        analytics: {
            totalFollowerGrowth,
            totalPostGrowth,
            averageFollowerGrowthPerDay,
            growthRate,
            daysDiff,
            startDate: firstSnapshot.capturedAt,
            endDate: lastSnapshot.capturedAt,
            startFollowerCount: firstSnapshot.followerCount,
            endFollowerCount: lastSnapshot.followerCount
        },
        dailyGrowth
        };
    }  
};

