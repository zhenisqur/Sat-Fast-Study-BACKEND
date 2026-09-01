import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { QuestionService } from '../services/question.service';
import { QueryQuestionsDto } from '../dto/query-questions.dto';

@UseGuards(JwtAuthGuard)
@Controller('sat/questions')
export class QuestionController {
  constructor(private readonly questionService: QuestionService) {}

  @Get() async list(@Query() query: QueryQuestionsDto) { return this.questionService.getQuestions(query); }
  @Get(':id') async getOne(@Param('id') id: string) { return this.questionService.getQuestionForStudent(id); }
}
