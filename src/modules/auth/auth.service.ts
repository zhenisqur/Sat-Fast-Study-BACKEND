import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import appleSignin from 'apple-signin-auth';
import { PrismaService } from '@common/database/prisma.service';
import { RegisterDto } from './strategies/dto/register.dto';
import { LoginDto } from './strategies/dto/login.dto';

const SALT_ROUNDS = 10;
const googleClient = new OAuth2Client();

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Пользователь с таким email уже зарегистрирован');

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        fullName: dto.fullName,
        age: dto.age,
        hasTakenSat: dto.hasTakenSat,
        previousScore: dto.previousScore,
        authProvider: 'LOCAL',
      },
    });

    await this.prisma.userLevelProgress.createMany({
      data: [
        { userId: user.id, section: 'MATH', currentLevel: 1 },
        { userId: user.id, section: 'READING_WRITING', currentLevel: 1 },
      ],
    });

    return this.buildAuthResponse(user.id, user.email, user.role);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.passwordHash) throw new UnauthorizedException('Неверный email или пароль');
    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Неверный email или пароль');
    return this.buildAuthResponse(user.id, user.email, user.role);
  }

  // Фронт (мобилка) сам получает idToken через Google Sign-In SDK на устройстве
  // и присылает его сюда одним запросом — мы просто проверяем подпись токена.
  async googleLogin(idToken: string) {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload?.email) throw new UnauthorizedException('Невалидный Google-токен');

    const user = await this.findOrCreateOAuthUser({
      email: payload.email,
      fullName: payload.name ?? payload.email.split('@')[0],
      provider: 'GOOGLE',
      providerId: payload.sub,
    });

    return this.buildAuthResponse(user.id, user.email, user.role);
  }

  // Apple присылает identityToken (JWT) с фронта после Sign in with Apple
  async appleLogin(identityToken: string, fullNameFromClient?: string) {
    const payload = await appleSignin.verifyIdToken(identityToken, {
      audience: process.env.APPLE_CLIENT_ID,
    });
    if (!payload?.email) throw new UnauthorizedException('Невалидный Apple-токен');

    const user = await this.findOrCreateOAuthUser({
      email: payload.email,
      // Apple присылает имя только при первом входе — дальше его нет в токене,
      // поэтому фронт обязан передать его один раз при первой авторизации
      fullName: fullNameFromClient ?? payload.email.split('@')[0],
      provider: 'APPLE',
      providerId: payload.sub,
    });

    return this.buildAuthResponse(user.id, user.email, user.role);
  }

  private async findOrCreateOAuthUser(params: {
    email: string;
    fullName: string;
    provider: 'GOOGLE' | 'APPLE';
    providerId: string;
  }) {
    let user = await this.prisma.user.findUnique({ where: { email: params.email } });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: params.email,
          fullName: params.fullName,
          authProvider: params.provider,
          providerId: params.providerId,
          passwordHash: null,
        },
      });

      await this.prisma.userLevelProgress.createMany({
        data: [
          { userId: user.id, section: 'MATH', currentLevel: 1 },
          { userId: user.id, section: 'READING_WRITING', currentLevel: 1 },
        ],
      });
    }

    return user;
  }

  private buildAuthResponse(userId: string, email: string, role: string) {
    const accessToken = this.jwtService.sign({ sub: userId, email, role });
    return { accessToken, user: { id: userId, email, role } };
  }
}
