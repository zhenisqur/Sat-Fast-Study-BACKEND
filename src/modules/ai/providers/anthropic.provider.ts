import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { AiProvider } from './ai-provider.interface';

export const ANTHROPIC_MODEL = 'claude-sonnet-4-6';

@Injectable()
export class AnthropicProvider implements AiProvider {
  private readonly client: Anthropic;

  constructor(private readonly configService: ConfigService) {
    this.client = new Anthropic({ apiKey: this.configService.get<string>('anthropic.apiKey') });
  }

  async complete(systemPrompt: string, userMessage: string): Promise<string> {
    const response = await this.client.messages.create({
      model: ANTHROPIC_MODEL, max_tokens: 500, system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });
    const textBlock = response.content.find((block) => block.type === 'text');
    return textBlock && 'text' in textBlock ? textBlock.text : '';
  }
}
