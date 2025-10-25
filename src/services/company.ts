import { prisma } from '../config/database.js';

/*
interface CreateCompanyDTO

export const companyService
    - create company
    - getCompanybyId
    - get user company
    - add platform
*/

export interface CreateCompanyDTO{
    name: string;
    industry?: string;
    description?: string;
    values?: string;
    platforms:{
        platformName: string;
        profileUrl: string;
    } [];
}

export const companyService = {
    async createCompany(userId: string, data: CreateCompanyDTO){
        if (!data.platforms || data.platforms.length === 0){
            throw new Error('At least one social platform is required');
        }

        const existingMembership = await prisma.user.findUnique({
            where: { id: userId },
            select: { companyId: true }
        });

        if (existingMembership?.companyId){
            throw new Error('User already belongs to a company');
        }

        const platformIds = await Promise.all(
            data.platforms.map(async(p) => {
                let platform = await prisma.platform.findUnique({
                    where: { name: p.platformName }
                });

                if (!platform){
                    platform = await prisma.platform.create({
                        data: {name : p.platformName }
                    });
                }

                return {
                    platformId: platform.id,
                    profileUrl: p.profileUrl
                };
            })
        );

        const company = await prisma.$transaction(async (tx) => {
            const newCompany = await tx.company.create({
                data:{
                    name: data.name,
                    industry: data.industry,
                    description: data.description,
                    values: data.values
                }
            });

            await tx.companyPlatform.createMany({
                data:platformIds.map((p) => ({
                    companyId: newCompany.id,
                    platformId: p.platformId,
                    profileUrl: p.profileUrl
                }))
            });

            await tx.user.update({
                where: { id: userId },
                data: {
                companyId: newCompany.id,
                role: 'owner'
                }
            });

            return newCompany;
        });

        const completeCompany = await prisma.company.findUnique({
            where: { id: company.id },
            include: {
                platforms: {
                include: {
                    platform: true
                }
                },
                users: {
                where: { id: userId }
                }
            }
            });

            return completeCompany;
    },

    async getCompanyById(companyId: string, userId: string) {
        const company = await prisma.company.findUnique({
        where: { id: companyId },
        include: {
            platforms: {
            include: {
                platform: true
            }
            },
            users: true
        }
        });

        if (!company) {
        throw new Error('Company not found');
        }

        // Check if user has access to this company
        const hasAccess = company.users.some((user) => user.id === userId);
        if (!hasAccess) {
        throw new Error('Access denied');
        }

        return company;
    },

    async getUserCompany(userId: string) {
        const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
            company: {
            include: {
                platforms: {
                include: {
                    platform: true
                }
                },
                users: true
            }
            }
        }
        });

        if (!user?.company) {
        return null;
        }

        return user.company;
    },

    async addPlatform(
        companyId: string,
        userId: string,
        platformData: { platformName: string; profileUrl: string }
    ) {
        // Verify user is owner
        const user = await prisma.user.findUnique({
        where: { id: userId }
        });

        if (user?.companyId !== companyId) {
        throw new Error('Access denied');
        }

        if (user.role !== 'owner') {
        throw new Error('Only company owners can add platforms');
        }

        // Get or create platform
        let platform = await prisma.platform.findUnique({
        where: { name: platformData.platformName }
        });

        if (!platform) {
        platform = await prisma.platform.create({
            data: { name: platformData.platformName }
        });
        }

        // Check if platform already linked
        const existing = await prisma.companyPlatform.findUnique({
        where: {
            companyId_platformId: {
            companyId,
            platformId: platform.id
            }
        }
        });

        if (existing) {
        throw new Error('Platform already connected to this company');
        }

        // Create company-platform link
        const companyPlatform = await prisma.companyPlatform.create({
        data: {
            companyId,
            platformId: platform.id,
            profileUrl: platformData.profileUrl
        },
        include: {
            platform: true
        }
        });

        return companyPlatform;
    }
};
