import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { SatSection, QuestionDifficulty } from '@prisma/client';

export class QueryQuestionsDto {
  @IsOptional() @IsEnum(SatSection) section?: SatSection;
  @IsOptional() @IsEnum(QuestionDifficulty) difficulty?: QuestionDifficulty;
  @IsOptional() @IsString() tagIds?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number = 20;
}
