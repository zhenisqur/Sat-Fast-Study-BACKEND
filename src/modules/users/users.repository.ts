import { Injectable } from '@nestjs/common';
import { PrismaService } from '@common/database/prisma.service';
import { BaseRepository } from '@common/repository/base.repository';
import { User } from '@prisma/client';

@Injectable()
export class UsersRepository extends BaseRepository<User> {
  constructor(protected readonly prisma: PrismaService) { super(prisma, 'user'); }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findWithProgress(userId: string) {
    return this.prisma.user.findUnique({ where: { id: userId }, include: { levelProgress: true } });
  }
}
