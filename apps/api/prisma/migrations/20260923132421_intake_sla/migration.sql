-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'SLA';

-- AlterTable
ALTER TABLE "project" ADD COLUMN     "intake_active" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "intake_owner_id" INTEGER,
ADD COLUMN     "intake_sucursales" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "intake_token" TEXT,
ADD COLUMN     "sla_hours" JSONB,
ADD COLUMN     "sla_notify_ids" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- AlterTable
ALTER TABLE "task" ADD COLUMN     "sla_notified_at" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "project_intake_token_key" ON "project"("intake_token");

