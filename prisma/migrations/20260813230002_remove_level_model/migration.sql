/*
  Warnings:

  - You are about to drop the column `choices` on the `questions` table. All the data in the column will be lost.
  - You are about to drop the column `correctAnswer` on the `questions` table. All the data in the column will be lost.
  - You are about to drop the column `imageUrl` on the `questions` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[section,level,orderInLevel]` on the table `questions` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `choiceA` to the `questions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `choiceB` to the `questions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `choiceC` to the `questions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `choiceD` to the `questions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `correctChoice` to the `questions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `level` to the `questions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `orderInLevel` to the `questions` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "questions_section_difficulty_idx";

-- AlterTable
ALTER TABLE "questions" DROP COLUMN "choices",
DROP COLUMN "correctAnswer",
DROP COLUMN "imageUrl",
ADD COLUMN     "choiceA" TEXT NOT NULL,
ADD COLUMN     "choiceB" TEXT NOT NULL,
ADD COLUMN     "choiceC" TEXT NOT NULL,
ADD COLUMN     "choiceD" TEXT NOT NULL,
ADD COLUMN     "correctChoice" TEXT NOT NULL,
ADD COLUMN     "level" INTEGER NOT NULL,
ADD COLUMN     "orderInLevel" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "user_level_progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "section" "SatSection" NOT NULL,
    "currentLevel" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_level_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_quotas" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "mathAnswered" INTEGER NOT NULL DEFAULT 0,
    "rwAnswered" INTEGER NOT NULL DEFAULT 0,
    "mathTarget" INTEGER NOT NULL DEFAULT 15,
    "rwTarget" INTEGER NOT NULL DEFAULT 15,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "daily_quotas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_level_progress_userId_section_key" ON "user_level_progress"("userId", "section");

-- CreateIndex
CREATE UNIQUE INDEX "daily_quotas_userId_date_key" ON "daily_quotas"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "questions_section_level_orderInLevel_key" ON "questions"("section", "level", "orderInLevel");

-- AddForeignKey
ALTER TABLE "user_level_progress" ADD CONSTRAINT "user_level_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_quotas" ADD CONSTRAINT "daily_quotas_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
