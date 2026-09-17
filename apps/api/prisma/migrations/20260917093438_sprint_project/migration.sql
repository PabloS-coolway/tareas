-- AlterTable
ALTER TABLE "sprint" ADD COLUMN     "project_id" INTEGER;

-- CreateIndex
CREATE INDEX "sprint_project_id_idx" ON "sprint"("project_id");

-- AddForeignKey
ALTER TABLE "sprint" ADD CONSTRAINT "sprint_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
