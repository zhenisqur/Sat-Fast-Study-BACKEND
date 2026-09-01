import { IsInt, IsString, Min } from 'class-validator';

export class SubmitLevelAnswerDto {
  @IsString()
  questionId: string;

  @IsString()
  userAnswer: string;

  @IsInt()
  @Min(0)
  timeSpentSec: number;
}
