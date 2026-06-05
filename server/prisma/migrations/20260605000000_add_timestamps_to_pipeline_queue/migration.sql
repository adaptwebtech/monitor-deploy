-- AlterTable
ALTER TABLE "pipeline_queue" ADD COLUMN "startedAt" TIMESTAMP(3),
ADD COLUMN "finalizedAt" TIMESTAMP(3);
