import type { ConversationMode } from './assistant-core-constants.types';

export class AssistantProviderUtils {
  private static readonly PROVIDER_OPENAI = 'openai';
  private static readonly PROVIDER_ANTHROPIC = 'anthropic';
  private static readonly PROVIDER_GEMINI = 'gemini';
  private static readonly PROVIDER_OLLAMA = 'ollama';

  private static readonly API_KEY_PLACEHOLDER_OPENAI = 'sk-...';
  private static readonly API_KEY_PLACEHOLDER_ANTHROPIC = 'sk-ant-...';
  private static readonly API_KEY_PLACEHOLDER_GEMINI = 'AIza...';

  private static readonly BASE_URL_OPENAI = 'https://api.openai.com/v1';
  private static readonly BASE_URL_ANTHROPIC = 'https://api.anthropic.com';
  private static readonly BASE_URL_GEMINI = 'https://generativelanguage.googleapis.com/v1beta';
  private static readonly BASE_URL_OLLAMA = 'http://host.docker.internal:11434';

  static requiresApiKey(provider: string): boolean { return AssistantProviderUtils.providerRequiresApiKey(provider); }
  static apiKeyPlaceholder(provider: string): string { return AssistantProviderUtils.providerApiKeyPlaceholder(provider); }
  static baseUrlPlaceholder(provider: string): string { return AssistantProviderUtils.providerBaseUrlPlaceholder(provider); }

  static providerRequiresApiKey(provider: string): boolean {
  const key = String(provider || '').trim().toLowerCase();
  return key === AssistantProviderUtils.PROVIDER_OPENAI || key === AssistantProviderUtils.PROVIDER_ANTHROPIC || key === AssistantProviderUtils.PROVIDER_GEMINI;
  }

  static providerApiKeyPlaceholder(provider: string): string {
  const key = String(provider || '').trim().toLowerCase();
  if (key === AssistantProviderUtils.PROVIDER_OPENAI) return AssistantProviderUtils.API_KEY_PLACEHOLDER_OPENAI;
  if (key === AssistantProviderUtils.PROVIDER_ANTHROPIC) return AssistantProviderUtils.API_KEY_PLACEHOLDER_ANTHROPIC;
  if (key === AssistantProviderUtils.PROVIDER_GEMINI) return AssistantProviderUtils.API_KEY_PLACEHOLDER_GEMINI;
  return '';
  }

  static providerBaseUrlPlaceholder(provider: string): string {
  const key = String(provider || '').trim().toLowerCase();
  if (key === AssistantProviderUtils.PROVIDER_OLLAMA) return AssistantProviderUtils.BASE_URL_OLLAMA;
  if (key === AssistantProviderUtils.PROVIDER_ANTHROPIC) return AssistantProviderUtils.BASE_URL_ANTHROPIC;
  if (key === AssistantProviderUtils.PROVIDER_GEMINI) return AssistantProviderUtils.BASE_URL_GEMINI;
  return AssistantProviderUtils.BASE_URL_OPENAI;
  }

  static conversationModeToChatMode(mode: ConversationMode): 'auto' | 'plan' | 'agent' {
  if (mode === 'build') return 'plan';
  if (mode === 'quickfix') return 'agent';
  return 'auto';
  }

  static chatModeToConversationMode(mode: 'auto' | 'plan' | 'agent'): ConversationMode {
  if (mode === 'plan') return 'build';
  if (mode === 'agent') return 'quickfix';
  return 'chat';
  }
}
