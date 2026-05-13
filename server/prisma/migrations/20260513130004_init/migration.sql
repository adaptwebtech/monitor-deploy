-- CreateEnum
CREATE TYPE "Environment" AS ENUM ('development', 'staging', 'production');

-- CreateEnum
CREATE TYPE "PipelineStatus" AS ENUM ('Queued', 'Running', 'Completed', 'Failed');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "profilePictureUrl" TEXT,
    "githubId" TEXT,
    "password" TEXT NOT NULL,
    "salt" TEXT NOT NULL,
    "root" BOOLEAN NOT NULL DEFAULT false,
    "refreshToken" TEXT,
    "del" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_queue" (
    "id" TEXT NOT NULL,
    "id_user" TEXT,
    "event" TEXT NOT NULL,
    "app" TEXT NOT NULL,
    "environment" "Environment" NOT NULL,
    "commitSha" TEXT NOT NULL,
    "commitMessage" TEXT NOT NULL,
    "commitAuthor" TEXT NOT NULL,
    "commitAuthorAvatar" TEXT NOT NULL,
    "commitAuthorId" TEXT,
    "status" "PipelineStatus" NOT NULL DEFAULT 'Queued',
    "del" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pipeline_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_steps" (
    "id" TEXT NOT NULL,
    "id_pipeline_queue" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "workflowName" TEXT NOT NULL,
    "stepName" TEXT NOT NULL,
    "del" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pipeline_steps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_githubId_key" ON "users"("githubId");

-- CreateIndex
CREATE INDEX "pipeline_queue_commitSha_idx" ON "pipeline_queue"("commitSha");

-- CreateIndex
CREATE UNIQUE INDEX "pipeline_queue_commitSha_app_environment_key" ON "pipeline_queue"("commitSha", "app", "environment");

-- AddForeignKey
ALTER TABLE "pipeline_queue" ADD CONSTRAINT "pipeline_queue_id_user_fkey" FOREIGN KEY ("id_user") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_steps" ADD CONSTRAINT "pipeline_steps_id_pipeline_queue_fkey" FOREIGN KEY ("id_pipeline_queue") REFERENCES "pipeline_queue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
