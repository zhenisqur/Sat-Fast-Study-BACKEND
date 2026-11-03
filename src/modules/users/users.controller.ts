import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getMe(@CurrentUser() user: { userId: string }) {
    return this.usersService.getProfile(user.userId);
  }

  @Patch('me')
  async updateMe(@CurrentUser() user: { userId: string }, @Body() dto: UpdateUserDto) {
    return this.usersService.updateProfile(user.userId, dto);
  }
}
