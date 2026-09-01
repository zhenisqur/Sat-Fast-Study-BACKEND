import { Injectable, NotFoundException } from '@nestjs/common';
import { UsersRepository } from './users.repository';

@Injectable()
export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async getProfile(userId: string) {
    const user = await this.usersRepository.findWithProgress(userId);
    if (!user) throw new NotFoundException('Пользователь не найден');
    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }
}
