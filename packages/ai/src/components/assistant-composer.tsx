import type { ChangeEvent, KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { PureReactor, prop, bound, Ref } from '@fromcode119/reactor';
import { AssistantConstants } from '@ai/constants/assistant.constants';
import type { IUploadedAttachment } from '@ai/interfaces/uploaded-attachment.interface';
import { ConversationMode } from '@ai/enums/conversation-mode.enum';
import { GlassMorphism } from '@ai/ui/glass-morphism';
import { AssistantComposerAttachments } from '@ai/components/assistant-composer/assistant-composer-attachments';
import { AssistantComposerToolbar } from '@ai/components/assistant-composer/assistant-composer-toolbar';

/**
 * Prompt composer (chips, file input, textarea, toolbar). Presentational → `PureReactor`; all state (prompt,
 * mode, tools, refs) is lifted, so it takes props via `@prop` and every callback is a `@bound` method.
 */
export class AssistantComposer extends PureReactor {
  private static readonly MAX_PROMPT_LENGTH = AssistantConstants.MAX_PROMPT_LENGTH;
  @prop declare prompt: string;
  @prop declare setPrompt: (val: string) => void;
  @prop declare loading: boolean;
  @prop declare checkingIntegration: boolean;
  @prop declare integrationConfigured: boolean;
  @prop declare uploadingAttachments: boolean;
  @prop declare sendPrompt: (forced?: string) => Promise<void>;
  @prop declare onComposerKeyDown: (event: ReactKeyboardEvent<HTMLTextAreaElement>) => void;
  @prop declare onQuickFix: () => void;
  @prop declare mode: ConversationMode;
  @prop declare setMode: (mode: ConversationMode) => void;
  @prop declare attachments: IUploadedAttachment[];
  @prop declare removeAttachment: (idx: number) => void;
  @prop declare openFilePicker: () => void;
  @prop declare hasConversation: boolean;
  @prop declare promptUsage: string;
  @prop declare showTools: boolean;
  @prop declare setShowTools: (val: boolean | ((prev: boolean) => boolean)) => void;
  @prop declare activeTools: number;
  @prop declare totalTools: number;
  @prop declare quickPrompts: string[];
  @prop declare composerRef: Ref<HTMLDivElement>;
  @prop declare textareaRef: Ref<HTMLTextAreaElement>;
  @prop declare fileInputRef: Ref<HTMLInputElement>;
  @prop declare toolsButtonRef: Ref<HTMLButtonElement>;
  @prop declare onFilesSelected: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  @prop declare developerMode: boolean;

  private get placeholder(): string {
    if (this.mode === ConversationMode.BUILD) return 'Describe what should change. I will prepare changes for review.';
    if (this.mode === ConversationMode.QUICKFIX) return 'Describe the fix. I will move fast and keep changes safe.';
    return 'Ask a question or enter a command...';
  }

  private get sendDisabled(): boolean {
    return !this.prompt.trim() || this.loading || this.checkingIntegration || !this.integrationConfigured || this.uploadingAttachments;
  }

  @bound
  protected onModeChange(value: string): void {
    const nextMode = ConversationMode.resolve(String(value ?? ''));
    if (nextMode === ConversationMode.QUICKFIX) {
      this.onQuickFix();
      return;
    }
    this.setMode(nextMode);
  }

  @bound
  protected onPromptChange(event: ChangeEvent<HTMLTextAreaElement>): void {
    this.setPrompt(event.target.value.slice(0, AssistantComposer.MAX_PROMPT_LENGTH));
  }

  @bound
  protected onChipClick(event: ReactMouseEvent<HTMLButtonElement>): void {
    this.setPrompt(event.currentTarget.dataset.prompt ?? '');
  }

  @bound
  protected onSend(): void {
    void this.sendPrompt();
  }

  private renderChips(): ReactNode {
    if (this.hasConversation) return null;
    return (
      <div className="mb-2 flex flex-wrap gap-2">
        {this.quickPrompts.map((item) => (
          <button
            key={`chip-${item}`}
            type="button"
            data-prompt={item}
            onClick={this.onChipClick}
            className={`${GlassMorphism.GLASS_BUTTON} rounded-full px-2.5 py-1 text-[11px] text-[var(--text-sub)]`}
          >
            {item}
          </button>
        ))}
      </div>
    );
  }

  render(): ReactNode {
    return (
      <div ref={this.composerRef} className="w-full px-5 pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)] sm:pb-8">
        <div className="mx-auto w-full max-w-[840px]">
          {this.renderChips()}
          <div className="overflow-hidden rounded-md border border-[var(--border)] bg-[var(--input-bg)] shadow-[0_1px_2px_rgba(0,0,0,0.4)]">
            <input
              ref={this.fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={this.onFilesSelected}
            />
            <AssistantComposerAttachments attachments={this.attachments} removeAttachment={this.removeAttachment} />
            <textarea
              ref={this.textareaRef}
              value={this.prompt}
              onChange={this.onPromptChange}
              onKeyDown={this.onComposerKeyDown}
              placeholder={this.placeholder}
              className="min-h-12 max-h-[300px] w-full resize-none overflow-y-auto border-0 bg-transparent px-4 py-3 text-sm leading-relaxed text-[var(--text-main)] outline-none placeholder:text-[var(--text-sub)]"
            />
            <AssistantComposerToolbar
              mode={this.mode}
              onModeChange={this.onModeChange}
              openFilePicker={this.openFilePicker}
              uploadingAttachments={this.uploadingAttachments}
              developerMode={this.developerMode}
              toolsButtonRef={this.toolsButtonRef}
              showTools={this.showTools}
              setShowTools={this.setShowTools}
              activeTools={this.activeTools}
              totalTools={this.totalTools}
              sendPrompt={this.onSend}
              sendDisabled={this.sendDisabled}
            />
            {this.uploadingAttachments ? (
              <div className="mt-2 flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5">
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--text-main)]" />
                <span className="text-xs font-medium text-[var(--text-sub)]">Uploading assets</span>
              </div>
            ) : null}
          </div>
          <div className="mt-1.5 flex items-center justify-end gap-2 px-1 text-[10px] text-[var(--text-sub)]">
            <div>{this.promptUsage}</div>
          </div>
        </div>
      </div>
    );
  }
}
