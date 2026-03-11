import type { AssistantHistoryEntry } from './request-payload-service.types';

export class AssistantRequestPayloadService {
  constructor(private normalizeHistory: (input: any) => AssistantHistoryEntry[]) {}

  normalizeLegacyAssistantChatPayload(body: any): any {
    const source = body && typeof body === 'object' ? body : {};
    const normalized: any = { ...source };
    const messages = Array.isArray(source?.messages) ? source.messages : [];

    if (!String(normalized?.message || '').trim()) {
      const prompt = String(source?.prompt || source?.text || '').trim();
      if (prompt) {
        normalized.message = prompt;
      } else if (messages.length) {
        const normalizedMessages = this.normalizeHistory(messages);
        const lastUserIndex = [...normalizedMessages]
          .map((item, index) => ({ item, index }))
          .reverse()
          .find((entry) => entry.item.role === 'user');
        if (lastUserIndex) {
          normalized.message = lastUserIndex.item.content;
          normalized.history = normalizedMessages.slice(0, lastUserIndex.index);
        } else if (normalizedMessages.length) {
          normalized.message = normalizedMessages[normalizedMessages.length - 1].content;
          normalized.history = normalizedMessages.slice(0, -1);
        }
      }
    } else if (!Array.isArray(normalized?.history) && messages.length) {
      normalized.history = this.normalizeHistory(messages);
    }

    if (!String(normalized?.agentMode || '').trim()) {
      const mode = String(source?.mode || source?.workspaceMode || '').trim().toLowerCase();
      if (mode === 'plan' || mode === 'agent' || mode === 'advanced') {
        normalized.agentMode = 'advanced';
      } else if (mode === 'chat' || mode === 'simple' || mode === 'basic') {
        normalized.agentMode = 'basic';
      }
    }

    if (!String(normalized?.skillId || '').trim()) {
      const persona = String(source?.persona || source?.profile || '').trim();
      if (persona) normalized.skillId = persona.toLowerCase();
    }

    if (!Array.isArray(normalized?.tools) && Array.isArray(source?.allowedTools)) {
      normalized.tools = source.allowedTools;
    }

    return normalized;
  }

  normalizeLegacyAssistantExecutePayload(body: any): any {
    const source = body && typeof body === 'object' ? body : {};
    const normalized: any = { ...source };
    if (!Array.isArray(normalized?.actions) && Array.isArray(source?.stagedActions)) {
      normalized.actions = source.stagedActions;
    }
    if (normalized?.dryRun === undefined) {
      if (typeof source?.preview === 'boolean') normalized.dryRun = source.preview;
      if (typeof source?.sandbox === 'boolean') normalized.dryRun = source.sandbox;
    }
    return normalized;
  }

  isLegacyAssistantChatPayload(body: any): boolean {
    const source = body && typeof body === 'object' ? body : {};
    const hasCanonical = !!String(source?.message || '').trim();
    if (hasCanonical) return false;
    return (
      Array.isArray(source?.messages) ||
      !!String(source?.prompt || source?.text || '').trim() ||
      !!String(source?.persona || source?.profile || '').trim() ||
      !!String(source?.mode || source?.workspaceMode || '').trim()
    );
  }

  isLegacyAssistantExecutePayload(body: any): boolean {
    const source = body && typeof body === 'object' ? body : {};
    return !Array.isArray(source?.actions) && Array.isArray(source?.stagedActions);
  }

  validateAssistantChatPayload(body: any): string | null {
    const message = String(body?.message || '').trim();
    if (!message) return 'message is required';
    if (body?.history !== undefined && !Array.isArray(body.history)) return 'history must be an array';
    if (body?.tools !== undefined && !Array.isArray(body.tools)) return 'tools must be an array';
    return null;
  }

  validateAssistantExecutePayload(body: any): string | null {
    if (!Array.isArray(body?.actions) || body.actions.length === 0) return 'actions are required';
    return null;
  }
}
