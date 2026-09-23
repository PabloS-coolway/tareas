-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'RULE';

-- CreateTable
CREATE TABLE "automation_rule" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "trigger" TEXT NOT NULL,
    "conditions" JSONB NOT NULL DEFAULT '{}',
    "actions" JSONB NOT NULL DEFAULT '{}',
    "created_by_id" INTEGER,
    "runs" INTEGER NOT NULL DEFAULT 0,
    "last_run_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_rule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "automation_rule_project_id_active_idx" ON "automation_rule"("project_id", "active");

-- AddForeignKey
ALTER TABLE "automation_rule" ADD CONSTRAINT "automation_rule_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_rule" ADD CONSTRAINT "automation_rule_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
