'use client';

import React from 'react';
import { AssistantPlanUtils } from '../assistant-plan-utils';
import { AssistantSurfaceUtils } from '../assistant-surface-utils';
import { AssistantExecutionResult } from './assistant-execution-result';
import type { AssistantExecutionCardProps } from './assistant-conversation.interfaces';

export function AssistantExecutionCard({ entry }: AssistantExecutionCardProps) {
  if (!entry.execution) {
    return null;
  }

  const results = Array.isArray(entry.execution.results) ? entry.execution.results : [];
  const okCount = results.filter((item) => AssistantSurfaceUtils.resolveExecutionKind(item) === 'ok').length;
  const skippedCount = results.filter((item) => AssistantSurfaceUtils.resolveExecutionKind(item) === 'skipped').length;
  const failedCount = results.filter((item) => AssistantSurfaceUtils.resolveExecutionKind(item) === 'failed').length;
  const summary = AssistantPlanUtils.buildExecutionCardSummary(entry.execution);

  return (
    <div className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50/90 p-2.5 text-[11px] text-slate-700 dark:border-white/10 dark:bg-black/25 dark:text-slate-300">
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className="font-semibold text-slate-900 dark:text-white">{entry.execution.dryRun ? 'Preview results' : 'Execution results'} ({results.length})</span>
          <span className="rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:border-emerald-300/45 dark:bg-emerald-300/14 dark:text-emerald-100">{okCount} ok</span>
          <span className="rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:border-slate-600 dark:bg-slate-800/70 dark:text-slate-200">{skippedCount} unchanged</span>
          <span className="rounded-full border border-rose-300 bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-800 dark:border-rose-300/45 dark:bg-rose-300/14 dark:text-rose-100">{failedCount} failed</span>
        </div>
        <p><span className="font-semibold text-slate-900 dark:text-slate-100">What changed:</span> {summary.changed}</p>
        <p><span className="font-semibold text-slate-900 dark:text-slate-100">Where it changed:</span> {summary.where}</p>
        <p><span className="font-semibold text-slate-900 dark:text-slate-100">Result status:</span> {summary.status}</p>
      </div>
      <p className="text-[10px] text-slate-500 dark:text-slate-400">{entry.execution.dryRun ? 'Preview is data-safe: nothing was written. Review changed fields and optionally open affected pages.' : 'Changes were executed. Review result details and affected pages below.'}</p>
      {results.length > 0 ? (
        <details className="rounded-lg border border-slate-200 bg-white/80 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-950/55">
          <summary className="cursor-pointer text-[11px] font-semibold text-slate-700 dark:text-slate-200">Details ({results.length})</summary>
          <div className="mt-2 space-y-2">
            {results.map((item, resultIndex) => <AssistantExecutionResult key={`execution-${resultIndex}`} item={item} resultIndex={resultIndex} />)}
          </div>
        </details>
      ) : null}
    </div>
  );
}
