-- Correo saliente (TAREAS-27): configuración del proveedor, cola/registro y marca en los avisos ya encolados.

-- AlterTable
ALTER TABLE "notification" ADD COLUMN "email_queued_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "mail_config" (
    "owner" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "secret_enc" TEXT,
    "secret_last4" TEXT,
    "from_name" TEXT NOT NULL,
    "from_email" TEXT NOT NULL,
    "reply_to" TEXT,
    "brand_name" TEXT NOT NULL,
    "app_url" TEXT NOT NULL,
    "footer" TEXT NOT NULL DEFAULT '',
    "notifications_enabled" BOOLEAN NOT NULL DEFAULT false,
    "notifications_since" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,

    CONSTRAINT "mail_config_pkey" PRIMARY KEY ("owner")
);

-- CreateTable
CREATE TABLE "mail_message" (
    "id" SERIAL NOT NULL,
    "owner" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "html" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pendiente',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMP(3),
    "last_error" TEXT,
    "provider_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMP(3),

    CONSTRAINT "mail_message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "notification_email_queued_at_created_at_idx" ON "notification"("email_queued_at", "created_at");

-- CreateIndex
CREATE INDEX "mail_message_status_next_attempt_at_idx" ON "mail_message"("status", "next_attempt_at");

-- CreateIndex
CREATE INDEX "mail_message_owner_created_at_idx" ON "mail_message"("owner", "created_at");

-- CreateIndex
CREATE INDEX "mail_message_created_at_idx" ON "mail_message"("created_at");
