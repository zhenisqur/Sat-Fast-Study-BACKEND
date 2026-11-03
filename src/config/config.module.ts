import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import configuration from './configuration';
import { validateEnv } from './validation.schema';

@Module({
  imports: [NestConfigModule.forRoot({ isGlobal: true, load: [configuration], validate: validateEnv })],
})
export class ConfigModule {}
