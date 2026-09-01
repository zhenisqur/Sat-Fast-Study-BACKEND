-- CreateTable
CREATE TABLE "lesson_scenarios" (
    "id" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "domainLevel" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lesson_scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lesson_scenarios_domain_domainLevel_order_key" ON "lesson_scenarios"("domain", "domainLevel", "order");
