import { AssistantConstants } from '../admin-assistant-core';
import { AssistantTextUtils } from '../assistant-text-utils';
import { AdminAssistantMessageService } from './admin-assistant-message-service';
import { AdminAssistantPageUtils } from './admin-assistant-page-utils';
import type { AssistantMessage, ForgeHistorySession } from '../admin-assistant-core';

export class AdminAssistantPageSessionService {
  static loadHistoryFromLocal(
    browserState: { readHistoryEntries<T>(): T[] },
    provider: string,
  ): ForgeHistorySession[] {
    try {
      const parsed = browserState.readHistoryEntries<any>();
      return Array.isArray(parsed)
        ? parsed
            .map((item: any) => AdminAssistantMessageService.mapHistorySession(item, provider))
            .filter((item: ForgeHistorySession | null): item is ForgeHistorySession => !!item && item.messages.length > 0)
        : [];
    } catch {
      return [];
    }
  }

  static async refreshServerHistory(
    api: any,
    provider: string,
    options?: { includeMessages?: boolean },
  ): Promise<ForgeHistorySession[]> {
    const response = await api.get(
      `${AssistantConstants.ENDPOINTS.SESSIONS}?limit=60${options?.includeMessages ? '&includeMessages=true' : ''}`,
    );
    return Array.isArray(response?.sessions)
      ? response.sessions
          .map((item: any) => AdminAssistantMessageService.mapHistorySession(item, provider))
          .filter((item: ForgeHistorySession | null): item is ForgeHistorySession => !!item)
      : [];
  }

  static async fetchSession(api: any, sessionId: string, provider: string): Promise<ForgeHistorySession | null> {
    const normalized = String(sessionId || '').trim();
    if (!normalized) return null;
    const response = await api.get(`${AssistantConstants.ENDPOINTS.SESSIONS}/${encodeURIComponent(normalized)}`);
    return AdminAssistantMessageService.mapHistorySession(response?.session, provider);
  }

  static createLocalSession(
    sessionId: string,
    messages: AssistantMessage[],
    provider: string,
    model: string,
    skillId: string,
    chatMode: 'auto' | 'plan' | 'agent',
    sandboxMode: boolean,
  ): ForgeHistorySession {
    const normalizedMessages = AssistantTextUtils.stripReadyMessage(messages);
    return {
      id: sessionId,
      title: AssistantTextUtils.summarizeSessionTitle(normalizedMessages),
      updatedAt: Date.now(),
      provider,
      model,
      skillId,
      chatMode,
      sandboxMode,
      messages,
      messageCount: normalizedMessages.length,
    };
  }

  static createForkedConversation(branch: AssistantMessage[]): { sessionId: string; messages: AssistantMessage[] } {
    return {
      sessionId: AdminAssistantPageUtils.createSessionId(),
      messages: [AdminAssistantPageUtils.createReadyMessage(), ...branch.map((entry) => ({ ...entry }))],
    };
  }

  static async deleteSession(api: any, sessionId: string): Promise<void> {
    const normalized = String(sessionId || '').trim();
    if (!normalized) return;
    await api.delete(`${AssistantConstants.ENDPOINTS.SESSIONS}/${encodeURIComponent(normalized)}`);
  }

  static async forkSession(
    api: any,
    sourceSessionId: string,
    visibleIndex: number,
    provider: string,
  ): Promise<ForgeHistorySession | null> {
    const normalized = String(sourceSessionId || '').trim();
    if (!normalized) return null;
    const response = await api.post(`${AssistantConstants.ENDPOINTS.SESSIONS}/${encodeURIComponent(normalized)}/fork`, {
      fromMessageIndex: Math.max(0, visibleIndex),
    });
    return AdminAssistantMessageService.mapHistorySession(response?.session, provider);
  }
}
