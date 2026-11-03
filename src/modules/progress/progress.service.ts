import { Injectable } from '@nestjs/common';
import { PrismaService } from '@common/database/prisma.service';

@Injectable()
export class ProgressService {
  constructor(private readonly prisma: PrismaService) {}

  async addXp(userId: string, amount: number): Promise<number> {
    if (amount <= 0) return 0;
    await this.prisma.user.update({ where: { id: userId }, data: { xp: { increment: amount } } });
    return amount;
  }
}
