-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'FOLLOW';

-- CreateTable
CREATE TABLE "task_follower" (
    "task_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_follower_pkey" PRIMARY KEY ("task_id","user_id")
);

-- CreateIndex
CREATE INDEX "task_follower_user_id_idx" ON "task_follower"("user_id");

-- AddForeignKey
ALTER TABLE "task_follower" ADD CONSTRAINT "task_follower_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_follower" ADD CONSTRAINT "task_follower_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
