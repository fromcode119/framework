'use client';

import React from 'react';
import { FrameworkIcons } from '@fromcode119/react';
import { GlassMorphism } from '../ui/glass-morphism';
import type { AssistantActionCardProps } from './assistant-action-card.interfaces';
import { AssistantActionCardUtils } from './assistant-action-card-utils';

export function AssistantActionCard({
  batch,
  actions,
  selectedIndexes,
  onToggleAction,
  onSelectAll,
  onDeselectAll,
  onPreview,
  onApply,
  isRunning,
  executionSummary,
  mode,
  placement = 'bottom',
  bottomOffset = 16,
}: AssistantActionCardProps) {
  if (!batch || !Array.isArray(actions) || actions.length === 0) return null;

  const selectedCount = selectedIndexes.filter((index) => index >= 0 && index < actions.length).length;
  const allSelected = selectedCount === actions.length;
  const canPreview = batch.state === 'staged' && selectedCount > 0 && !isRunning;
  const canApply = batch.state === 'previewed' && selectedCount > 0 && !isRunning;

  const placementClasses =
    placement === 'bottom'
      ? 'absolute inset-x-0 z-30 flex justify-center px-3'
      : 'sticky top-[72px] z-30 mx-auto mb-3 w-full max-w-3xl px-4 sm:px-8';

  return (
    <div className={placementClasses} style={placement === 'bottom' ? { bottom: `${Math.max(bottomOffset, 8)}px` } : undefined}>
      <div className={`${GlassMorphism.GLASS_FLOAT_CHROME} pointer-events-auto w-full max-w-3xl p-3`}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">Changes ready for review</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              <span className={GlassMorphism.GLASS_BADGE}>Batch {batch.id.slice(0, 12)}</span>
              <span className={GlassMorphism.GLASS_BADGE}>{batch.state}</span>
              {mode === 'build' ? <span className={GlassMorphism.GLASS_BADGE}>Preview first</span> : null}
            </p>
          </div> 
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={allSelected ? onDeselectAll : onSelectAll}
              disabled={batch.state === 'applied' || batch.state === 'stale'}
              className={`${GlassMorphism.GLASS_BUTTON} px-2 py-1 text-[10px] font-semibold`}
            >
              {allSelected ? 'None' : 'All'}
            </button>
            {batch.state === 'staged' ? (
              <button
                type="button"
                onClick={() => void onPreview()}
                disabled={!canPreview}
                className={`${GlassMorphism.GLASS_BUTTON} gap-1 px-2.5 py-1.5 text-[11px] font-semibold`}
              >
                <FrameworkIcons.Eye size={12} /> Preview
              </button>
            ) : null}
            {batch.state === 'previewed' ? (
              <button
                type="button"
                onClick={() => void onApply()}
                disabled={!canApply}
                className={`${GlassMorphism.GLASS_BUTTON_PRIMARY} gap-1 px-2.5 py-1.5 text-[11px]`}
              >
                <FrameworkIcons.Check size={12} /> Apply
              </button>
            ) : null}
          </div>
        </div>

        {batch.state === 'applied' ? (
          <div className={`${GlassMorphism.GLASS_SUB_PANEL} border-emerald-300/70 bg-emerald-50/90 px-2.5 py-2 text-[11px] text-emerald-900 dark:border-emerald-300/40 dark:bg-emerald-300/12 dark:text-emerald-100`}>
            Applied. {executionSummary ? `${executionSummary.ok} ok • ${executionSummary.unchanged} unchanged • ${executionSummary.failed} failed` : 'Review execution details in the conversation.'}
          </div>
        ) : null}

        {batch.state === 'stale' ? (
          <div className={`${GlassMorphism.GLASS_SUB_PANEL} border-amber-300/70 bg-amber-50/90 px-2.5 py-2 text-[11px] text-amber-900 dark:border-amber-300/40 dark:bg-amber-300/12 dark:text-amber-100`}>
            This batch is stale. Request a fresh batch before preview/apply.
          </div>
        ) : (
          <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
            {actions.map((action, index) => {
              const checked = selectedIndexes.includes(index);
              const summary = AssistantActionCardUtils.summarize(action);
              return (
                <label
                  key={`sticky-action-${index}`}
                  className={`${GlassMorphism.GLASS_SUB_PANEL} flex cursor-pointer items-start gap-2 px-2.5 py-2`}
                >
                  <div className="mt-0.5 relative h-4 w-4 shrink-0">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggleAction(index)}
                      disabled={batch.state === 'applied' || batch.state === 'stale'}
                      className="peer sr-only"
                    />
                    <div
                      className={`h-4 w-4 rounded border transition ${
                        batch.state === 'applied' || batch.state === 'stale'
                          ? 'cursor-not-allowed opacity-60'
                          : ''
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
            })}
          </div>
        )}
      </div>
    </div>
  );
}
