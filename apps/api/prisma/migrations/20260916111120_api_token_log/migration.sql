-- CreateTable
CREATE TABLE "api_token_log" (
    "id" SERIAL NOT NULL,
    "token_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "detail" TEXT,
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "ms" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_token_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "api_token_log_token_id_created_at_idx" ON "api_token_log"("token_id", "created_at");

-- CreateIndex
CREATE INDEX "api_token_log_created_at_idx" ON "api_token_log"("created_at");

-- AddForeignKey
ALTER TABLE "api_token_log" ADD CONSTRAINT "api_token_log_token_id_fkey" FOREIGN KEY ("token_id") REFERENCES "api_token"("id") ON DELETE CASCADE ON UPDATE CASCADE;
