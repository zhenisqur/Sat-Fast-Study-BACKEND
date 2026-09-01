import { IsInt, IsString, Min } from 'class-validator';

export class SubmitAnswerDto {
  @IsString() questionId: string;
  @IsString() userAnswer: string;
  @IsInt() @Min(0) timeSpentSec: number;
}
