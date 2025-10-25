// import { prisma } from '../db.js';

// export interface CompetitorCard {
//   id: string;
//   name: string;
//   industry?: string;
//   region?: string;
//   logoUrl?: string;
//   platforms: Array<{
//     platform: string;
//     handle: string;
//     profileUrl?: string;
//   }>;
//   totalFollowers: number;
//   avgEngagement: number;
//   createdAt: Date;
// }

// export interface AddCompetitorManualInput {
//   companyId: string;
//   competitor: {
//     name: string;
//     industry?: string;
//     region?: string;
//     logoUrl?: string;
//     accounts: Array<{
//       platform: string;
//       handle: string;
//       displayName?: string;
//       profileUrl?: string;
//       logoUrl?: string;
//     }>;
//   };
// }

// export interface AddCompetitorBrightDataInput {
//   companyId: string;
//   brightDataPayload: {
//     name: string;
//     industry?: string;
//     region?: string;
//     logoUrl?: string;
//     accounts: Array<{
//       platform: string;
//       handle: string;
//       displayName?: string;
//       profileUrl?: string;
//       followers?: number;
//       avgEngagement?: number;
//     }>;
//   };
// }

// /**
//  * Get all competitors for a company with aggregated metrics
//  */
// export async function getCompetitors(companyId: string): Promise<CompetitorCard[]> {
//   // Find all competitor relations
//   const relations = await prisma.companyRelation.findMany({
//     where: {
//       companyId,
//       type: 'COMPETITOR',
//     },
//     include: {
//       competitorCompany: {
//         include: {
//           accounts: true,
//           snapshots: {
//             orderBy: { fetchedAt: 'desc' },
//             take: 1, // Get latest snapshot per competitor
//           },
//         },
//       },
//     },
//   });

//   // Build competitor cards
//   const cards: CompetitorCard[] = relations
//     .filter(rel => rel.competitorCompany) // Filter out legacy relations without CompetitorCompany
//     .map(rel => {
//       const comp = rel.competitorCompany!;
//       const latestSnapshot = comp.snapshots[0];

//       // Calculate total followers and avg engagement from latest snapshot
//       const totalFollowers = latestSnapshot?.followers ?? 0;
//       const avgEngagement = latestSnapshot?.avgEngagement ?? 0;

//       return {
//         id: comp.id,
//         name: comp.name,
//         industry: comp.industry ?? undefined,
//         region: comp.region ?? undefined,
//         logoUrl: comp.logoUrl ?? undefined,
//         platforms: comp.accounts.map(acc => ({
//           platform: acc.platform,
//           handle: acc.handle,
//           profileUrl: acc.profileUrl ?? undefined,
//         })),
//         totalFollowers,
//         avgEngagement,
//         createdAt: comp.createdAt,
//       };
//     });

//   return cards;
// }

// /**
//  * Add a competitor manually via UI
//  */
// export async function addCompetitorManual(input: AddCompetitorManualInput) {
//   const { companyId, competitor } = input;

//   // Create competitor company
//   const competitorCompany = await prisma.competitorCompany.create({
//     data: {
//       name: competitor.name,
//       industry: competitor.industry,
//       region: competitor.region,
//       logoUrl: competitor.logoUrl,
//       accounts: {
//         create: competitor.accounts.map(acc => ({
//           platform: acc.platform,
//           handle: acc.handle,
//           displayName: acc.displayName,
//           profileUrl: acc.profileUrl,
//           logoUrl: acc.logoUrl,
//         })),
//       },
//     },
//   });

//   // Create company relation
//   await prisma.companyRelation.create({
//     data: {
//       companyId,
//       type: 'COMPETITOR',
//       competitorId: competitorCompany.id,
//     },
//   });

//   return { id: competitorCompany.id, name: competitorCompany.name };
// }

// /**
//  * Add competitor via BrightData webhook
//  * This is a stub for future integration
//  */
// export async function addCompetitorViaBrightData(input: AddCompetitorBrightDataInput) {
//   const { companyId, brightDataPayload } = input;

//   // Create competitor company
//   const competitorCompany = await prisma.competitorCompany.create({
//     data: {
//       name: brightDataPayload.name,
//       industry: brightDataPayload.industry,
//       region: brightDataPayload.region,
//       logoUrl: brightDataPayload.logoUrl,
//       accounts: {
//         create: brightDataPayload.accounts.map(acc => ({
//           platform: acc.platform,
//           handle: acc.handle,
//           displayName: acc.displayName,
//           profileUrl: acc.profileUrl,
//         })),
//       },
//     },
//   });

//   // Create initial snapshot if data is available
//   if (brightDataPayload.accounts.length > 0) {
//     const firstAccount = brightDataPayload.accounts[0];
//     if (firstAccount.followers !== undefined) {
//       await prisma.competitorSnapshot.create({
//         data: {
//           competitorId: competitorCompany.id,
//           platform: firstAccount.platform,
//           followers: firstAccount.followers,
//           avgEngagement: firstAccount.avgEngagement ?? 0,
//           postsCount: 0, // Not provided by BrightData yet
//         },
//       });
//     }
//   }

//   // Create company relation
//   await prisma.companyRelation.create({
//     data: {
//       companyId,
//       type: 'COMPETITOR',
//       competitorId: competitorCompany.id,
//     },
//   });

//   return { id: competitorCompany.id, name: competitorCompany.name };
// }

// /**
//  * Update competitor snapshot (for periodic data refreshes)
//  */
// export async function updateCompetitorSnapshot(
//   competitorId: string,
//   platform: string,
//   data: {
//     followers: number;
//     avgEngagement: number;
//     postsCount?: number;
//   }
// ): Promise<void> {
//   await prisma.competitorSnapshot.create({
//     data: {
//       competitorId,
//       platform,
//       followers: data.followers,
//       avgEngagement: data.avgEngagement,
//       postsCount: data.postsCount ?? 0,
//     },
//   });
// }

// /**
//  * Get single competitor details
//  */
// export async function getCompetitorDetails(competitorId: string): Promise<CompetitorCard | null> {
//   const comp = await prisma.competitorCompany.findUnique({
//     where: { id: competitorId },
//     include: {
//       accounts: true,
//       snapshots: {
//         orderBy: { fetchedAt: 'desc' },
//         take: 1,
//       },
//     },
//   });

//   if (!comp) {
//     return null;
//   }

//   const latestSnapshot = comp.snapshots[0];
//   const totalFollowers = latestSnapshot?.followers ?? 0;
//   const avgEngagement = latestSnapshot?.avgEngagement ?? 0;

//   return {
//     id: comp.id,
//     name: comp.name,
//     industry: comp.industry ?? undefined,
//     region: comp.region ?? undefined,
//     logoUrl: comp.logoUrl ?? undefined,
//     platforms: comp.accounts.map(acc => ({
//       platform: acc.platform,
//       handle: acc.handle,
//       profileUrl: acc.profileUrl ?? undefined,
//     })),
//     totalFollowers,
//     avgEngagement,
//     createdAt: comp.createdAt,
//   };
// }
