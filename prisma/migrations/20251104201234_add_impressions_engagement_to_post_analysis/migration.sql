-- AlterTable
ALTER TABLE "post_analyses" ADD COLUMN     "engagement" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "impressions" INTEGER NOT NULL DEFAULT 0;
