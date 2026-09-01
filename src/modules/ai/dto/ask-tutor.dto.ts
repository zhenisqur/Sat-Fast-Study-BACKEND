import { IsString } from 'class-validator';

export class AskTutorDto {
  @IsString() questionId: string;
  @IsString() userAnswer: string;
  @IsString() studentMessage: string;
}
