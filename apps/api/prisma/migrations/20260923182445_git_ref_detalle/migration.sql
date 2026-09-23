-- AlterTable
ALTER TABLE "task_git_ref" ADD COLUMN     "at" TIMESTAMP(3),
ADD COLUMN     "author" TEXT,
ADD COLUMN     "branch" TEXT,
ADD COLUMN     "number" INTEGER,
ADD COLUMN     "repo" TEXT NOT NULL DEFAULT '';


-- Las que ya existían: el repo sale de la referencia («owner/repo@sha», «owner/repo#12»).
UPDATE "task_git_ref" SET "repo" = regexp_replace("ref", '[@#:].*$', '') WHERE "repo" = '';
