-- CreateEnum
CREATE TYPE "StatusCategory" AS ENUM ('TODO', 'DOING', 'DONE');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('EPIC', 'TASK', 'BUG', 'INCIDENT');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('URGENT', 'HIGH', 'NORMAL', 'LOW');

-- CreateTable
CREATE TABLE "role" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "features" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "system" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_user" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'miembro',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "clickup_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_token" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "last_used_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL DEFAULT '#6d28d9',
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "next_number" INTEGER NOT NULL DEFAULT 1,
    "clickup_list_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_status" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6b7280',
    "order" INTEGER NOT NULL DEFAULT 0,
    "category" "StatusCategory" NOT NULL DEFAULT 'TODO',

    CONSTRAINT "project_status_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task" (
    "id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "type" "TaskType" NOT NULL DEFAULT 'TASK',
    "status_id" INTEGER NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'NORMAL',
    "assignee_id" INTEGER,
    "reporter_id" INTEGER NOT NULL,
    "parent_id" INTEGER,
    "due_date" DATE,
    "start_date" DATE,
    "tags" TEXT[],
    "order" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "closed_at" TIMESTAMP(3),
    "clickup_id" TEXT,
    "clickup_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_comment" (
    "id" SERIAL NOT NULL,
    "task_id" INTEGER NOT NULL,
    "author_id" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "clickup_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachment" (
    "id" SERIAL NOT NULL,
    "task_id" INTEGER NOT NULL,
    "uploader_id" INTEGER NOT NULL,
    "filename" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storage_key" TEXT NOT NULL,
    "clickup_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_activity" (
    "id" SERIAL NOT NULL,
    "task_id" INTEGER NOT NULL,
    "actor_id" INTEGER,
    "action" TEXT NOT NULL,
    "field" TEXT,
    "before" TEXT,
    "after" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_activity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "role_key_key" ON "role"("key");

-- CreateIndex
CREATE UNIQUE INDEX "app_user_email_key" ON "app_user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "app_user_clickup_id_key" ON "app_user"("clickup_id");

-- CreateIndex
CREATE UNIQUE INDEX "api_token_token_hash_key" ON "api_token"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "project_key_key" ON "project"("key");

-- CreateIndex
CREATE UNIQUE INDEX "project_clickup_list_id_key" ON "project"("clickup_list_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_status_project_id_key_key" ON "project_status"("project_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "task_clickup_id_key" ON "task"("clickup_id");

-- CreateIndex
CREATE INDEX "task_project_id_status_id_order_idx" ON "task"("project_id", "status_id", "order");

-- CreateIndex
CREATE INDEX "task_assignee_id_idx" ON "task"("assignee_id");

-- CreateIndex
CREATE INDEX "task_parent_id_idx" ON "task"("parent_id");

-- CreateIndex
CREATE UNIQUE INDEX "task_project_id_number_key" ON "task"("project_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "task_comment_clickup_id_key" ON "task_comment"("clickup_id");

-- CreateIndex
CREATE INDEX "task_comment_task_id_created_at_idx" ON "task_comment"("task_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "attachment_storage_key_key" ON "attachment"("storage_key");

-- CreateIndex
CREATE INDEX "attachment_task_id_idx" ON "attachment"("task_id");

-- CreateIndex
CREATE INDEX "task_activity_task_id_created_at_idx" ON "task_activity"("task_id", "created_at");

-- AddForeignKey
ALTER TABLE "app_user" ADD CONSTRAINT "app_user_role_fkey" FOREIGN KEY ("role") REFERENCES "role"("key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "api_token" ADD CONSTRAINT "api_token_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_status" ADD CONSTRAINT "project_status_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "project_status"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comment" ADD CONSTRAINT "task_comment_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_comment" ADD CONSTRAINT "task_comment_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_uploader_id_fkey" FOREIGN KEY ("uploader_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_activity" ADD CONSTRAINT "task_activity_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_activity" ADD CONSTRAINT "task_activity_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
