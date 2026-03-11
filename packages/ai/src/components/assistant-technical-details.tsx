'use client';

import React from 'react';
import type { AssistantTechnicalDetailsProps } from './assistant-conversation.interfaces';

export function AssistantTechnicalDetails({ entry, showTechnicalDetails }: AssistantTechnicalDetailsProps) {
  if (!showTechnicalDetails) {
    return null;
  }

  return (
    <>
      {entry.role === 'assistant' && entry.traces && entry.traces.length > 0 && !entry.plan ? (
        <details className="mt-3 rounded-xl border border-slate-200 bg-slate-50/90 px-2.5 py-2 dark:border-slate-700 dark:bg-slate-900/55" open>
          <summary className="cursor-pointer text-[11px] font-semibold text-slate-700 dark:text-slate-200">
            Behind the scenes ({entry.traces.length} step{entry.traces.length > 1 ? 's' : ''})
            {entry.loopCapReached ? ' • paused' : ''}
          </summary>
          <div className="mt-2 space-y-2">
            {entry.traces.map((trace, traceIndex) => (
              <div key={`trace-${trace.iteration}-${traceIndex}`} className="rounded-lg border border-slate-200 bg-white/90 px-2 py-1.5 text-[11px] dark:border-slate-700 dark:bg-slate-950/65">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">Step {trace.iteration}</span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">
                    {Array.isArray(trace.toolCalls) ? `${trace.toolCalls.length} tool call${trace.toolCalls.length === 1 ? '' : 's'}` : '0 tool calls'}
                  </span>
                </div>
                {trace.message ? <p className="whitespace-pre-wrap break-words text-slate-600 dark:text-slate-300">{trace.message}</p> : null}
                {Array.isArray(trace.toolCalls) && trace.toolCalls.length > 0 ? (
                  <div className="mt-1.5 space-y-1.5">
                    {trace.toolCalls.map((call, callIndex) => (
                      <div key={`trace-call-${traceIndex}-${callIndex}`} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 dark:border-slate-700 dark:bg-black/25">
                        <p className="font-semibold text-slate-700 dark:text-slate-200">{call.tool || 'tool'}</p>
                        {call.input ? <pre className="mt-1 overflow-auto text-[10px] text-slate-600 dark:text-slate-300"><code>{JSON.stringify(call.input, null, 2)}</code></pre> : null}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </details>
      ) : null}
      {entry.role === 'assistant' && entry.reasoningReport ? (
        <details className="mt-2 rounded-xl border border-slate-200 bg-slate-50/90 px-2.5 py-2 dark:border-slate-700 dark:bg-slate-900/55" open>
          <summary className="cursor-pointer text-[11px] font-semibold text-[var(--text-main)]">Thinking summary</summary>
          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-slate-200 bg-white/90 p-2 text-[10px] leading-relaxed text-slate-700 dark:border-slate-700 dark:bg-slate-950/65 dark:text-slate-200">
            {entry.reasoningReport}
          </pre>
        </details>
      ) : null}
    </>
  );
}
