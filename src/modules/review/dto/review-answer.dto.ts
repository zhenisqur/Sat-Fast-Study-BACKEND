import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsString, Min } from 'class-validator';

/** CHOICE: userAnswer = "A".."D". FILL: userAnswers = индекс слова из options для каждого пропуска. */
export class ReviewAnswerDto {
  @IsString() questionId!: string;
  @IsOptional() @IsString() userAnswer?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsInt({ each: true }) @Min(0, { each: true }) userAnswers?: number[];
  @IsOptional() @IsInt() @Min(0) timeSpentSec?: number;
}
