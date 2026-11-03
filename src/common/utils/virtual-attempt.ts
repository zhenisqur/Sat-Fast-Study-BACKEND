import { PrismaService } from '../database/prisma.service';

/**
 * AnswerLog требует attemptId, а уроки/повторение — не полноформатный тест.
 * Ответы вне тестов вешаются на один "виртуальный" TestAttempt на пользователя и режим.
 */
export async function getOrCreateVirtualAttemptId(prisma: PrismaService, userId: string, testId: string, title: string): Promise<string> {
  await prisma.test.upsert({ where: { id: testId }, update: {}, create: { id: testId, title, isPublished: false } });
  const existing = await prisma.testAttempt.findFirst({ where: { userId, testId, status: 'IN_PROGRESS' }, select: { id: true } });
  if (existing) return existing.id;
  const created = await prisma.testAttempt.create({ data: { userId, testId, status: 'IN_PROGRESS' }, select: { id: true } });
  return created.id;
}
