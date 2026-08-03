import { AssistantRole } from '@ai/enums/assistant-role.enum';
import { ChatMode } from '@ai/enums/chat-mode.enum';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/reactor';
import { FrameworkIcons } from '@fromcode119/react';
import { GlassMorphism } from '@ai/ui/glass-morphism';
import { AssistantActionSummary } from '@ai/components/assistant-action-summary';
import { AssistantAttachments } from '@ai/components/assistant-attachments';
import { AssistantExecutionCard } from '@ai/components/assistant-execution-card';
import { AssistantMessageContent } from '@ai/components/assistant-message-content';
import { AssistantTechnicalDetails } from '@ai/components/assistant-technical-details';
import type { IAssistantMessage } from '@ai/interfaces/assistant-message.interface';

export class AssistantConversationMessage extends PureReactor {
  @prop declare entry: IAssistantMessage;
  @prop declare index: number;
  @prop declare forkFromVisibleMessage: (index: number) => void;
  @prop declare setChatMode: Dispatch<SetStateAction<ChatMode>>;
  @prop declare showTechnicalDetails: boolean;

  private get isUser(): boolean {
    return this.entry.role === AssistantRole.USER;
  }

  private get isAssistant(): boolean {
    return this.entry.role === AssistantRole.ASSISTANT;
  }

  private get isSystem(): boolean {
    return this.entry.role === 'system';
  }

  private get showMetaRow(): boolean {
    return this.isSystem || !!(this.entry.provider || this.entry.model);
  }

  private get articleTone(): string {
    return this.isUser
      ? GlassMorphism.GLASS_MESSAGE_USER
      : this.isAssistant
        ? GlassMorphism.GLASS_MESSAGE_ASSISTANT
        : GlassMorphism.GLASS_MESSAGE_SYSTEM;
  }

  @bound
  protected onFork(): void {
    this.forkFromVisibleMessage(this.index);
  }

  render(): ReactNode {
    return (
      <div className={`group flex transition-all duration-300 ${this.isUser ? 'justify-end' : 'justify-start'}`}>
        <article className={`relative max-w-[92%] rounded-2xl border px-3.5 py-3 text-sm shadow-[0_16px_40px_rgba(2,6,23,0.2)] dark:shadow-[0_16px_40px_rgba(2,6,23,0.34)] ${this.articleTone}`}>
          {this.isAssistant ? (
            <button
              type="button"
              onClick={this.onFork}
              className="absolute -right-8 top-1/2 -translate-y-1/2 inline-flex h-6 w-6 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-500 shadow-sm opacity-0 transition-all group-hover:opacity-100 hover:border-slate-400 hover:bg-white hover:text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              title="Fork from this message"
              aria-label="Fork from this message"
            >
              <FrameworkIcons.ArrowLeftRight size={12} />
            </button>
          ) : null}
          {this.showMetaRow ? (
            <div className="mb-1 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">{this.isSystem ? <p className="text-[10px] font-bold uppercase tracking-wider opacity-85">System</p> : null}</div>
              {this.entry.provider || this.entry.model ? <span className="text-[10px] opacity-70">{[this.entry.provider, this.entry.model].filter(Boolean).join(' • ')}</span> : null}
            </div>
          ) : null}
          <AssistantMessageContent entry={this.entry} messageIndex={this.index} />
          <AssistantActionSummary entry={this.entry} setChatMode={this.setChatMode} />
          <AssistantAttachments entry={this.entry} />
          <AssistantTechnicalDetails entry={this.entry} showTechnicalDetails={this.showTechnicalDetails} />
          <AssistantExecutionCard entry={this.entry} />
        </article>
      </div>
    );
  }
}
