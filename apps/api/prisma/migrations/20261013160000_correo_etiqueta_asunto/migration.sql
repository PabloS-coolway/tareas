-- Etiqueta opcional delante del asunto de los correos (TAREAS-27).
ALTER TABLE "mail_config" ADD COLUMN "subject_prefix" TEXT NOT NULL DEFAULT '';
