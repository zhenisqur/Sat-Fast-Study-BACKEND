import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import { StudyIntensity } from '@prisma/client';

/** PATCH /users/me — profile questionnaire + settings. hasSubscription is NOT editable here. */
export class UpdateUserDto {
  @IsOptional() @IsString() @MinLength(1) fullName?: string;
  @IsOptional() @IsInt() @Min(10) @Max(100) age?: number;
  @IsOptional() @IsInt() @Min(400) @Max(1600) targetScore?: number;
  @IsOptional() @IsBoolean() hasTakenSat?: boolean;
  @IsOptional() @IsInt() @Min(400) @Max(1600) previousScore?: number;
  @IsOptional() @IsEnum(StudyIntensity) studyIntensity?: StudyIntensity;
  @IsOptional() @IsString() timezone?: string; // IANA, e.g. "Asia/Almaty"
}
