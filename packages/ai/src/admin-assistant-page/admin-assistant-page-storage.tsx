import { AssistantRole } from '@ai/enums/assistant-role.enum';
import { ChatMode } from '@ai/enums/chat-mode.enum';
import { ModelLocation } from '@ai/api/forge/enums/model-location.enum';
import { Platform } from '@fromcode119/react-class-components';
import { AssistantConstants } from '@ai/constants/assistant.constants';
import { AdminAssistantPageUtils } from '@ai/admin-assistant-page/admin-assistant-page-utils';
import { AdminAssistantPageSessionService } from '@ai/admin-assistant-page/admin-assistant-page-session-service';
import { AdminAssistantPageState } from '@ai/admin-assistant-page/admin-assistant-page-state';

/**
 * What survives a reload: the conversation history, the UI preferences, and the theme.
 *
 * History has TWO homes and the difference is load-bearing. The server is authoritative when it
 * answers; the browser is the fallback when it does not, and `historySource` says which is in play —
 * writing local history while the server owns it would resurrect deleted sessions on the next reload.
 */
export class AdminAssistantPageStorage extends AdminAssistantPageState {

  protected async refreshHistoryIfServer(): Promise<void> {
    if (this.historySource !== ModelLocation.SERVER) return;
    try {
      const sessions = await AdminAssistantPageSessionService.refreshServerHistory(this.api, this.provider);
      this.historySessions = sessions;
    } catch {}
  }

  // --- history effect implementations ---
  protected applyThemeMode(): void {
    if (!Platform.isBrowser) return;
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(this.themeMode.value);
    if (Platform.isBrowser) AdminAssistantPageState.assistantBrowserState.writeThemePreference(this.themeMode.value);
  }

  protected async hydrateHistory(): Promise<void> {
    if (this.historyHydratedInternal || this.historyHydrationInFlight || this.historyHydrated) return;
    this.historyHydrationInFlight = true;
    const savedActive = Platform.isBrowser ? AdminAssistantPageState.assistantBrowserState.readActiveSessionId() : '';
    let serverLoaded = false;
    let localSessions: ReturnType<typeof AdminAssistantPageSessionService.loadHistoryFromLocal> = [];
    try {
      this.historyLoading = true;
      const sessions = await AdminAssistantPageSessionService.refreshServerHistory(this.api, this.provider);
      if (this.cancelled) { this.historyHydrationInFlight = false; return; }
      this.historySessions = sessions;
      this.historySource = ModelLocation.SERVER;
      serverLoaded = true;
    } catch {
      localSessions = AdminAssistantPageSessionService.loadHistoryFromLocal(AdminAssistantPageState.assistantBrowserState, this.provider);
      if (this.cancelled) { this.historyHydrationInFlight = false; return; }
      this.historySessions = localSessions;
      this.historySource = ModelLocation.LOCAL;
    } finally {
      if (!this.cancelled) this.historyLoading = false;
    }

    if (savedActive) {
      try {
        if (serverLoaded) {
          const detailed = await AdminAssistantPageSessionService.fetchSession(this.api, savedActive, this.provider);
          if (!this.cancelled && detailed) {
            this.historySessions = [detailed, ...this.historySessions.filter((item) => item.id !== detailed.id)];
            this.activeSessionId = detailed.id;
            this.messages = detailed.messages.length ? detailed.messages : AdminAssistantPageUtils.createReadyConversation();
            this.provider = detailed.provider || 'openai';
            if (detailed.model) this.model = detailed.model;
            if (detailed.skillId) this.skillId = detailed.skillId;
            this.chatMode = detailed.chatMode || ChatMode.AUTO;
            this.sandboxMode = detailed.sandboxMode !== false;
          } else if (!this.cancelled) {
            AdminAssistantPageState.assistantBrowserState.writeActiveSessionId('');
            this.activeSessionId = '';
          }
        } else {
          const active = localSessions.find((item) => item.id === savedActive);
          if (active) {
            this.activeSessionId = active.id;
            this.messages = active.messages;
            this.provider = active.provider || 'openai';
            if (active.model) this.model = active.model;
            if (active.skillId) this.skillId = active.skillId;
            this.chatMode = active.chatMode || ChatMode.AUTO;
            this.sandboxMode = active.sandboxMode !== false;
          } else {
            AdminAssistantPageState.assistantBrowserState.writeActiveSessionId('');
            this.activeSessionId = '';
          }
        }
      } catch {
        if (!this.cancelled) {
          AdminAssistantPageState.assistantBrowserState.writeActiveSessionId('');
          this.activeSessionId = '';
        }
      }
    }

    this.historyHydrationInFlight = false;
    if (!this.cancelled) {
      this.historyHydratedInternal = true;
      this.historyHydrated = true;
    }
  }

  protected persistHistory(): void {
    if (!Platform.isBrowser || !this.historyHydrated) return;
    try {
      if (this.historySource === ModelLocation.LOCAL) AdminAssistantPageState.assistantBrowserState.writeHistoryEntries(this.historySessions.slice(0, 40));
      AdminAssistantPageState.assistantBrowserState.writeActiveSessionId(this.activeSessionId);
    } catch {
      return;
    }
  }

  protected loadUiPrefs(): void {
    if (this.checkingIntegration || this.prefsLoaded || !Platform.isBrowser) return;
    this.prefsLoaded = true;
    try {
      const parsed = AdminAssistantPageState.assistantBrowserState.readUiPreferences();
      if (!parsed.provider && !parsed.model && !parsed.skillId && !parsed.baseUrl && !parsed.chatMode && parsed.sandboxMode === null && parsed.leftSidebarOpen === null && parsed.rightSidebarOpen === null) {
        this.uiPrefsHydrated = true;
        return;
      }
      if (!this.integrationConfigured) {
        const provider = parsed.provider || this.provider;
        const baseUrl = AdminAssistantPageUtils.sanitizeBaseUrlForProvider(provider, AdminAssistantPageState.assistantBrowserState.readProviderBaseUrl(provider));
        if (parsed.provider && AssistantConstants.PROVIDER_OPTIONS.some((item) => item.value === parsed.provider)) {
          this.provider = parsed.provider;
        }
        if (parsed.model) this.model = parsed.model;
        if (baseUrl) this.baseUrl = baseUrl;
        else if (provider === 'ollama') this.baseUrl = AdminAssistantPageUtils.OLLAMA_DOCKER_BASE_URL;
      }
      if (parsed.skillId) this.skillId = parsed.skillId;
      if (parsed.chatMode) this.chatMode = ChatMode.resolve(parsed.chatMode);
      if (typeof parsed.sandboxMode === 'boolean') this.sandboxMode = parsed.sandboxMode;
      if (parsed.leftSidebarOpen !== null || parsed.rightSidebarOpen !== null) {
        this.layoutState = {
          ...this.layoutState,
          leftOpen: parsed.leftSidebarOpen !== null ? parsed.leftSidebarOpen : this.layoutState.leftOpen,
          rightOpen: parsed.rightSidebarOpen !== null ? parsed.rightSidebarOpen : this.layoutState.rightOpen,
        };
      }
    } catch {
      return;
    } finally {
      this.uiPrefsHydrated = true;
    }
  }

  protected writeUiPrefs(): void {
    if (!Platform.isBrowser) return;
    try {
      const persistedPreferences = AdminAssistantPageState.assistantBrowserState.readUiPreferences();
      const persistedBaseUrls = { ...persistedPreferences.baseUrls };
      const normalizedProvider = String(this.provider || '').trim().toLowerCase();
      const normalizedBaseUrl = String(this.baseUrl || '').trim();
      if (normalizedProvider) {
        if (normalizedBaseUrl) persistedBaseUrls[normalizedProvider] = normalizedBaseUrl;
        else delete persistedBaseUrls[normalizedProvider];
      }
      AdminAssistantPageState.assistantBrowserState.writeUiPreferences({
        provider: this.provider,
        model: this.model,
        skillId: this.skillId,
        baseUrl: normalizedBaseUrl,
        baseUrls: persistedBaseUrls,
        chatMode: this.chatMode.value,
        sandboxMode: this.sandboxMode,
        leftSidebarOpen: this.layoutState.leftOpen,
        rightSidebarOpen: this.layoutState.rightOpen,
      });
    } catch {
      return;
    }
  }

  protected normalizeBaseUrl(): void {
    const normalizedProvider = String(this.provider || '').trim().toLowerCase();
    const sanitized = AdminAssistantPageUtils.sanitizeBaseUrlForProvider(normalizedProvider, this.baseUrl);
    if (sanitized === this.baseUrl) return;
    this.baseUrl = normalizedProvider === 'ollama' ? AdminAssistantPageUtils.OLLAMA_DOCKER_BASE_URL : sanitized;
  }

  protected syncLocalHistory(): void {
    if (this.historySource !== ModelLocation.LOCAL) return;
    const normalizedMessages = this.messages.filter((entry) => entry.role !== AssistantRole.SYSTEM || entry.content !== AdminAssistantPageUtils.createReadyMessage().content);
    if (!normalizedMessages.length) return;
    const sessionId = this.activeSessionId || AdminAssistantPageUtils.createSessionId();
    if (!this.activeSessionId) this.activeSessionId = sessionId;
    const session = AdminAssistantPageSessionService.createLocalSession(sessionId, this.messages, this.provider, this.model, this.skillId, this.chatMode, this.sandboxMode);
    this.historySessions = [session, ...this.historySessions.filter((item) => item.id !== sessionId)].slice(0, 40);
  }
}
