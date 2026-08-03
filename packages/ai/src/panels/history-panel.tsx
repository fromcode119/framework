import { DrawerPresentation } from '@ai/enums/drawer-presentation.enum';
import { ModelLocation } from '@ai/api/forge/enums/model-location.enum';
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/reactor';
import { FrameworkIcons } from '@fromcode119/react';
import type { IForgeHistorySession } from '@ai/interfaces/forge-history-session.interface';
import { GlassMorphism } from '@ai/ui/glass-morphism';

/**
 * Saved-chat history sidebar (docked rail or mobile overlay). Presentational → `PureReactor`; props via
 * `@prop`, per-session open/remove handlers read the id off `data-session-id` in one `@bound` method each.
 */
export class HistoryPanel extends PureReactor {
  @prop declare showHistory: boolean;
  @prop declare presentation?: DrawerPresentation;
  @prop declare historySource: ModelLocation;
  @prop declare historyLoading: boolean;
  @prop declare historySessions: IForgeHistorySession[];
  @prop declare activeSessionId: string;
  @prop declare onRequestClose: () => void;
  @prop declare startNewSession: () => void;
  @prop declare openHistorySession: (sessionId: string) => Promise<void>;
  @prop declare removeHistorySession: (sessionId: string) => void;

  private get mode(): DrawerPresentation {
    return this.presentation ?? DrawerPresentation.DOCKED;
  }

  @bound
  protected onOpenSession(event: ReactMouseEvent<HTMLButtonElement>): void {
    void this.openHistorySession(event.currentTarget.dataset.sessionId ?? '');
  }

  @bound
  protected onRemoveSession(event: ReactMouseEvent<HTMLButtonElement>): void {
    this.removeHistorySession(event.currentTarget.dataset.sessionId ?? '');
  }

  private renderSession(session: IForgeHistorySession): ReactNode {
    const active = session.id === this.activeSessionId;
    const time = new Date(session.updatedAt || Date.now()).toLocaleString();
    return (
      <div
        key={session.id}
        className={`w-full rounded-xl border px-2.5 py-2 transition ${
          active
            ? 'border-[var(--text-main)] bg-[var(--surface-strong)] text-[var(--text-main)]'
            : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-main)] hover:bg-[var(--surface-strong)]'
        }`}
      >
        <button
          type="button"
          data-session-id={session.id}
          onClick={this.onOpenSession}
          className="w-full text-left"
        >
          <p className="line-clamp-2 text-xs font-semibold">{session.title}</p>
          <p className="mt-1 text-[10px] opacity-75">
            {session.messageCount || session.messages.length || 0} messages {'•'} {time}
          </p>
        </button>
        <div className="mt-1.5 flex justify-end">
          <button
            type="button"
            data-session-id={session.id}
            onClick={this.onRemoveSession}
            className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-[var(--border)] text-[var(--text-sub)] transition hover:bg-[var(--surface-strong)] hover:text-[var(--text-main)]"
            title="Delete session"
            aria-label="Delete session"
          >
            <FrameworkIcons.Trash size={11} />
          </button>
        </div>
      </div>
    );
  }

  private renderSidebar(): ReactNode {
    return (
      <div className="flex h-full w-full flex-col p-4">
        <div className="mb-4 flex h-12 items-center justify-between">
          <span className="text-base font-bold tracking-tight text-[var(--text-main)]">Atlantis Intelligence</span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={this.startNewSession}
              className={`${GlassMorphism.GLASS_BUTTON} h-9 gap-1 px-2 text-[11px] font-semibold`}
            >
              <FrameworkIcons.Plus size={12} />
              New
            </button>
            <button
              type="button"
              onClick={this.onRequestClose}
              className={GlassMorphism.GLASS_ICON_BUTTON}
              aria-label="Close history"
            >
              <FrameworkIcons.X size={14} />
            </button>
          </div>
        </div>
        <p className="mb-2 px-1 text-[11px] text-[var(--text-sub)]">History</p>
        <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
          {this.historyLoading ? (
            <div className={`${GlassMorphism.GLASS_SUB_PANEL} group px-3 py-3 shadow-sm`}>
              <div className="flex items-center gap-2.5">
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--text-main)]" />
                <span className="text-xs font-medium text-[var(--text-sub)]">Loading history</span>
              </div>
            </div>
          ) : this.historySessions.length === 0 ? (
            <div className={`${GlassMorphism.GLASS_SUB_PANEL} px-3 py-3`}>
              <p className="text-xs text-[var(--text-sub)]">No saved chats yet.</p>
            </div>
          ) : (
            this.historySessions.map((session) => this.renderSession(session))
          )}
        </div>
      </div>
    );
  }

  render(): ReactNode {
    if (this.mode === DrawerPresentation.OVERLAY) {
      return (
        <>
          <button
            type="button"
            aria-label="Close history panel"
            onClick={this.onRequestClose}
            className={`fixed inset-0 z-[68] bg-black/30 backdrop-blur-[1px] transition-opacity duration-200 ${
              this.showHistory ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
          />
          <aside
            className={`fixed left-0 top-0 z-[69] h-full w-[min(92vw,320px)] overflow-hidden border-r border-[var(--border)] bg-[var(--sidebar-bg)] shadow-[0_16px_48px_rgba(0,0,0,0.35)] transition-transform duration-200 ${
              this.showHistory ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
            {this.renderSidebar()}
          </aside>
        </>
      );
    }

    return (
      <aside
        className={`relative z-[60] order-first flex h-full min-h-0 shrink-0 flex-col overflow-hidden border-r border-[var(--border)] bg-[var(--sidebar-bg)] ${
          this.showHistory ? 'w-[260px]' : 'pointer-events-none w-0 border-transparent'
        }`}
      >
        <div className={`flex h-full w-[260px] flex-col transition-opacity duration-200 ${this.showHistory ? 'opacity-100' : 'opacity-0'}`}>
          {this.renderSidebar()}
        </div>
      </aside>
    );
  }
}
