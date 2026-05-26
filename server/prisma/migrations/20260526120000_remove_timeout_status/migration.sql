-- Migrate existing Timeout records to Failed FIRST (before enum DDL)
UPDATE "pipeline_queue" SET "status" = 'Failed' WHERE "status" = 'Timeout';

-- Replace enum without Timeout
CREATE TYPE "PipelineStatus_new" AS ENUM ('Queued', 'Running', 'Completed', 'Failed');

ALTER TABLE "pipeline_queue"
  ALTER COLUMN "status" TYPE "PipelineStatus_new"
  USING "status"::text::"PipelineStatus_new";

DROP TYPE "PipelineStatus";
ALTER TYPE "PipelineStatus_new" RENAME TO "PipelineStatus";
