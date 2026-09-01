-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "domain" TEXT,
ADD COLUMN     "domainLevel" INTEGER,
ADD COLUMN     "domainOrderInLevel" INTEGER;

-- CreateTable
CREATE TABLE "user_domain_progress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "section" "SatSection" NOT NULL,
    "domain" TEXT NOT NULL,
    "currentLevel" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_domain_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_domain_progress_userId_section_domain_key" ON "user_domain_progress"("userId", "section", "domain");

-- AddForeignKey
ALTER TABLE "user_domain_progress" ADD CONSTRAINT "user_domain_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
