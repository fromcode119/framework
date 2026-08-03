import { ChatMode } from '@ai/enums/chat-mode.enum';
import { AssistantConstants } from '@ai/constants/assistant.constants';
import { AssistantTextUtils } from '@ai/assistant-text-utils';
import { AdminAssistantMessageService } from '@ai/admin-assistant-page/admin-assistant-message-service';
import { AdminAssistantPageUtils } from '@ai/admin-assistant-page/admin-assistant-page-utils';
import type { IAssistantMessage } from '@ai/interfaces/assistant-message.interface';
import type { IForgeHistorySession } from '@ai/interfaces/forge-history-session.interface';

export class AdminAssistantPageSessionService {
  static loadHistoryFromLocal(
    browserState: { readHistoryEntries<T>(): T[] },
    provider: string,
  ): IForgeHistorySession[] {
    try {
      const parsed = browserState.readHistoryEntries<any>();
      return Array.isArray(parsed)
        ? parsed
            .map((item: any) => AdminAssistantMessageService.mapHistorySession(item, provider))
            .filter((item: IForgeHistorySession | null): item is IForgeHistorySession => !!item && item.messages.length > 0)
        : [];
    } catch {
      return [];
    }
  }

  static async refreshServerHistory(
    api: any,
    provider: string,
    options?: { includeMessages?: boolean },
  ): Promise<IForgeHistorySession[]> {
    const response = await api.get(
      `${AssistantConstants.ENDPOINTS.SESSIONS}?limit=60${options?.includeMessages ? '&includeMessages=true' : ''}`,
    );
    return Array.isArray(response?.sessions)
      ? response.sessions
          .map((item: any) => AdminAssistantMessageService.mapHistorySession(item, provider))
          .filter((item: IForgeHistorySession | null): item is IForgeHistorySession => !!item)
      : [];
  }

  static async fetchSession(api: any, sessionId: string, provider: string): Promise<IForgeHistorySession | null> {
    const normalized = String(sessionId || '').trim();
    if (!normalized) return null;
    const response = await api.get(`${AssistantConstants.ENDPOINTS.SESSIONS}/${encodeURIComponent(normalized)}`);
    return AdminAssistantMessageService.mapHistorySession(response?.session, provider);
  }

  static createLocalSession(
    sessionId: string,
    messages: IAssistantMessage[],
    provider: string,
    model: string,
    skillId: string,
    chatMode: ChatMode,
    sandboxMode: boolean,
  ): IForgeHistorySession {
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

  static createForkedConversation(branch: IAssistantMessage[]): { sessionId: string; messages: IAssistantMessage[] } {
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
  ): Promise<IForgeHistorySession | null> {
    const normalized = String(sourceSessionId || '').trim();
    if (!normalized) return null;
    const response = await api.post(`${AssistantConstants.ENDPOINTS.SESSIONS}/${encodeURIComponent(normalized)}/fork`, {
      fromMessageIndex: Math.max(0, visibleIndex),
    });
    return AdminAssistantMessageService.mapHistorySession(response?.session, provider);
  }
}
