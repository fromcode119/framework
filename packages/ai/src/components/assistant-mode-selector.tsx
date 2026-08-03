import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/reactor';
import type { ConversationMode } from '@ai/enums/conversation-mode.enum';
import { AssistantMode } from '@ai/components/enums/assistant-mode.enum';

/**
 * Segmented mode picker (chat / build / quick-fix). Presentational → `PureReactor`; options come from the
 * `AssistantMode` enum, and each button carries its value as `data-mode` read by one `@bound` handler.
 */
export class AssistantModeSelector extends PureReactor {
  @prop declare mode: ConversationMode;
  @prop declare onChange: (mode: ConversationMode) => void;
  @prop declare disabled?: boolean;

  @bound
  protected onSelect(event: ReactMouseEvent<HTMLButtonElement>): void {
    if (this.disabled) return;
    this.onChange(event.currentTarget.dataset.mode as unknown as ConversationMode);
  }

  private renderMode(option: AssistantMode): ReactNode {
    const isActive = this.mode.value === option.value;
    const Icon = option.icon;
    const tone = isActive
      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white';
    const cursor = this.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer';
    return (
      <button
        key={option.value}
        type="button"
        data-mode={option.value}
        onClick={this.onSelect}
        disabled={this.disabled}
        className={`group relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${tone} ${cursor}`}
        title={option.description}
      >
        <Icon size={14} />
        <span>{option.label}</span>
        <div className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 dark:bg-white dark:text-slate-900">
          {option.description}
          <div className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-4 border-transparent border-t-slate-900 dark:border-t-white" />
        </div>
      </button>
    );
  }

  render(): ReactNode {
    return (
      <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
        {AssistantMode.values().map((option) => this.renderMode(option))}
      </div>
    );
  }
}
