import type { Dispatch, MouseEvent as ReactMouseEvent, ReactNode, SetStateAction } from 'react';
import { PureReactor, prop, bound, Platform, Ref } from '@fromcode119/reactor';
import type { IAssistantToolOption } from '@ai/interfaces/assistant-tool-option.interface';

/**
 * Portalled tool-permissions popover for the composer. Presentational → `PureReactor`; rendered through
 * `this.portal`, per-tool toggle reads the name off `data-tool` in one `@bound` handler — no inline arrows.
 */
export class ToolsOverlay extends PureReactor {
  @prop declare showTools: boolean;
  @prop declare toolsMenuStyle: { left: number; top: number; width: number } | null;
  @prop declare toolsDropdownRef: Ref<HTMLDivElement>;
  @prop declare availableTools: IAssistantToolOption[];
  @prop declare selectedTools: string[];
  @prop declare setSelectedTools: Dispatch<SetStateAction<string[]>>;
  @prop declare toggleTool: (toolName: string) => void;
  @prop declare getToolHelp: (toolName: string, providedDescription?: string) => string;

  @bound
  protected selectAll(): void {
    this.setSelectedTools(this.availableTools.map((tool) => tool.tool));
  }

  @bound
  protected selectNone(): void {
    this.setSelectedTools([]);
  }

  @bound
  protected onToggleTool(event: ReactMouseEvent<HTMLButtonElement>): void {
    this.toggleTool(event.currentTarget.dataset.tool ?? '');
  }

  private renderTool(tool: IAssistantToolOption): ReactNode {
    const checked = this.selectedTools.includes(tool.tool);
    const help = this.getToolHelp(tool.tool, tool.description);
    return (
      <button
        key={tool.tool}
        type="button"
        data-tool={tool.tool}
        onClick={this.onToggleTool}
        className={`mb-1 w-full rounded-lg border px-2 py-1.5 text-left transition last:mb-0 ${
          checked
            ? 'border-indigo-300 bg-indigo-50 text-indigo-900 dark:border-indigo-300/50 dark:bg-indigo-300/14 dark:text-indigo-100'
            : 'border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-800/60'
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold">{tool.tool}</span>
          {tool.readOnly ? (
            <span className="rounded-full border border-slate-300 px-1.5 py-0.5 text-[9px] text-slate-500 dark:border-slate-600 dark:text-slate-400">
              read
            </span>
          ) : (
            <span className="rounded-full border border-amber-300 px-1.5 py-0.5 text-[9px] text-amber-700 dark:border-amber-300/50 dark:text-amber-200">
              write
            </span>
          )}
        </div>
        <p className="mt-0.5 line-clamp-2 text-[10px] text-slate-500 dark:text-slate-400">{help}</p>
      </button>
    );
  }

  render(): ReactNode {
    if (!this.showTools || !this.toolsMenuStyle || !Platform.isBrowser) return null;
    const style = this.toolsMenuStyle;
    return this.portal(
      <div
        ref={this.toolsDropdownRef}
        style={{ left: style.left, top: style.top, width: style.width }}
        className="fixed z-[120] overflow-hidden rounded-xl border border-white/58 bg-white/74 shadow-[0_20px_45px_rgba(2,6,23,0.24)] backdrop-blur-2xl dark:border-white/12 dark:bg-slate-900/72"
      >
        <div className="border-b border-slate-200 px-3 py-2 dark:border-slate-700">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">Tool Permissions</span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={this.selectAll}
                className="rounded-md border border-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-white"
              >
                All
              </button>
              <button
                type="button"
                onClick={this.selectNone}
                className="rounded-md border border-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-white"
              >
                None
              </button>
            </div>
          </div>
          <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">Choose what Atlantis Intelligence is allowed to use in this chat.</p>
        </div>
        <div className="max-h-64 overflow-y-auto p-1.5">
          {this.availableTools.length === 0 ? (
            <p className="px-2 py-2 text-[11px] text-slate-500 dark:text-slate-400">No tools available.</p>
          ) : (
            this.availableTools.map((tool) => this.renderTool(tool))
          )}
        </div>
      </div>,
      document.body,
    );
  }
}
