import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './strategies/dto/register.dto';
import { LoginDto } from './strategies/dto/login.dto';
import { GoogleAuthDto } from './strategies/dto/google-auth.dto';
import { AppleAuthDto } from './strategies/dto/apple-auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) { return this.authService.register(dto); }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) { return this.authService.login(dto); }

  @Post('google')
  @HttpCode(HttpStatus.OK)
  async google(@Body() dto: GoogleAuthDto) { return this.authService.googleLogin(dto.idToken); }

  @Post('apple')
  @HttpCode(HttpStatus.OK)
  async apple(@Body() dto: AppleAuthDto) {
    return this.authService.appleLogin(dto.identityToken, dto.fullName);
  }
}
