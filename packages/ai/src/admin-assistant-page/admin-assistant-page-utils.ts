import { AssistantConstants } from '../assistant-core-constants';

export class AdminAssistantPageUtils {
  static readonly DEFAULT_ADMIN_BASE_PATH = '/admin';
  static readonly OLLAMA_DOCKER_BASE_URL = 'http://host.docker.internal:11434';
  static readonly QUICK_PROMPTS = [
    'Find and replace "Slow Websites" with "Better Sites" everywhere.',
    'List installed plugins, active theme, and editable collections.',
    'Create a homepage draft with hero, proof, CTA, and FAQ.',
  ] as const;

  static tryParseHostname(value: string): string {
    try {
      return String(new URL(String(value || '').trim()).hostname || '').trim().toLowerCase();
    } catch {
      return '';
    }
  }

  static sanitizeBaseUrlForProvider(providerKey: string, candidate: string): string {
    const normalizedProvider = String(providerKey || '').trim().toLowerCase();
    const raw = String(candidate || '').trim();
    if (!raw) return '';
    const host = this.tryParseHostname(raw);
    if (!host) return '';

    if (normalizedProvider === 'ollama') {
      if (host.includes('openai.com') || host.includes('anthropic.com') || host.includes('googleapis.com')) return '';
    }
    if (normalizedProvider === 'openai' && (host === '127.0.0.1' || host === 'localhost' || host.endsWith('.local'))) {
      return '';
    }

    return raw;
  }

  static parseModeSwitchCommand(input: string): 'chat' | 'build' | 'quickfix' | null {
    const normalized = String(input || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
    if (!normalized) return null;
    const match = normalized.match(/^(switch|change|set|use)\s+(to\s+)?(chat|build|quick\s*fix)(\s+mode)?[.!?]*$/i);
    if (!match) return null;
    const target = String(match[3] || '').replace(/\s+/g, '').toLowerCase();
    if (target === 'chat') return 'chat';
    if (target === 'build') return 'build';
    if (target === 'quickfix') return 'quickfix';
    return null;
  }

  static isAdminScopedPath(pathname: string): boolean {
    const adminBase = this.DEFAULT_ADMIN_BASE_PATH;
    return pathname === adminBase || pathname.startsWith(`${adminBase}/`);
  }

  static getAdminNavigationPrefix(pathname: string): string {
    return this.isAdminScopedPath(pathname) ? this.DEFAULT_ADMIN_BASE_PATH : '';
  }

  static createReadyMessage() {
    return { role: 'system' as const, content: `${AssistantConstants.SURFACE_NAME} ready. Ask for changes and approve actions.` };
  }

  static createReadyConversation() {
    return [this.createReadyMessage()];
  }

  static createSessionId(): string {
    return `session-${Date.now()}`;
  }

  static getOllamaDefaultBaseUrl(provider: string, baseUrl: string): string {
    return !baseUrl && String(provider || '').trim().toLowerCase() === 'ollama'
      ? this.OLLAMA_DOCKER_BASE_URL
      : baseUrl;
  }
}
