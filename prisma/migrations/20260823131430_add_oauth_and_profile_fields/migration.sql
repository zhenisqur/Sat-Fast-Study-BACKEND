/*
  Warnings:

  - You are about to drop the `user_domain_progress` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[authProvider,providerId]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "AuthProvider" AS ENUM ('LOCAL', 'GOOGLE', 'APPLE');

-- DropForeignKey
ALTER TABLE "user_domain_progress" DROP CONSTRAINT "user_domain_progress_userId_fkey";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "age" INTEGER,
ADD COLUMN     "authProvider" "AuthProvider" NOT NULL DEFAULT 'LOCAL',
ADD COLUMN     "hasTakenSat" BOOLEAN,
ADD COLUMN     "previousScore" INTEGER,
ADD COLUMN     "providerId" TEXT,
ALTER COLUMN "passwordHash" DROP NOT NULL;

-- DropTable
DROP TABLE "user_domain_progress";

-- CreateTable
CREATE TABLE "study_path_progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currentSequenceLevel" INTEGER NOT NULL DEFAULT 1,
    "mathTabDone" BOOLEAN NOT NULL DEFAULT false,
    "grammarTabDone" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "study_path_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "study_path_progress_userId_key" ON "study_path_progress"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "users_authProvider_providerId_key" ON "users"("authProvider", "providerId");

-- AddForeignKey
ALTER TABLE "study_path_progress" ADD CONSTRAINT "study_path_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
