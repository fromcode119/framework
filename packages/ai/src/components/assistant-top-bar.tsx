import { ThemeMode } from '@fromcode119/core/client';
import { ChatMode } from '@ai/enums/chat-mode.enum';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/reactor';
import { FrameworkIcons } from '@fromcode119/react';

export class AssistantTopBar extends PureReactor {
  @prop declare provider: string;
  @prop declare model: string;
  @prop declare chatMode: ChatMode;
  @prop declare sandboxMode: boolean;
  @prop declare showComposerControls: boolean;
  @prop declare setShowComposerControls: Dispatch<SetStateAction<boolean>>;
  @prop declare openAdvancedWorkspace: () => void;
  @prop declare toggleThemeMode: () => void;
  @prop declare themeMode: ThemeMode;
  @prop declare showGateway: boolean;
  @prop declare setShowGateway: Dispatch<SetStateAction<boolean>>;
  @prop declare showHistory: boolean;
  @prop declare setShowHistory: Dispatch<SetStateAction<boolean>>;

  @bound
  protected toggleComposerControls(): void {
    this.setShowComposerControls((prev) => !prev);
  }

  @bound
  protected toggleGateway(): void {
    this.setShowGateway((prev) => !prev);
    this.setShowHistory(false);
  }

  @bound
  protected toggleHistory(): void {
    this.setShowHistory((prev) => !prev);
    this.setShowGateway(false);
  }

  render(): ReactNode {
    return (
      <div className="fixed right-4 top-4 z-40 flex justify-end sm:right-6 sm:top-6">
        <div className="flex max-w-[92vw] items-center gap-2 rounded-xl border border-slate-200/85 bg-white/92 p-1.5 shadow-[0_8px_28px_rgba(15,23,42,0.16)] backdrop-blur-xl dark:border-slate-700/80 dark:bg-slate-950/78 dark:shadow-[0_12px_32px_rgba(2,6,23,0.62)]">
          <div className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-900/70">
            <button type="button" className="inline-flex h-7 items-center gap-1 rounded-md bg-slate-900 px-2 text-[10px] font-semibold text-white transition dark:bg-white/18" title="Atlantis Intelligence mode">
              <FrameworkIcons.Home size={11} />
              <span>Atlantis</span>
            </button>
            <button type="button" onClick={this.openAdvancedWorkspace} className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[10px] font-semibold text-slate-600 transition hover:text-slate-900 dark:text-slate-300 dark:hover:text-white" title="Open advanced admin">
              <FrameworkIcons.Settings size={11} />
              <span>Advanced</span>
            </button>
          </div>
          <span className="hidden rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300 sm:inline-flex">
            {this.provider}
            {this.model ? ` • ${this.model}` : ''}
          </span>
          <span className="hidden rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold capitalize text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300 md:inline-flex">
            {this.chatMode.value}
            {this.sandboxMode ? ' • preview' : ' • live'}
          </span>
          <button
            type="button"
            onClick={this.toggleComposerControls}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition ${
              this.showComposerControls
                ? 'border-[var(--border)] bg-[var(--surface-strong)] text-[var(--text-main)]'
                : 'border-slate-200 bg-white text-slate-600 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:text-white'
            }`}
            title="Toggle composer controls"
            aria-label="Toggle composer controls"
          >
            <FrameworkIcons.More size={12} />
          </button>
          <button type="button" onClick={this.toggleThemeMode} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:text-white" title={`Switch to ${this.themeMode === ThemeMode.DARK ? ThemeMode.LIGHT : ThemeMode.DARK} mode`}>
            {this.themeMode === ThemeMode.DARK ? <FrameworkIcons.Sun size={12} /> : <FrameworkIcons.Moon size={12} />}
          </button>
          <button
            type="button"
            onClick={this.toggleGateway}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition ${
              this.showGateway
                ? 'border-[var(--border)] bg-[var(--surface-strong)] text-[var(--text-main)]'
                : 'border-slate-200 bg-white text-slate-600 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:text-white'
            }`}
            title="Toggle gateway settings"
            aria-label="Toggle gateway settings"
          >
            <FrameworkIcons.Key size={13} />
          </button>
          <button
            type="button"
            onClick={this.toggleHistory}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition ${
              this.showHistory
                ? 'border-[var(--border)] bg-[var(--surface-strong)] text-[var(--text-main)]'
                : 'border-slate-200 bg-white text-slate-600 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:text-white'
            }`}
            title="Toggle history"
            aria-label="Toggle history"
          >
            <FrameworkIcons.Clock size={13} />
          </button>
        </div>
      </div>
    );
  }
}
