import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { isValidTimezone } from '@common/utils/local-date';
import { ProgressService } from '../progress/progress.service';
import { UsersRepository } from './users.repository';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly progressService: ProgressService,
  ) {}

  async getProfile(userId: string) {
    const user = await this.usersRepository.findWithProgress(userId);
    if (!user) throw new NotFoundException('Пользователь не найден');
    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }

  async updateProfile(userId: string, dto: UpdateUserDto) {
    if (dto.timezone !== undefined && !isValidTimezone(dto.timezone)) {
      throw new BadRequestException('Неизвестный часовой пояс');
    }
    await this.usersRepository.update(userId, dto);
    // Интенсивность меняет цель уже сегодняшнего дня (если она ещё не выполнена).
    if (dto.studyIntensity !== undefined) await this.progressService.applyIntensityChange(userId);
    return this.getProfile(userId);
  }
}
