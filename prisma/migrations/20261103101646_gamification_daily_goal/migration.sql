-- CreateEnum
CREATE TYPE "StudyIntensity" AS ENUM ('LIGHT', 'NORMAL', 'INTENSE');

-- AlterTable
ALTER TABLE "mistake_review_items" ADD COLUMN     "correctStreak" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "study_path_progress" ADD COLUMN     "unlockedModules" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "currentStreak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "hasSubscription" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastStreakDate" DATE,
ADD COLUMN     "longestStreak" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "studyIntensity" "StudyIntensity" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'Asia/Almaty',
ADD COLUMN     "xp" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "daily_progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "lessonsCompleted" INTEGER NOT NULL DEFAULT 0,
    "reviewAnswered" INTEGER NOT NULL DEFAULT 0,
    "reviewSessions" INTEGER NOT NULL DEFAULT 0,
    "lessonTarget" INTEGER NOT NULL DEFAULT 1,
    "reviewTarget" INTEGER NOT NULL DEFAULT 10,
    "minimumMet" BOOLEAN NOT NULL DEFAULT false,
    "goalMet" BOOLEAN NOT NULL DEFAULT false,
    "xpEarned" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "daily_progress_userId_date_key" ON "daily_progress"("userId", "date");

-- CreateIndex
CREATE INDEX "answer_logs_userId_createdAt_idx" ON "answer_logs"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "daily_progress" ADD CONSTRAINT "daily_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
