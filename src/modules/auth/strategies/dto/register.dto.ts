import { IsEmail, IsString, MinLength, IsInt, IsBoolean, IsOptional, Min, Max } from 'class-validator';

export class RegisterDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(8) password!: string;
  @IsString() fullName!: string;

  @IsOptional() @IsInt() @Min(10) @Max(100) age?: number;
  @IsOptional() @IsBoolean() hasTakenSat?: boolean;
  @IsOptional() @IsInt() @Min(400) @Max(1600) previousScore?: number;
}
