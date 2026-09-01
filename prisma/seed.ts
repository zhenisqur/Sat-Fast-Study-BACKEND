import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const adminPasswordHash = await bcrypt.hash('admin12345', 10);
  const studentPasswordHash = await bcrypt.hash('student12345', 10);

  await prisma.user.upsert({
    where: { email: 'admin@satgg.local' },
    update: {},
    create: { email: 'admin@satgg.local', passwordHash: adminPasswordHash, fullName: 'Admin', role: 'ADMIN' },
  });

  const student = await prisma.user.upsert({
    where: { email: 'student@satgg.local' },
    update: {},
    create: { email: 'student@satgg.local', passwordHash: studentPasswordHash, fullName: 'Test Student', role: 'STUDENT', targetScore: 1450 },
  });

  await prisma.userLevelProgress.createMany({
    data: [
      { userId: student.id, section: 'MATH', currentLevel: 1 },
      { userId: student.id, section: 'READING_WRITING', currentLevel: 1 },
    ],
    skipDuplicates: true,
  });

  console.log('Seed done: admin@satgg.local / admin12345, student@satgg.local / student12345');
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });