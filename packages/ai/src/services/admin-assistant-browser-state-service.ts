import { BrowserStateClient, RuntimeConstants } from '@fromcode119/core/client';
import { AssistantConstants } from '../assistant-core-constants';
import type { AdminAssistantUiPreferences } from './admin-assistant-browser-state-service.interfaces';

export class AdminAssistantBrowserStateService {
  private static readonly THEME_STORAGE_KEY = 'theme';

  private readonly browserState = new BrowserStateClient();

  readUiPreferences(): AdminAssistantUiPreferences {
    return this.normalizeUiPreferences(
      this.browserState.readLocalJson<unknown>(AssistantConstants.STORAGE_KEYS.UI_PREFS, {}),
    );
  }

  writeUiPreferences(preferences: AdminAssistantUiPreferences): void {
    this.browserState.writeLocalJson(AssistantConstants.STORAGE_KEYS.UI_PREFS, {
      provider: String(preferences.provider || '').trim().toLowerCase(),
      model: String(preferences.model || '').trim(),
      skillId: String(preferences.skillId || '').trim().toLowerCase(),
      baseUrl: String(preferences.baseUrl || '').trim(),
      baseUrls: this.normalizeBaseUrls(preferences.baseUrls),
      chatMode: preferences.chatMode || 'auto',
      sandboxMode: typeof preferences.sandboxMode === 'boolean' ? preferences.sandboxMode : true,
      leftSidebarOpen: typeof preferences.leftSidebarOpen === 'boolean' ? preferences.leftSidebarOpen : true,
      rightSidebarOpen: typeof preferences.rightSidebarOpen === 'boolean' ? preferences.rightSidebarOpen : true,
    });
  }

  hasProviderOrModelPreference(): boolean {
    const preferences = this.readUiPreferences();
    return !!(preferences.provider || preferences.model);
  }

  readProviderBaseUrl(provider: string): string {
    const preferences = this.readUiPreferences();
    const normalizedProvider = String(provider || '').trim().toLowerCase();
    if (!normalizedProvider) {
      return '';
    }

    const byProvider = String(preferences.baseUrls[normalizedProvider] || '').trim();
    if (byProvider) {
      return byProvider;
    }

    if (preferences.provider === normalizedProvider) {
      return preferences.baseUrl;
    }

    return '';
  }

  readThemePreference(): string {
    return String(this.browserState.readLocalString(AdminAssistantBrowserStateService.THEME_STORAGE_KEY) || '')
      .trim()
      .toLowerCase();
  }

  writeThemePreference(theme: string): void {
    this.browserState.writeLocalString(
      AdminAssistantBrowserStateService.THEME_STORAGE_KEY,
      String(theme || '').trim().toLowerCase(),
    );
  }

  readHistoryEntries<T>(): T[] {
    const entries = this.browserState.readLocalJson<unknown>(AssistantConstants.STORAGE_KEYS.HISTORY, []);
    return Array.isArray(entries) ? entries as T[] : [];
  }

  writeHistoryEntries(entries: unknown[]): void {
    this.browserState.writeLocalJson(
      AssistantConstants.STORAGE_KEYS.HISTORY,
      Array.isArray(entries) ? entries : [],
    );
  }

  readActiveSessionId(): string {
    return this.browserState.readLocalString(AssistantConstants.STORAGE_KEYS.ACTIVE_SESSION);
  }

  writeActiveSessionId(sessionId: string): void {
    const normalizedSessionId = String(sessionId || '').trim();
    if (!normalizedSessionId) {
      this.browserState.removeLocalValue(AssistantConstants.STORAGE_KEYS.ACTIVE_SESSION);
      return;
    }

    this.browserState.writeLocalString(AssistantConstants.STORAGE_KEYS.ACTIVE_SESSION, normalizedSessionId);
  }

  enableAdvancedMode(): void {
    this.browserState.writeLocalString(RuntimeConstants.ADMIN_UI.STORAGE_KEYS.ADVANCED_MODE, 'true');

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(RuntimeConstants.ADMIN_UI.EVENTS.MODE_CHANGED));
    }
  }

  private normalizeUiPreferences(value: unknown): AdminAssistantUiPreferences {
    const source = this.isRecord(value) ? value : {};
    return {
      baseUrl: String(source.baseUrl || '').trim(),
      baseUrls: this.normalizeBaseUrls(source.baseUrls),
      chatMode: this.normalizeChatMode(source.chatMode),
      leftSidebarOpen: this.normalizeSidebarOpen(source.leftSidebarOpen, source.leftOpen),
      model: String(source.model || '').trim(),
      provider: String(source.provider || '').trim().toLowerCase(),
      rightSidebarOpen: this.normalizeSidebarOpen(source.rightSidebarOpen, source.rightOpen),
      sandboxMode: typeof source.sandboxMode === 'boolean' ? source.sandboxMode : null,
      skillId: String(source.skillId || '').trim().toLowerCase(),
    };
  }

  private normalizeBaseUrls(value: unknown): Record<string, string> {
    if (!this.isRecord(value)) {
      return {};
    }

    return Object.entries(value).reduce((accumulator, [key, entryValue]) => {
      const normalizedKey = String(key || '').trim().toLowerCase();
      const normalizedValue = String(entryValue || '').trim();
      if (normalizedKey && normalizedValue) {
        accumulator[normalizedKey] = normalizedValue;
      }
      return accumulator;
    }, {} as Record<string, string>);
  }

  private normalizeChatMode(value: unknown): '' | 'auto' | 'plan' | 'agent' {
    return value === 'auto' || value === 'plan' || value === 'agent' ? value : '';
  }

  private normalizeSidebarOpen(primaryValue: unknown, legacyValue: unknown): boolean | null {
    if (typeof primaryValue === 'boolean') {
      return primaryValue;
    }

    if (typeof legacyValue === 'boolean') {
      return legacyValue;
    }

    return null;
  }

  private isRecord(value: unknown): value is Record<string, any> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
  }
}
