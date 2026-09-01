export interface AiProvider {
  complete(systemPrompt: string, userMessage: string): Promise<string>;
}
