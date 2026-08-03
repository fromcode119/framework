import type { ChangeEvent, CSSProperties, ReactNode } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/reactor';
import { FrameworkIcons } from '@fromcode119/react';
import { GlassMorphism } from '@ai/ui/glass-morphism';
import { AssistantActionCardUtils } from '@ai/components/assistant-action-card-utils';
import { BatchState } from '@ai/components/enums/batch-state.enum';
import type { IAssistantActionBatch } from '@ai/interfaces/assistant-action-batch.interface';
import type { IAssistantAction } from '@ai/interfaces/assistant-action.interface';
import { ConversationMode } from '@ai/enums/conversation-mode.enum';

export class AssistantActionCard extends PureReactor {
  @prop declare batch?: IAssistantActionBatch;
  @prop declare actions: IAssistantAction[];
  @prop declare selectedIndexes: number[];
  @prop declare onToggleAction: (index: number) => void;
  @prop declare onSelectAll: () => void;
  @prop declare onDeselectAll: () => void;
  @prop declare onPreview: () => Promise<void>;
  @prop declare onApply: () => Promise<void>;
  @prop declare isRunning: boolean;
  @prop declare executionSummary?: { ok: number; unchanged: number; failed: number };
  @prop declare mode: ConversationMode;
  @prop declare placement?: 'bottom';
  @prop declare bottomOffset?: number;

  private get resolvedPlacement(): 'bottom' {
    return this.placement ?? 'bottom';
  }

  private get resolvedBottomOffset(): number {
    return this.bottomOffset ?? 16;
  }

  private get selectedCount(): number {
    return this.selectedIndexes.filter((index) => index >= 0 && index < this.actions.length).length;
  }

  private get batchState(): BatchState {
    return this.batch?.state ?? BatchState.STAGED;
  }

  private get allSelected(): boolean {
    return this.selectedCount === this.actions.length;
  }

  private get canPreview(): boolean {
    return this.batchState.allowsPreview && this.selectedCount > 0 && !this.isRunning;
  }

  private get canApply(): boolean {
    return this.batchState.allowsApply && this.selectedCount > 0 && !this.isRunning;
  }

  private get isLocked(): boolean {
    return this.batchState.isLocked;
  }

  private get placementClasses(): string {
    return this.resolvedPlacement === 'bottom'
      ? 'absolute inset-x-0 z-30 flex justify-center px-3'
      : 'sticky top-[72px] z-30 mx-auto mb-3 w-full max-w-3xl px-4 sm:px-8';
  }

  private get containerStyle(): CSSProperties | undefined {
    return this.resolvedPlacement === 'bottom' ? { bottom: `${Math.max(this.resolvedBottomOffset, 8)}px` } : undefined;
  }

  @bound
  protected onToggleSelectAll(): void {
    if (this.allSelected) {
      this.onDeselectAll();
    } else {
      this.onSelectAll();
    }
  }

  @bound
  protected onPreviewClick(): void {
    void this.onPreview();
  }

  @bound
  protected onApplyClick(): void {
    void this.onApply();
  }

  @bound
  protected onToggleActionChange(event: ChangeEvent<HTMLInputElement>): void {
    this.onToggleAction(Number(event.currentTarget.dataset.index));
  }

  private renderAction(action: IAssistantAction, index: number): ReactNode {
    const checked = this.selectedIndexes.includes(index);
    const summary = AssistantActionCardUtils.summarize(action);
    return (
      <label
        key={`sticky-action-${index}`}
        className={`${GlassMorphism.GLASS_SUB_PANEL} flex cursor-pointer items-start gap-2 px-2.5 py-2`}
      >
        <div className="mt-0.5 relative h-4 w-4 shrink-0">
          <input
            type="checkbox"
            data-index={index}
            checked={checked}
            onChange={this.onToggleActionChange}
            disabled={this.isLocked}
            className="peer sr-only"
          />
          <div
            className={`h-4 w-4 rounded border transition ${
              this.isLocked ? 'cursor-not-allowed opacity-60' : ''
            } border-[var(--border)] bg-[var(--surface)] peer-checked:border-[var(--text-main)] peer-checked:bg-[var(--text-main)]`}
          />
          <FrameworkIcons.Check
            size={10}
            className="pointer-events-none absolute left-[3px] top-[3px] text-[var(--bg)] opacity-0 transition peer-checked:opacity-100"
          />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold text-slate-800 dark:text-slate-100">{summary.title}</p>
          <p className="truncate text-[10px] text-slate-600 dark:text-slate-300">{summary.detail}</p>
        </div>
      </label>
    );
  }

  private renderBody(): ReactNode {
    if (this.batchState === BatchState.APPLIED) {
      return (
        <div className={`${GlassMorphism.GLASS_SUB_PANEL} border-emerald-300/70 bg-emerald-50/90 px-2.5 py-2 text-[11px] text-emerald-900 dark:border-emerald-300/40 dark:bg-emerald-300/12 dark:text-emerald-100`}>
          Applied. {this.executionSummary ? `${this.executionSummary.ok} ok • ${this.executionSummary.unchanged} unchanged • ${this.executionSummary.failed} failed` : 'Review execution details in the conversation.'}
        </div>
      );
    }

    if (this.batchState === BatchState.STALE) {
      return (
        <div className={`${GlassMorphism.GLASS_SUB_PANEL} border-amber-300/70 bg-amber-50/90 px-2.5 py-2 text-[11px] text-amber-900 dark:border-amber-300/40 dark:bg-amber-300/12 dark:text-amber-100`}>
          This batch is stale. Request a fresh batch before preview/apply.
        </div>
      );
    }

    return (
      <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
        {this.actions.map((action, index) => this.renderAction(action, index))}
      </div>
    );
  }

  render(): ReactNode {
    if (!this.batch || !Array.isArray(this.actions) || this.actions.length === 0) return null;

    return (
      <div className={this.placementClasses} style={this.containerStyle}>
        <div className={`${GlassMorphism.GLASS_FLOAT_CHROME} pointer-events-auto w-full max-w-3xl p-3`}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">Changes ready for review</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                <span className={GlassMorphism.GLASS_BADGE}>Batch {this.batch.id.slice(0, 12)}</span>
                <span className={GlassMorphism.GLASS_BADGE}>{this.batchState.value}</span>
                {this.mode === ConversationMode.BUILD ? <span className={GlassMorphism.GLASS_BADGE}>Preview first</span> : null}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={this.onToggleSelectAll}
                disabled={this.isLocked}
                className={`${GlassMorphism.GLASS_BUTTON} px-2 py-1 text-[10px] font-semibold`}
              >
                {this.allSelected ? 'None' : 'All'}
              </button>
              {this.batchState === BatchState.STAGED ? (
                <button
                  type="button"
                  onClick={this.onPreviewClick}
                  disabled={!this.canPreview}
                  className={`${GlassMorphism.GLASS_BUTTON} gap-1 px-2.5 py-1.5 text-[11px] font-semibold`}
                >
                  <FrameworkIcons.Eye size={12} /> Preview
                </button>
              ) : null}
              {this.batchState === BatchState.PREVIEWED ? (
                <button
                  type="button"
                  onClick={this.onApplyClick}
                  disabled={!this.canApply}
                  className={`${GlassMorphism.GLASS_BUTTON_PRIMARY} gap-1 px-2.5 py-1.5 text-[11px]`}
                >
                  <FrameworkIcons.Check size={12} /> Apply
                </button>
              ) : null}
            </div>
          </div>

          {this.renderBody()}
        </div>
      </div>
    );
  }
}
