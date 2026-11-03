-- CreateEnum
CREATE TYPE "QuestionKind" AS ENUM ('CHOICE', 'FILL');

-- AlterTable
ALTER TABLE "questions" ADD COLUMN     "answers" JSONB,
ADD COLUMN     "explainExamples" JSONB,
ADD COLUMN     "explainParagraphs" JSONB,
ADD COLUMN     "explainRule" TEXT,
ADD COLUMN     "kind" "QuestionKind" NOT NULL DEFAULT 'CHOICE',
ADD COLUMN     "options" JSONB,
ADD COLUMN     "parts" JSONB,
ADD COLUMN     "title" TEXT,
ALTER COLUMN "choiceA" DROP NOT NULL,
ALTER COLUMN "choiceB" DROP NOT NULL,
ALTER COLUMN "choiceC" DROP NOT NULL,
ALTER COLUMN "choiceD" DROP NOT NULL,
ALTER COLUMN "correctChoice" DROP NOT NULL;
