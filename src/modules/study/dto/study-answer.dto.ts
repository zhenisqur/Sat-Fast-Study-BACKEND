import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

/** CHOICE: userAnswer = "A".."D". FILL: userAnswers = индекс слова из options для каждого пропуска. */
export class StudyAnswerDto {
  @IsString() questionId!: string;
  @IsOptional() @IsString() userAnswer?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsInt({ each: true }) @Min(0, { each: true }) userAnswers?: number[];
  @IsOptional() @IsInt() @Min(0) timeSpentSec?: number;
}

export class SubmitQuizDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => StudyAnswerDto) answers!: StudyAnswerDto[];
}
