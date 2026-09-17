import { SidebarOverlay } from '@ai/enums/sidebar-overlay.enum';
import { AssistantViewport } from '@ai/enums/assistant-viewport.enum';
import { ChatMode } from '@ai/enums/chat-mode.enum';
import { ModelLocation } from '@ai/api/forge/enums/model-location.enum';
import { bound } from '@fromcode119/react-class-components';
import { AdminAssistantPageUtils } from '@ai/admin-assistant-page/admin-assistant-page-utils';
import { AdminAssistantPageSessionService } from '@ai/admin-assistant-page/admin-assistant-page-session-service';
import { AdminAssistantPageGateway } from '@ai/admin-assistant-page/admin-assistant-page-gateway';

/**
 * Starting, opening, forking and deleting a conversation.
 *
 * Every one of these takes a server path and a local one, and the local path is a real fallback, not
 * a stub: the page stays usable when history cannot be reached, it simply stops being shared across
 * browsers. A fork always lands on a NEW session id, so the branch cannot overwrite what it came from.
 */
export class AdminAssistantPageSessions extends AdminAssistantPageGateway {

  @bound
  startNewSession(): void {
    this.followLatest = true;
    this.messages = AdminAssistantPageUtils.createReadyConversation();
    this.prompt = '';
    this.attachments = [];
    this.selectedActionIndexes = [];
    this.activeSessionId = AdminAssistantPageUtils.createSessionId();
    if (this.layoutState.viewport === AssistantViewport.MOBILE) this.layoutState = { ...this.layoutState, overlay: SidebarOverlay.NONE };
    this.notice = '';
    this.error = '';
  }

  @bound
  async openHistorySession(sessionId: string): Promise<void> {
    const localSession = this.historySessions.find((item) => item.id === sessionId);
    if (!localSession) return;
    try {
      if (this.historySource === ModelLocation.SERVER) {
        const remoteSession = await AdminAssistantPageSessionService.fetchSession(this.api, sessionId, this.provider);
        if (remoteSession) {
          this.historySessions = [remoteSession, ...this.historySessions.filter((item) => item.id !== remoteSession.id)];
          this.activeSessionId = remoteSession.id;
          this.messages = remoteSession.messages.length ? remoteSession.messages : AdminAssistantPageUtils.createReadyConversation();
          this.provider = remoteSession.provider || 'openai';
          if (remoteSession.model) this.model = remoteSession.model;
          if (remoteSession.skillId) this.skillId = remoteSession.skillId;
          this.chatMode = remoteSession.chatMode || ChatMode.AUTO;
          this.sandboxMode = remoteSession.sandboxMode !== false;
          if (this.layoutState.viewport === AssistantViewport.MOBILE) this.layoutState = { ...this.layoutState, overlay: SidebarOverlay.NONE };
          this.followLatest = true;
          return;
        }
      }
    } catch {}
    this.activeSessionId = localSession.id;
    this.messages = localSession.messages.length ? localSession.messages : AdminAssistantPageUtils.createReadyConversation();
    this.provider = localSession.provider || 'openai';
    if (localSession.model) this.model = localSession.model;
    if (localSession.skillId) this.skillId = localSession.skillId;
    this.chatMode = localSession.chatMode || ChatMode.AUTO;
    this.sandboxMode = localSession.sandboxMode !== false;
    if (this.layoutState.viewport === AssistantViewport.MOBILE) this.layoutState = { ...this.layoutState, overlay: SidebarOverlay.NONE };
    this.followLatest = true;
  }

  @bound
  removeHistorySession(sessionId: string): void {
    const normalized = String(sessionId || '').trim();
    if (!normalized) return;
    if (this.historySource === ModelLocation.SERVER) {
      void (async () => {
        try { await AdminAssistantPageSessionService.deleteSession(this.api, normalized); } catch {} finally {
          this.historySessions = this.historySessions.filter((item) => item.id !== normalized);
          if (this.activeSessionId === normalized) this.startNewSession();
        }
      })();
      return;
    }
    this.historySessions = this.historySessions.filter((item) => item.id !== normalized);
    if (this.activeSessionId === normalized) this.startNewSession();
  }

  @bound
  forkFromVisibleMessage(visibleIndex: number): void {
    const branch = this.visibleMessages.slice(0, visibleIndex + 1);
    if (!branch.length) return;
    const localFallback = () => {
      const forked = AdminAssistantPageSessionService.createForkedConversation(branch);
      this.activeSessionId = forked.sessionId;
      this.messages = forked.messages;
      if (this.layoutState.viewport === AssistantViewport.MOBILE) this.layoutState = { ...this.layoutState, overlay: SidebarOverlay.NONE };
      this.notice = 'Forked to a new session from this message.';
      this.error = '';
    };
    if (this.historySource !== ModelLocation.SERVER || !this.activeSessionId) { localFallback(); return; }
    void (async () => {
      try {
        const forked = await AdminAssistantPageSessionService.forkSession(this.api, this.activeSessionId, visibleIndex, this.provider);
        if (!forked) return localFallback();
        this.historySessions = [forked, ...this.historySessions.filter((item) => item.id !== forked.id)];
        this.activeSessionId = forked.id;
        this.messages = forked.messages.length ? forked.messages : AdminAssistantPageUtils.createReadyConversation();
        if (forked.provider) this.provider = forked.provider;
        if (forked.model) this.model = forked.model;
        if (forked.skillId) this.skillId = forked.skillId;
        this.chatMode = forked.chatMode || ChatMode.AUTO;
        this.sandboxMode = forked.sandboxMode !== false;
        if (this.layoutState.viewport === AssistantViewport.MOBILE) this.layoutState = { ...this.layoutState, overlay: SidebarOverlay.NONE };
        this.notice = 'Forked to a new session from this message.';
        this.error = '';
      } catch { localFallback(); }
    })();
  }
}
