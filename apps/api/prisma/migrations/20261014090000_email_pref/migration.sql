-- Preferencias de correo por persona (TAREAS-28). Sin fila = valores por defecto.

-- CreateTable
CREATE TABLE "email_pref" (
    "user_id" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "types" TEXT[],
    "project_mode" TEXT NOT NULL DEFAULT 'todos',
    "project_ids" INTEGER[],
    "min_priority" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'inmediato',
    "last_digest_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_pref_pkey" PRIMARY KEY ("user_id")
);

-- AddForeignKey
ALTER TABLE "email_pref" ADD CONSTRAINT "email_pref_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
