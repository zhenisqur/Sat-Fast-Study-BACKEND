import { IsString } from 'class-validator';

export class AppleAuthDto {
  @IsString() identityToken!: string;
  fullName?: string;
}
