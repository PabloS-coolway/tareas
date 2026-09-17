-- AlterTable
ALTER TABLE "project" ADD COLUMN     "team_id" INTEGER;

-- AlterTable
ALTER TABLE "sprint" ADD COLUMN     "team_id" INTEGER;

-- CreateTable
CREATE TABLE "team" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#4338ca',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_member" (
    "team_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_member_pkey" PRIMARY KEY ("team_id","user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "team_key_key" ON "team"("key");

-- CreateIndex
CREATE INDEX "team_member_user_id_idx" ON "team_member"("user_id");

-- CreateIndex
CREATE INDEX "project_team_id_idx" ON "project"("team_id");

-- CreateIndex
CREATE INDEX "sprint_team_id_idx" ON "sprint"("team_id");

-- AddForeignKey
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_member" ADD CONSTRAINT "team_member_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sprint" ADD CONSTRAINT "sprint_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project" ADD CONSTRAINT "project_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Datos de arranque: todo lo que existe pasa al equipo "Tecnología" (proyectos, personas y sprints
-- transversales), así nada cambia para nadie hasta que se cree otro equipo (p. ej. Marketing).
INSERT INTO "team" ("key", "name", "color", "updated_at") VALUES ('TECH', 'Tecnología', '#4338ca', now());
UPDATE "project" SET "team_id" = (SELECT "id" FROM "team" WHERE "key" = 'TECH') WHERE "team_id" IS NULL;
INSERT INTO "team_member" ("team_id", "user_id") SELECT t."id", u."id" FROM "team" t, "app_user" u WHERE t."key" = 'TECH';
UPDATE "sprint" SET "team_id" = (SELECT "id" FROM "team" WHERE "key" = 'TECH') WHERE "project_id" IS NULL AND "team_id" IS NULL;
