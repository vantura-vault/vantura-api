-- CreateTable
CREATE TABLE "blueprints" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "topicTags" TEXT[],
    "useDataChamber" BOOLEAN NOT NULL DEFAULT true,
    "useYourTopPosts" BOOLEAN NOT NULL DEFAULT true,
    "useCompetitorPosts" BOOLEAN NOT NULL DEFAULT true,
    "visualDescription" TEXT NOT NULL,
    "references" TEXT,
    "hook" TEXT NOT NULL,
    "context" TEXT NOT NULL,
    "hashtags" JSONB NOT NULL,
    "mentions" JSONB,
    "bestTimeToPost" TEXT,
    "recommendedFormat" TEXT,
    "postingInsight" TEXT,
    "dataSources" TEXT[],
    "timeWindow" TEXT,
    "confidence" DOUBLE PRECISION,
    "yourPerformanceScore" DOUBLE PRECISION,
    "competitorScore" DOUBLE PRECISION,
    "vanturaScore" DOUBLE PRECISION,
    "estimatedReachMin" INTEGER,
    "estimatedReachMax" INTEGER,
    "estimatedEngagementMin" DOUBLE PRECISION,
    "estimatedEngagementMax" DOUBLE PRECISION,
    "optimizationNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blueprints_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "blueprints_companyId_idx" ON "blueprints"("companyId");

-- CreateIndex
CREATE INDEX "blueprints_platform_idx" ON "blueprints"("platform");

-- CreateIndex
CREATE INDEX "blueprints_createdAt_idx" ON "blueprints"("createdAt");

-- AddForeignKey
ALTER TABLE "blueprints" ADD CONSTRAINT "blueprints_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
