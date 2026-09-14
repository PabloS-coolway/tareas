-- CreateEnum
CREATE TYPE "SprintStatus" AS ENUM ('PLANNED', 'ACTIVE', 'CLOSED');

-- AlterTable
ALTER TABLE "task" ADD COLUMN     "sprint_id" INTEGER;

-- CreateTable
CREATE TABLE "sprint" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "goal" TEXT NOT NULL DEFAULT '',
    "start_date" DATE,
    "end_date" DATE,
    "status" "SprintStatus" NOT NULL DEFAULT 'PLANNED',
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sprint_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_sprint_id_idx" ON "task"("sprint_id");

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_sprint_id_fkey" FOREIGN KEY ("sprint_id") REFERENCES "sprint"("id") ON DELETE SET NULL ON UPDATE CASCADE;
