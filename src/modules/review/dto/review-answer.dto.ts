import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class ReviewAnswerDto {
  @IsString() questionId!: string;
  @IsString() userAnswer!: string;
  @IsOptional() @IsInt() @Min(0) timeSpentSec?: number;
}
