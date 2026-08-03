import { AssistantRole } from '@ai/enums/assistant-role.enum';
import { ClarifyMode } from '@ai/api/forge/enums/clarify-mode.enum';
import { ChatMode } from '@ai/enums/chat-mode.enum';
import { ComplexityTier } from '@ai/api/forge/enums/complexity-tier.enum';
import type { Dispatch, ReactNode, SetStateAction } from 'react';
import { PureReactor, prop, bound } from '@fromcode119/reactor';
import { FrameworkIcons } from '@fromcode119/react';
import { GlassMorphism } from '@ai/ui/glass-morphism';
import { AssistantFormatUtils } from '@ai/assistant-format-utils';
import { AssistantIntentUtils } from '@ai/assistant-intent-utils';
import { AssistantPlanUtils } from '@ai/assistant-plan-utils';
import { BatchState } from '@ai/components/enums/batch-state.enum';
import type { IAssistantMessage } from '@ai/interfaces/assistant-message.interface';
import type { IAssistantAction } from '@ai/interfaces/assistant-action.interface';

export class AssistantActionSummary extends PureReactor {
  @prop declare entry: IAssistantMessage;
  @prop declare setChatMode: Dispatch<SetStateAction<ChatMode>>;

  private get needsClarification(): boolean {
    return this.entry.ui?.needsClarification === true;
  }

  private get loopRecoveryMode(): ClarifyMode {
    return this.entry.ui?.loopRecoveryMode ?? ClarifyMode.NONE;
  }

  private get showPlanningState(): boolean {
    return this.entry.role === AssistantRole.ASSISTANT && (this.needsClarification || this.loopRecoveryMode === ClarifyMode.BEST_EFFORT || !!this.entry.ui?.canContinue || (!!this.entry.loopCapReached && (!this.entry.actions || this.entry.actions.length === 0)));
  }

  private get planningTitle(): string {
    return this.needsClarification
      ? this.loopRecoveryMode === ClarifyMode.BEST_EFFORT
        ? 'Draft ready, target needed'
        : 'Need one detail to continue'
      : this.loopRecoveryMode === ClarifyMode.BEST_EFFORT
        ? 'Draft ready; confirm target to apply'
        : 'Need one detail to finish';
  }

  private get planningBody(): string {
    return this.needsClarification
      ? String(this.entry.ui?.clarifyingQuestion || '').trim() || 'Share one missing detail to continue.'
      : 'Share collection + record id/slug + field path + new value.';
  }

  private get showPlanCard(): boolean {
    return this.entry.role === AssistantRole.ASSISTANT && !!this.entry.plan && AssistantIntentUtils.shouldShowPlanCard(this.entry);
  }

  private get hasActions(): boolean {
    return Array.isArray(this.entry.actions) && this.entry.actions.length > 0;
  }

  @bound
  protected onSwitchToBuild(): void {
    this.setChatMode(ChatMode.PLAN);
  }

  private renderPlanCard(): ReactNode {
    const plan = this.entry.plan;
    if (!plan) return null;
    const summary = AssistantPlanUtils.buildPlanCardSummary(this.entry);
    return (
      <div className={`${GlassMorphism.GLASS_SUB_PANEL} mt-2 p-2.5`}>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-100">{plan.previewReady ? 'Planning complete' : 'Planning in progress'}</p>
          <span className="rounded-full border border-white/65 bg-white/72 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-600 dark:border-white/14 dark:bg-slate-900/50 dark:text-slate-300">{String(plan.status || 'draft').replace(/_/g, ' ')}</span>
          <span className="rounded-full border border-white/65 bg-white/72 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-600 dark:border-white/14 dark:bg-slate-900/50 dark:text-slate-300">risk {(plan.risk ?? ComplexityTier.LOW).value}</span>
        </div>
        <div className="space-y-1.5 text-[11px] text-slate-700 dark:text-slate-200">
          <p><span className="font-semibold text-slate-900 dark:text-slate-100">Goal:</span> {summary.goal}</p>
          <p><span className="font-semibold text-slate-900 dark:text-slate-100">What I found:</span> {summary.found}</p>
          <p><span className="font-semibold text-slate-900 dark:text-slate-100">What I propose:</span> {summary.propose}</p>
          <p><span className="font-semibold text-slate-900 dark:text-slate-100">What needs your approval:</span> {summary.approval}</p>
        </div>
      </div>
    );
  }

  private renderPlanGuidance(): ReactNode {
    return (
      <div className={`${GlassMorphism.GLASS_SUB_PANEL} mt-2 p-2`}>
        <p className="text-[11px] font-semibold">Ready to review these changes?</p>
        <p className="mt-0.5 text-[10px] text-[var(--text-sub)]">Switch to Build mode and I will prepare clear changes for your approval.</p>
        <div className="mt-1.5 flex items-center gap-1.5">
          <button type="button" onClick={this.onSwitchToBuild} className="inline-flex h-7 items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-[10px] font-semibold text-[var(--text-main)] transition hover:bg-[var(--surface-strong)]">
            <FrameworkIcons.ListChecks size={11} />
            <span>Switch To Build</span>
          </button>
        </div>
      </div>
    );
  }

  private renderPlanningState(): ReactNode {
    return (
      <div className={`${GlassMorphism.GLASS_SUB_PANEL} mt-2 p-2`}>
        <p className="text-[11px] font-semibold">{this.planningTitle}</p>
        <p className="mt-0.5 text-[10px] text-[var(--text-sub)]">{this.planningBody}</p>
      </div>
    );
  }

  private renderActionItem(action: IAssistantAction, actionIndex: number): ReactNode {
    const preview = AssistantFormatUtils.summarizeActionForHumans(action);
    return (
      <div key={`action-readonly-${actionIndex}`} className={`${GlassMorphism.GLASS_SUB_PANEL} px-3 py-2`}>
        <p className="truncate text-[10px] font-semibold text-[var(--text-main)]">{preview.title}</p>
        <p className="mt-0.5 text-[9px] text-[var(--text-sub)]">Target: {preview.target}</p>
        <p className="mt-0.5 text-[9px] text-[var(--text-sub)]">{preview.summary}</p>
      </div>
    );
  }

  private renderActions(): ReactNode {
    const actions = this.entry.actions ?? [];
    return (
      <div className={`${GlassMorphism.GLASS_SUB_PANEL} mt-3 space-y-2 p-2`}>
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <p className="text-[11px] font-semibold text-[var(--text-main)]">I found {actions.length} change{actions.length > 1 ? 's' : ''} ready for review.</p>
          <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--text-sub)]">{(this.entry.actionBatch?.state ?? BatchState.STAGED).value}</span>
        </div>
        <div className="space-y-1.5">
          {actions.map((action, actionIndex) => this.renderActionItem(action, actionIndex))}
        </div>
      </div>
    );
  }

  render(): ReactNode {
    return (
      <>
        {this.showPlanCard ? this.renderPlanCard() : null}
        {AssistantIntentUtils.isPlanGuidanceMessage(this.entry) ? this.renderPlanGuidance() : null}
        {this.showPlanningState ? this.renderPlanningState() : null}
        {this.hasActions ? this.renderActions() : null}
      </>
    );
  }
}
