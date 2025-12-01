-- CreateTable
CREATE TABLE "scrape_jobs" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "targetUrl" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "scrapeType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "postsScraped" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "scrape_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scrape_jobs_companyId_idx" ON "scrape_jobs"("companyId");

-- CreateIndex
CREATE INDEX "scrape_jobs_targetId_idx" ON "scrape_jobs"("targetId");

-- CreateIndex
CREATE INDEX "scrape_jobs_status_idx" ON "scrape_jobs"("status");

-- AddForeignKey
ALTER TABLE "scrape_jobs" ADD CONSTRAINT "scrape_jobs_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scrape_jobs" ADD CONSTRAINT "scrape_jobs_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
