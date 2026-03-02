import { Logger } from '@fromcode119/sdk';

const logger = new Logger({ namespace: 'ai-env' });

export function resolveAiFromEnv() {
  const provider = String(process.env.AI_PROVIDER || '').trim().toLowerCase() || 'openai';

  if (provider === 'ollama') {
    return {
      provider: 'ollama',
      config: {
        model: process.env.OLLAMA_MODEL || process.env.AI_MODEL || 'llama3.1',
        baseUrl: process.env.OLLAMA_BASE_URL || process.env.AI_BASE_URL || 'http://127.0.0.1:11434',
        temperature: process.env.OLLAMA_TEMPERATURE || process.env.AI_TEMPERATURE || '0.2',
        maxTokens: process.env.OLLAMA_MAX_TOKENS || process.env.AI_MAX_TOKENS || '1200',
      },
    };
  }

  if (provider !== 'openai') {
    logger.warn(`AI provider "${provider}" is not implemented. Falling back to "openai".`);
  }

  const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
  if (!apiKey) return null;

  return {
    provider: 'openai',
    config: {
      apiKey,
      model: process.env.OPENAI_MODEL || process.env.AI_MODEL || 'gpt-4o-mini',
      baseUrl: process.env.OPENAI_BASE_URL || process.env.AI_BASE_URL || 'https://api.openai.com/v1',
      organization: process.env.OPENAI_ORGANIZATION || '',
      project: process.env.OPENAI_PROJECT || '',
      temperature: process.env.OPENAI_TEMPERATURE || process.env.AI_TEMPERATURE || '0.2',
      maxTokens: process.env.OPENAI_MAX_TOKENS || process.env.AI_MAX_TOKENS || '1200',
    },
  };
}
