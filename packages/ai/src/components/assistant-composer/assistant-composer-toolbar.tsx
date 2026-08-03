import type { ReactNode } from 'react';
import { PureReactor, prop, bound, Ref } from '@fromcode119/reactor';
import { FrameworkIcons } from '@fromcode119/react';
import { ConversationMode } from '@ai/enums/conversation-mode.enum';
import { Select } from '@ai/ui/select';
import { SelectOption } from '@ai/ui/select-option';
import { AssistantMode } from '@ai/components/enums/assistant-mode.enum';

/**
 * Composer footer: attach, tools toggle, mode select and send. Presentational → `PureReactor`; the tools
 * toggle is a `@bound` method (the parent owns `showTools` via `setShowTools`), other actions pass the prop
 * callbacks by name.
 */
export class AssistantComposerToolbar extends PureReactor {
  private static readonly MODE_OPTIONS: SelectOption[] = AssistantMode.values().map((mode) => new SelectOption(mode.value, mode.label));

  @prop declare mode: ConversationMode;
  @prop declare onModeChange: (value: string) => void;
  @prop declare openFilePicker: () => void;
  @prop declare uploadingAttachments: boolean;
  @prop declare developerMode: boolean;
  @prop declare toolsButtonRef: Ref<HTMLButtonElement>;
  @prop declare showTools: boolean;
  @prop declare setShowTools: (val: boolean | ((prev: boolean) => boolean)) => void;
  @prop declare activeTools: number;
  @prop declare totalTools: number;
  @prop declare sendPrompt: () => void;
  @prop declare sendDisabled: boolean;

  @bound
  protected onToggleTools(): void {
    this.setShowTools((prev) => !prev);
  }

  private renderToolsButton(): ReactNode {
    if (!this.developerMode) return null;
    const tone = this.showTools
      ? 'border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_22%,transparent)] text-[var(--text-main)]'
      : 'border-transparent bg-transparent text-[var(--text-sub)] hover:border-[var(--border)] hover:bg-[var(--surface)] hover:text-[var(--text-main)]';
    return (
      <button
        ref={this.toolsButtonRef}
        type="button"
        onClick={this.onToggleTools}
        className={`inline-flex h-7 w-7 items-center justify-center rounded-md border transition ${tone}`}
        title={`Tools (${this.activeTools}/${this.totalTools})`}
        aria-label={`Tools (${this.activeTools}/${this.totalTools})`}
      >
        <FrameworkIcons.Wrench size={11} />
      </button>
    );
  }

  render(): ReactNode {
    return (
      <div className="flex items-center justify-between border-t border-[var(--border)] bg-[var(--surface)] px-3 py-1.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={this.openFilePicker}
            disabled={this.uploadingAttachments}
            className="inline-flex h-7 w-7 items-center justify-center rounded border border-[var(--border)] bg-[var(--text-main)] text-[var(--bg)] transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
            title="Attach file"
            aria-label="Attach file"
          >
            <FrameworkIcons.Plus size={12} />
          </button>
        </div>
        <div className="flex items-center gap-3">
          {this.renderToolsButton()}
          <div className="w-[120px] shrink-0">
            <Select
              value={this.mode}
              onChange={this.onModeChange}
              options={AssistantComposerToolbar.MODE_OPTIONS}
              compact
              searchable={false}
              className="w-full"
            />
          </div>
          <span className="hidden text-[10px] font-mono text-[var(--text-sub)] opacity-60 sm:inline">
            Enter to send • Shift+Enter new line
          </span>
          <button
            type="button"
            onClick={this.sendPrompt}
            disabled={this.sendDisabled}
            className="inline-flex h-7 w-7 items-center justify-center rounded border border-[var(--border)] bg-[var(--text-main)] text-[var(--bg)] transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
            title="Send"
          >
            <FrameworkIcons.Send size={12} />
          </button>
        </div>
      </div>
    );
  }
}
