'use client';

import React from 'react';
import { FrameworkIcons } from '@fromcode119/react';
import { GlassMorphism } from '../ui/glass-morphism';
import { AssistantFormatUtils } from '../assistant-format-utils';
import { AssistantIntentUtils } from '../assistant-intent-utils';
import { AssistantPlanUtils } from '../assistant-plan-utils';
import type { AssistantActionSummaryProps } from './assistant-conversation.interfaces';

export function AssistantActionSummary({ entry, setChatMode }: AssistantActionSummaryProps) {
  const needsClarification = entry.ui?.needsClarification === true;
  const loopRecoveryMode = entry.ui?.loopRecoveryMode || 'none';
  const showPlanningState = entry.role === 'assistant' && (needsClarification || loopRecoveryMode === 'best_effort' || entry.ui?.canContinue || (entry.loopCapReached && (!entry.actions || entry.actions.length === 0)));

  const planningTitle = needsClarification
    ? loopRecoveryMode === 'best_effort'
      ? 'Draft ready, target needed'
      : 'Need one detail to continue'
    : loopRecoveryMode === 'best_effort'
      ? 'Draft ready; confirm target to apply'
      : 'Need one detail to finish';

  const planningBody = needsClarification
    ? String(entry.ui?.clarifyingQuestion || '').trim() || 'Share one missing detail to continue.'
    : 'Share collection + record id/slug + field path + new value.';

  return (
    <>
      {entry.role === 'assistant' && entry.plan && AssistantIntentUtils.shouldShowPlanCard(entry) ? (
        <div className={`${GlassMorphism.GLASS_SUB_PANEL} mt-2 p-2.5`}>
          {(() => {
            const summary = AssistantPlanUtils.buildPlanCardSummary(entry);
            return (
              <>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-100">{entry.plan.previewReady ? 'Planning complete' : 'Planning in progress'}</p>
                  <span className="rounded-full border border-white/65 bg-white/72 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-600 dark:border-white/14 dark:bg-slate-900/50 dark:text-slate-300">{String(entry.plan.status || 'draft').replace(/_/g, ' ')}</span>
                  <span className="rounded-full border border-white/65 bg-white/72 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-600 dark:border-white/14 dark:bg-slate-900/50 dark:text-slate-300">risk {entry.plan.risk || 'low'}</span>
                </div>
                <div className="space-y-1.5 text-[11px] text-slate-700 dark:text-slate-200">
                  <p><span className="font-semibold text-slate-900 dark:text-slate-100">Goal:</span> {summary.goal}</p>
                  <p><span className="font-semibold text-slate-900 dark:text-slate-100">What I found:</span> {summary.found}</p>
                  <p><span className="font-semibold text-slate-900 dark:text-slate-100">What I propose:</span> {summary.propose}</p>
                  <p><span className="font-semibold text-slate-900 dark:text-slate-100">What needs your approval:</span> {summary.approval}</p>
                </div>
              </>
            );
          })()}
        </div>
      ) : null}
      {AssistantIntentUtils.isPlanGuidanceMessage(entry) ? (
        <div className={`${GlassMorphism.GLASS_SUB_PANEL} mt-2 p-2`}>
          <p className="text-[11px] font-semibold">Ready to review these changes?</p>
          <p className="mt-0.5 text-[10px] text-[var(--text-sub)]">Switch to Build mode and I will prepare clear changes for your approval.</p>
          <div className="mt-1.5 flex items-center gap-1.5">
            <button type="button" onClick={() => setChatMode('plan')} className="inline-flex h-7 items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 text-[10px] font-semibold text-[var(--text-main)] transition hover:bg-[var(--surface-strong)]">
              <FrameworkIcons.ListChecks size={11} />
              <span>Switch To Build</span>
            </button>
          </div>
        </div>
      ) : null}
      {showPlanningState ? (
        <div className={`${GlassMorphism.GLASS_SUB_PANEL} mt-2 p-2`}>
          <p className="text-[11px] font-semibold">{planningTitle}</p>
          <p className="mt-0.5 text-[10px] text-[var(--text-sub)]">{planningBody}</p>
        </div>
      ) : null}
      {Array.isArray(entry.actions) && entry.actions.length > 0 ? (
        <div className={`${GlassMorphism.GLASS_SUB_PANEL} mt-3 space-y-2 p-2`}>
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <p className="text-[11px] font-semibold text-[var(--text-main)]">I found {entry.actions.length} change{entry.actions.length > 1 ? 's' : ''} ready for review.</p>
            {(entry.actionBatch?.state || 'staged') ? <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--text-sub)]">{entry.actionBatch?.state || 'staged'}</span> : null}
          </div>
          <div className="space-y-1.5">
            {entry.actions.map((action, actionIndex) => {
              const preview = AssistantFormatUtils.summarizeActionForHumans(action);
              return (
                <div key={`action-readonly-${actionIndex}`} className={`${GlassMorphism.GLASS_SUB_PANEL} px-3 py-2`}>
                  <p className="truncate text-[10px] font-semibold text-[var(--text-main)]">{preview.title}</p>
                  <p className="mt-0.5 text-[9px] text-[var(--text-sub)]">Target: {preview.target}</p>
                  <p className="mt-0.5 text-[9px] text-[var(--text-sub)]">{preview.summary}</p>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </>
  );
}
