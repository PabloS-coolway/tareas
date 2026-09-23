-- CreateTable
CREATE TABLE "task_git_ref" (
    "id" SERIAL NOT NULL,
    "task_id" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_git_ref_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "task_git_ref_task_id_kind_ref_key" ON "task_git_ref"("task_id", "kind", "ref");

-- AddForeignKey
ALTER TABLE "task_git_ref" ADD CONSTRAINT "task_git_ref_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

