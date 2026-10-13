-- De una URL SMTP no se guarda ningún carácter para enseñarla enmascarada (lleva la contraseña de un buzón).
UPDATE "mail_config" SET "secret_last4" = '' WHERE "provider" = 'smtp' AND "secret_last4" IS NOT NULL;
