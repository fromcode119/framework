'use client';

import React from 'react';
import { FrameworkIcons } from '@fromcode119/react';
import { Select } from './ui/select';
import {
  MAX_PROMPT_LENGTH,
  PROVIDER_OPTIONS,
  splitMessageBlocks,
  renderText,
  formatActionLabel,
  formatFileSize,
  isPlanGuidanceMessage,
  shouldShowPlanCard,
  shouldHideAssistantBody,
  buildPlanCardSummary,
  buildExecutionCardSummary,
  resolveExecutionSurface,
  surfaceLabel,
  surfaceBadgeClass,
  resolveExecutionKind,
  formatExecutionTitle,
  formatExecutionDetail,
  toAbsolutePreviewUrl,
  resolveExecutionPreviewPaths,
  formatPreviewValue,
} from './admin-assistant-core';
import type { AssistantAction, AssistantMessage, UploadedAttachment } from './admin-assistant-core';

interface ForgeTopBarProps {
  provider: string;
  model: string;
  chatMode: 'auto' | 'plan' | 'agent';
  sandboxMode: boolean;
  showComposerControls: boolean;
  setShowComposerControls: React.Dispatch<React.SetStateAction<boolean>>;
  openAdvancedWorkspace: () => void;
  toggleThemeMode: () => void;
  themeMode: 'light' | 'dark';
  showGateway: boolean;
  setShowGateway: React.Dispatch<React.SetStateAction<boolean>>;
  showHistory: boolean;
  setShowHistory: React.Dispatch<React.SetStateAction<boolean>>;
}

export function ForgeTopBar({
  provider,
  model,
  chatMode,
  sandboxMode,
  showComposerControls,
  setShowComposerControls,
  openAdvancedWorkspace,
  toggleThemeMode,
  themeMode,
  showGateway,
  setShowGateway,
  showHistory,
  setShowHistory,
}: ForgeTopBarProps) {
  return (
    <div className="fixed right-4 top-4 z-40 flex justify-end sm:right-6 sm:top-6">
      <div className="flex max-w-[92vw] items-center gap-2 rounded-xl border border-slate-200/85 bg-white/92 p-1.5 shadow-[0_8px_28px_rgba(15,23,42,0.16)] backdrop-blur-xl dark:border-slate-700/80 dark:bg-slate-950/78 dark:shadow-[0_12px_32px_rgba(2,6,23,0.62)]">
        <div className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 dark:border-slate-700 dark:bg-slate-900/70">
          <button
            type="button"
            className="inline-flex h-7 items-center gap-1 rounded-md bg-slate-900 px-2 text-[10px] font-semibold text-white transition dark:bg-white/18"
            title="Forge mode"
          >
            <FrameworkIcons.Home size={11} />
            <span>Forge</span>
          </button>
          <button
            type="button"
            onClick={openAdvancedWorkspace}
            className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[10px] font-semibold text-slate-600 transition hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
            title="Open advanced admin"
          >
            <FrameworkIcons.Settings size={11} />
            <span>Advanced</span>
          </button>
        </div>
        <span className="hidden rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300 sm:inline-flex">
          {provider}
          {model ? ` • ${model}` : ''}
        </span>
        <span className="hidden rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold capitalize text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300 md:inline-flex">
          {chatMode}
          {sandboxMode ? ' • preview' : ' • live'}
        </span>
        <button
          type="button"
          onClick={() => setShowComposerControls((prev) => !prev)}
          className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition ${
            showComposerControls
              ? 'border-cyan-400/70 bg-cyan-100 text-cyan-900 dark:border-cyan-300/60 dark:bg-cyan-300/20 dark:text-cyan-100'
              : 'border-slate-200 bg-white text-slate-600 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:text-white'
          }`}
          title="Toggle composer controls"
          aria-label="Toggle composer controls"
        >
          <FrameworkIcons.More size={12} />
        </button>
        <button
          type="button"
          onClick={toggleThemeMode}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:text-white"
          title={`Switch to ${themeMode === 'dark' ? 'light' : 'dark'} mode`}
        >
          {themeMode === 'dark' ? <FrameworkIcons.Sun size={12} /> : <FrameworkIcons.Moon size={12} />}
        </button>
        <button
          type="button"
          onClick={() => {
            setShowGateway((prev) => !prev);
            setShowHistory(false);
          }}
          className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition ${
            showGateway
              ? 'border-cyan-400/70 bg-cyan-100 text-cyan-900 dark:border-cyan-300/60 dark:bg-cyan-300/20 dark:text-cyan-100'
              : 'border-slate-200 bg-white text-slate-600 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:text-white'
          }`}
          title="Toggle gateway settings"
          aria-label="Toggle gateway settings"
        >
          <FrameworkIcons.Key size={13} />
        </button>
        <button
          type="button"
          onClick={() => {
            setShowHistory((prev) => !prev);
            setShowGateway(false);
          }}
          className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border transition ${
            showHistory
              ? 'border-cyan-400/70 bg-cyan-100 text-cyan-900 dark:border-cyan-300/60 dark:bg-cyan-300/20 dark:text-cyan-100'
              : 'border-slate-200 bg-white text-slate-600 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:text-white'
          }`}
          title="Toggle history"
          aria-label="Toggle history"
        >
          <FrameworkIcons.Clock size={13} />
        </button>
      </div>
    </div>
  );
}

interface ForgeConversationProps {
  viewportRef: React.RefObject<HTMLDivElement | null>;
  viewportBottomPadding: number;
  hasConversation: boolean;
  visibleMessages: AssistantMessage[];
  lastActions: AssistantAction[];
  forkFromVisibleMessage: (index: number) => void;
  setChatMode: React.Dispatch<React.SetStateAction<'auto' | 'plan' | 'agent'>>;
  continuePlanning: () => Promise<void>;
  runActions: (options?: { dryRun?: boolean; invokedByApproval?: boolean }) => Promise<void>;
  sandboxMode: boolean;
  executing: boolean;
  selectedActionCount: number;
  selectedActionIndexes: number[];
  setSelectedActionIndexes: React.Dispatch<React.SetStateAction<number[]>>;
  toggleActionIndex: (actionIndex: number) => void;
  loading: boolean;
  loadingPhaseLabel: string;
  scrollAnchorRef: React.RefObject<HTMLDivElement | null>;
}

export function ForgeConversation({
  viewportRef,
  viewportBottomPadding,
  hasConversation,
  visibleMessages,
  lastActions,
  forkFromVisibleMessage,
  setChatMode,
  continuePlanning,
  runActions,
  sandboxMode,
  executing,
  selectedActionCount,
  selectedActionIndexes,
  setSelectedActionIndexes,
  toggleActionIndex,
  loading,
  loadingPhaseLabel,
  scrollAnchorRef,
}: ForgeConversationProps) {
  return (
    <div
      ref={viewportRef}
      className="h-full scroll-smooth overflow-y-auto px-4 pt-3 sm:px-8"
      style={{ paddingBottom: `${viewportBottomPadding}px` }}
    >
      {!hasConversation ? (
        <div className="mx-auto flex h-full max-w-3xl -translate-y-12 flex-col items-center justify-center text-center sm:-translate-y-16">
          <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200/70 bg-white/85 shadow-[0_18px_55px_rgba(30,64,175,0.18)] dark:border-white/10 dark:bg-white/[0.06] dark:shadow-[0_18px_55px_rgba(30,64,175,0.35)]">
            <FrameworkIcons.Zap size={22} />
          </div>
          <p className="text-slate-600 dark:text-slate-300">Good to see you.</p>
          <h2 className="mt-1 text-4xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-5xl">How can I help you today?</h2>
          <p className="mt-3 max-w-lg text-sm text-slate-600 dark:text-slate-400">
            I am available 24/7 for your framework. Ask one thing, and I will take it from there.
          </p>
        </div>
      ) : (
        <div className="mx-auto max-w-3xl space-y-4 pb-8">
          {visibleMessages.map((entry, index) => {
            const isUser = entry.role === 'user';
            const isAssistant = entry.role === 'assistant';
            const isSystem = entry.role === 'system';
            const isLatestActionBatch = Array.isArray(entry.actions) && entry.actions === lastActions;
            const showMetaRow = isSystem || !!(entry.provider || entry.model);
            return (
              <div key={`${entry.role}-${index}`} className={`flex transition-all duration-300 ${isUser ? 'justify-end' : 'justify-start'}`}>
                <article
                  className={`relative max-w-[92%] rounded-2xl border px-3.5 py-3 text-sm shadow-[0_16px_40px_rgba(2,6,23,0.2)] dark:shadow-[0_16px_40px_rgba(2,6,23,0.34)] ${
                    isUser
                      ? 'border-slate-300/85 bg-slate-900 text-white dark:border-slate-600/70 dark:bg-slate-800/90 dark:text-slate-100'
                      : isAssistant
                        ? 'border-slate-200/80 bg-white/92 text-slate-800 dark:border-slate-700/70 dark:bg-slate-900/70 dark:text-slate-100'
                        : 'border-slate-200/80 bg-slate-50/95 text-slate-700 dark:border-slate-700/70 dark:bg-slate-900/55 dark:text-slate-300'
                  }`}
                >
                  {isAssistant ? (
                    <button
                      type="button"
                      onClick={() => forkFromVisibleMessage(index)}
                      className="absolute right-2 top-2 inline-flex h-5 w-5 items-center justify-center rounded-md border border-transparent text-slate-500 transition hover:border-slate-300 hover:text-slate-800 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-slate-100"
                      title="Fork from this message"
                      aria-label="Fork from this message"
                    >
                      <FrameworkIcons.ArrowLeftRight size={10} />
                    </button>
                  ) : null}
                  {showMetaRow ? (
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {isSystem ? <p className="text-[10px] font-bold uppercase tracking-wider opacity-85">System</p> : null}
                      </div>
                      {(entry.provider || entry.model) ? (
                        <span className="text-[10px] opacity-70">{[entry.provider, entry.model].filter(Boolean).join(' • ')}</span>
                      ) : null}
                    </div>
                  ) : null}

                  {!shouldHideAssistantBody(entry) ? (
                    <div className="space-y-2">
                      {splitMessageBlocks(entry.content).map((block, blockIndex) => {
                        if (block.type === 'code') {
                          return (
                            <div key={`code-${blockIndex}`} className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-black/30">
                              <div className="border-b border-slate-200 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:border-white/10 dark:text-slate-400">
                                {block.language || 'code'}
                              </div>
                              <pre className="max-h-72 overflow-auto px-3 py-2 text-[12px] leading-relaxed text-slate-800 dark:text-slate-100">
                                <code>{block.content}</code>
                              </pre>
                            </div>
                          );
                        }
                        return <div key={`text-${blockIndex}`}>{renderText(block.content, `${index}-${blockIndex}`)}</div>;
                      })}
                    </div>
                  ) : null}

                  {isAssistant && entry.plan && shouldShowPlanCard(entry) ? (
                    (() => {
                      const planSummary = buildPlanCardSummary(entry);
                      return (
                        <div className="mt-2 rounded-xl border border-slate-200/90 bg-slate-50/90 p-2.5 dark:border-slate-700 dark:bg-slate-900/55">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-100">
                              {entry.plan.previewReady ? 'Planning complete' : 'Planning in progress'}
                            </p>
                            <span className="rounded-full border border-slate-300 bg-white px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300">
                              {String(entry.plan.status || 'draft').replace(/_/g, ' ')}
                            </span>
                            <span className="rounded-full border border-slate-300 bg-white px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-600 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-300">
                              risk {entry.plan.risk || 'low'}
                            </span>
                          </div>
                          <div className="space-y-1.5 text-[11px] text-slate-700 dark:text-slate-200">
                            <p>
                              <span className="font-semibold text-slate-900 dark:text-slate-100">Goal:</span> {planSummary.goal}
                            </p>
                            <p>
                              <span className="font-semibold text-slate-900 dark:text-slate-100">What I found:</span> {planSummary.found}
                            </p>
                            <p>
                              <span className="font-semibold text-slate-900 dark:text-slate-100">What I propose:</span> {planSummary.propose}
                            </p>
                            <p>
                              <span className="font-semibold text-slate-900 dark:text-slate-100">What needs your approval:</span> {planSummary.approval}
                            </p>
                          </div>
                        </div>
                      );
                    })()
                  ) : null}

                  {isPlanGuidanceMessage(entry) ? (
                    <div className="mt-2 rounded-xl border border-sky-300/55 bg-[linear-gradient(138deg,rgba(248,252,255,0.95),rgba(233,244,255,0.86),rgba(238,242,255,0.82))] p-2 text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)] dark:border-sky-300/28 dark:bg-[linear-gradient(138deg,rgba(11,26,44,0.8),rgba(16,30,54,0.7),rgba(24,33,60,0.62))] dark:text-sky-50">
                      <p className="text-[11px] font-semibold">Ready to stage this as a plan?</p>
                      <p className="mt-0.5 text-[10px] text-slate-700 dark:text-sky-100/85">
                        Switch to Plan mode and I will prepare clear staged changes for your approval.
                      </p>
                      <div className="mt-1.5 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setChatMode('plan')}
                          className="inline-flex h-7 items-center gap-1 rounded-lg border border-sky-300/65 bg-white/88 px-2 text-[10px] font-semibold text-sky-900 transition hover:bg-white dark:border-sky-300/45 dark:bg-sky-300/14 dark:text-sky-100 dark:hover:bg-sky-300/22"
                        >
                          <FrameworkIcons.ListChecks size={11} />
                          <span>Switch To Plan</span>
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {entry.attachments && entry.attachments.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {entry.attachments.map((item, attachmentIndex) => {
                        const size = formatFileSize(item.size);
                        const detail = [item.mimeType || '', size].filter(Boolean).join(' • ');
                        const href = item.url || item.path;
                        const commonClass =
                          'inline-flex max-w-full items-center gap-1.5 rounded-full border border-slate-400/40 bg-slate-800/55 px-2 py-1 text-[10px] text-slate-100 dark:border-slate-600/60 dark:bg-slate-800/65';
                        if (!href) {
                          return (
                            <span key={`${item.name}-${attachmentIndex}`} className={commonClass}>
                              <FrameworkIcons.Upload size={10} />
                              <span className="truncate max-w-[220px]">{item.name}</span>
                              {detail ? <span className="opacity-75">{detail}</span> : null}
                            </span>
                          );
                        }
                        return (
                          <a
                            key={`${href}-${attachmentIndex}`}
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                            className={`${commonClass} transition hover:bg-slate-700/65`}
                          >
                            <FrameworkIcons.Upload size={10} />
                            <span className="truncate max-w-[220px]">{item.name}</span>
                            {detail ? <span className="opacity-75">{detail}</span> : null}
                          </a>
                        );
                      })}
                    </div>
                  ) : null}

                  {isAssistant && entry.traces && entry.traces.length > 0 && !entry.plan ? (
                    <details className="mt-3 rounded-xl border border-slate-200 bg-slate-50/90 px-2.5 py-2 dark:border-slate-700 dark:bg-slate-900/55">
                      <summary className="cursor-pointer text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                        Behind the scenes ({entry.traces.length} step{entry.traces.length > 1 ? 's' : ''})
                        {entry.loopCapReached ? ' • paused' : ''}
                      </summary>
                      <div className="mt-2 space-y-2">
                        {entry.traces.map((trace, traceIndex) => (
                          <div
                            key={`trace-${trace.iteration}-${traceIndex}`}
                            className="rounded-lg border border-slate-200 bg-white/90 px-2 py-1.5 text-[11px] dark:border-slate-700 dark:bg-slate-950/65"
                          >
                            <div className="mb-1 flex items-center justify-between gap-2">
                              <span className="font-semibold text-slate-700 dark:text-slate-200">Step {trace.iteration}</span>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                {Array.isArray(trace.toolCalls) ? `${trace.toolCalls.length} tool call${trace.toolCalls.length === 1 ? '' : 's'}` : '0 tool calls'}
                              </span>
                            </div>
                            {trace.message ? (
                              <p className="whitespace-pre-wrap break-words text-slate-600 dark:text-slate-300">{trace.message}</p>
                            ) : null}
                            {Array.isArray(trace.toolCalls) && trace.toolCalls.length > 0 ? (
                              <div className="mt-1.5 space-y-1.5">
                                {trace.toolCalls.map((call, callIndex) => (
                                  <div
                                    key={`trace-call-${traceIndex}-${callIndex}`}
                                    className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 dark:border-slate-700 dark:bg-black/25"
                                  >
                                    <p className="font-semibold text-slate-700 dark:text-slate-200">{call.tool || 'tool'}</p>
                                    {call.input ? (
                                      <pre className="mt-1 overflow-auto text-[10px] text-slate-600 dark:text-slate-300">
                                        <code>{JSON.stringify(call.input, null, 2)}</code>
                                      </pre>
                                    ) : null}
                                  </div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </details>
                  ) : null}

                  {isAssistant && (entry.ui?.canContinue || (entry.loopCapReached && (!entry.actions || entry.actions.length === 0))) ? (
                    <div className="mt-2 rounded-xl border border-sky-300/55 bg-[linear-gradient(138deg,rgba(248,252,255,0.95),rgba(233,244,255,0.86),rgba(238,242,255,0.82))] p-2 text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)] dark:border-sky-300/28 dark:bg-[linear-gradient(138deg,rgba(11,26,44,0.8),rgba(16,30,54,0.7),rgba(24,33,60,0.62))] dark:text-sky-50">
                      <p className="text-[11px] font-semibold">Planning paused</p>
                      <p className="mt-0.5 text-[10px] text-slate-700 dark:text-sky-100/85">
                        I need one more pass to finish this plan safely. Continue?
                      </p>
                      <button
                        type="button"
                        onClick={() => void continuePlanning()}
                        className="mt-1.5 inline-flex h-7 items-center gap-1 rounded-lg border border-sky-300/65 bg-white/88 px-2 text-[10px] font-semibold text-sky-900 transition hover:bg-white dark:border-sky-300/45 dark:bg-sky-300/14 dark:text-sky-100 dark:hover:bg-sky-300/22"
                      >
                        <FrameworkIcons.ListChecks size={11} />
                        <span>Continue Planning</span>
                      </button>
                    </div>
                  ) : null}

                  {Array.isArray(entry.actions) && entry.actions.length > 0 ? (
                    <div className="mt-3 space-y-2 rounded-xl border border-indigo-300/45 bg-indigo-50 p-2 dark:border-indigo-300/30 dark:bg-indigo-300/12">
                      <div className="flex flex-wrap items-center justify-between gap-1.5">
                        <p className="text-[11px] font-semibold text-indigo-900 dark:text-indigo-100">
                          I found {entry.actions.length} change{entry.actions.length > 1 ? 's' : ''} ready for review.
                        </p>
                      </div>
                      {isLatestActionBatch ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => void runActions({ dryRun: sandboxMode })}
                            disabled={executing || selectedActionCount === 0}
                            className={`rounded-lg border px-2 py-1 text-[10px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${
                              sandboxMode
                                ? 'border-indigo-300/70 bg-indigo-100 text-indigo-900 hover:bg-indigo-200 dark:border-indigo-300/45 dark:bg-indigo-300/16 dark:text-indigo-100 dark:hover:bg-indigo-300/24'
                                : 'border-emerald-300/70 bg-emerald-100 text-emerald-900 hover:bg-emerald-200 dark:border-emerald-300/45 dark:bg-emerald-300/16 dark:text-emerald-100 dark:hover:bg-emerald-300/24'
                            }`}
                          >
                            {sandboxMode ? 'Preview Changes' : 'Apply Changes'}
                          </button>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">
                            {sandboxMode ? 'Switch to Live to enable apply.' : 'Live mode enabled.'}
                          </p>
                        </div>
                      ) : null}

                      {isLatestActionBatch ? (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedActionIndexes(entry.actions!.map((_, actionIndex) => actionIndex))}
                              className="rounded-md border border-indigo-300/70 bg-white/80 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-900 transition hover:bg-white dark:border-indigo-300/45 dark:bg-indigo-200/10 dark:text-indigo-100 dark:hover:bg-indigo-200/16"
                            >
                              All
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedActionIndexes([])}
                              className="rounded-md border border-indigo-300/70 bg-white/80 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-900 transition hover:bg-white dark:border-indigo-300/45 dark:bg-indigo-200/10 dark:text-indigo-100 dark:hover:bg-indigo-200/16"
                            >
                              None
                            </button>
                          </div>
                          <div className="space-y-1.5">
                            {entry.actions.map((action, actionIndex) => {
                              const checked = selectedActionIndexes.includes(actionIndex);
                              return (
                                <label
                                  key={`action-${actionIndex}`}
                                  className="flex cursor-pointer items-start gap-1.5 rounded-md border border-indigo-300/55 bg-white/80 px-2 py-1 dark:border-indigo-300/28 dark:bg-slate-950/45"
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleActionIndex(actionIndex)}
                                    className="mt-0.5 h-3.5 w-3.5 rounded border-indigo-300 text-indigo-600 focus:ring-indigo-400"
                                  />
                                  <div className="min-w-0">
                                    <p className="truncate text-[10px] font-semibold text-indigo-900 dark:text-indigo-100">
                                      {formatActionLabel(action)}
                                    </p>
                                    <pre className="mt-0.5 max-h-24 overflow-auto whitespace-pre-wrap break-words rounded bg-indigo-100/70 px-1.5 py-1 text-[9px] text-indigo-900 dark:bg-indigo-300/14 dark:text-indigo-100">
                                      <code>{JSON.stringify(action, null, 2)}</code>
                                    </pre>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {entry.execution ? (
                    <div className="mt-3 space-y-2 rounded-xl border border-slate-200 bg-slate-50/90 p-2.5 text-[11px] text-slate-700 dark:border-white/10 dark:bg-black/25 dark:text-slate-300">
                      {(() => {
                        const results = Array.isArray(entry.execution?.results) ? entry.execution.results : [];
                        const okCount = results.filter((item: any) => resolveExecutionKind(item) === 'ok').length;
                        const skippedCount = results.filter((item: any) => resolveExecutionKind(item) === 'skipped').length;
                        const failedCount = results.filter((item: any) => resolveExecutionKind(item) === 'failed').length;
                        const summary = buildExecutionCardSummary(entry.execution);
                        return (
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2 text-[11px]">
                              <span className="font-semibold text-slate-900 dark:text-white">
                                {entry.execution?.dryRun ? 'Preview results' : 'Execution results'} ({results.length})
                              </span>
                              <span className="rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:border-emerald-300/45 dark:bg-emerald-300/14 dark:text-emerald-100">
                                {okCount} ok
                              </span>
                              <span className="rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-700 dark:border-slate-600 dark:bg-slate-800/70 dark:text-slate-200">
                                {skippedCount} unchanged
                              </span>
                              <span className="rounded-full border border-rose-300 bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-800 dark:border-rose-300/45 dark:bg-rose-300/14 dark:text-rose-100">
                                {failedCount} failed
                              </span>
                            </div>
                            <p>
                              <span className="font-semibold text-slate-900 dark:text-slate-100">What changed:</span> {summary.changed}
                            </p>
                            <p>
                              <span className="font-semibold text-slate-900 dark:text-slate-100">Where it changed:</span> {summary.where}
                            </p>
                            <p>
                              <span className="font-semibold text-slate-900 dark:text-slate-100">Result status:</span> {summary.status}
                            </p>
                          </div>
                        );
                      })()}

                      <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        {entry.execution?.dryRun
                          ? 'Preview is data-safe: nothing was written. Review changed fields and optionally open affected pages.'
                          : 'Changes were executed. Review result details and affected pages below.'}
                      </p>

                      {Array.isArray(entry.execution?.results) && entry.execution.results.length > 0 ? (
                        <details className="rounded-lg border border-slate-200 bg-white/80 px-2 py-1.5 dark:border-slate-700 dark:bg-slate-950/55">
                          <summary className="cursor-pointer text-[11px] font-semibold text-slate-700 dark:text-slate-200">
                            Details ({entry.execution.results.length})
                          </summary>
                          <div className="mt-2 space-y-2">
                            {entry.execution.results.map((item: any, resultIndex: number) => {
                              const output = item?.output && typeof item.output === 'object' ? item.output : null;
                              const changedFields = Array.isArray(output?.changedFields) ? output.changedFields : [];
                              const before = output?.before && typeof output.before === 'object' ? output.before : null;
                              const after = output?.after && typeof output.after === 'object' ? output.after : null;
                              const kind = resolveExecutionKind(item);
                              const resultTitle = formatExecutionTitle(item);
                              const detailText = formatExecutionDetail(item);
                              const surface = resolveExecutionSurface(item);
                              const previewPaths = resolveExecutionPreviewPaths(item);
                              const beforePreviewUrl = toAbsolutePreviewUrl(previewPaths.beforePath);
                              const afterPreviewUrl = toAbsolutePreviewUrl(previewPaths.afterPath);
                              const currentPreviewUrl = toAbsolutePreviewUrl(previewPaths.currentPath);
                              const resultClass =
                                kind === 'failed'
                                  ? 'border-rose-300/70 bg-rose-50/90 dark:border-rose-300/35 dark:bg-rose-300/10'
                                  : kind === 'skipped'
                                    ? 'border-slate-300/80 bg-slate-100/75 dark:border-slate-700 dark:bg-slate-900/45'
                                    : 'border-emerald-300/70 bg-emerald-50/90 dark:border-emerald-300/35 dark:bg-emerald-300/10';

                              return (
                                <details key={`execution-${resultIndex}`} className={`rounded-lg border p-2 ${resultClass}`} open={kind === 'failed'}>
                                  <summary className="cursor-pointer list-none">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <span className="font-semibold text-slate-800 dark:text-slate-100">{resultTitle}</span>
                                      <span className={`rounded-full border px-1.5 py-0.5 text-[9px] uppercase tracking-wide ${surfaceBadgeClass(surface)}`}>
                                        {surfaceLabel(surface)}
                                      </span>
                                    </div>
                                  </summary>

                                  {detailText ? (
                                    <p className="mt-2 text-[11px] text-slate-600 dark:text-slate-300">{detailText}</p>
                                  ) : null}

                                  {changedFields.length > 0 ? (
                                    <div className="mt-2 space-y-1.5 rounded-lg border border-slate-200 bg-white/80 p-2 dark:border-slate-700 dark:bg-slate-950/55">
                                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Changed fields</p>
                                      {changedFields.map((change: any, changeIndex: number) => (
                                        <div key={`change-${resultIndex}-${changeIndex}`} className="rounded-md border border-slate-200 bg-slate-50/85 p-1.5 dark:border-slate-700 dark:bg-slate-900/65">
                                          <p className="text-[10px] font-semibold text-slate-700 dark:text-slate-200">{String(change?.field || '')}</p>
                                          <div className="mt-1 grid gap-1.5 sm:grid-cols-2">
                                            <div>
                                              <p className="text-[9px] uppercase tracking-wide text-slate-500 dark:text-slate-400">Before</p>
                                              <p className="whitespace-pre-wrap break-words text-[10px] text-slate-700 dark:text-slate-200">
                                                {formatPreviewValue(change?.before)}
                                              </p>
                                            </div>
                                            <div>
                                              <p className="text-[9px] uppercase tracking-wide text-slate-500 dark:text-slate-400">After</p>
                                              <p className="whitespace-pre-wrap break-words text-[10px] font-medium text-slate-800 dark:text-slate-100">
                                                {formatPreviewValue(change?.after)}
                                              </p>
                                            </div>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  ) : null}

                                  {(before || after) && changedFields.length === 0 ? (
                                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                      <div className="rounded-lg border border-slate-200 bg-white/80 p-2 dark:border-slate-700 dark:bg-slate-950/55">
                                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Before</p>
                                        <pre className="max-h-36 overflow-auto text-[10px] text-slate-700 dark:text-slate-200">
                                          <code>{JSON.stringify(before || {}, null, 2)}</code>
                                        </pre>
                                      </div>
                                      <div className="rounded-lg border border-slate-200 bg-white/80 p-2 dark:border-slate-700 dark:bg-slate-950/55">
                                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">After</p>
                                        <pre className="max-h-36 overflow-auto text-[10px] text-slate-700 dark:text-slate-200">
                                          <code>{JSON.stringify(after || {}, null, 2)}</code>
                                        </pre>
                                      </div>
                                    </div>
                                  ) : null}

                                  {currentPreviewUrl ? (
                                    <details className="mt-2 rounded-lg border border-slate-200 bg-white/80 p-2 dark:border-slate-700 dark:bg-slate-950/55">
                                      <summary className="cursor-pointer text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                                        Visual check
                                      </summary>
                                      <div className="mt-2 space-y-2">
                                        <div className="flex flex-wrap gap-1.5">
                                          {beforePreviewUrl ? (
                                            <a
                                              href={beforePreviewUrl}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="rounded-md border border-slate-300 bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-700 transition hover:bg-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                                            >
                                              Open before path
                                            </a>
                                          ) : null}
                                          {afterPreviewUrl ? (
                                            <a
                                              href={afterPreviewUrl}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="rounded-md border border-slate-300 bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-700 transition hover:bg-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                                            >
                                              Open after path
                                            </a>
                                          ) : (
                                            <a
                                              href={currentPreviewUrl}
                                              target="_blank"
                                              rel="noreferrer"
                                              className="rounded-md border border-slate-300 bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-700 transition hover:bg-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                                            >
                                              Open affected page
                                            </a>
                                          )}
                                        </div>
                                        <div className="grid gap-2 sm:grid-cols-2">
                                          {beforePreviewUrl ? (
                                            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950">
                                              <p className="border-b border-slate-200 px-2 py-1 text-[9px] uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">Before path</p>
                                              <iframe title={`before-preview-${resultIndex}`} src={beforePreviewUrl} className="h-44 w-full bg-white" />
                                            </div>
                                          ) : null}
                                          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950">
                                            <p className="border-b border-slate-200 px-2 py-1 text-[9px] uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
                                              {afterPreviewUrl ? 'After path' : 'Current page'}
                                            </p>
                                            <iframe
                                              title={`after-preview-${resultIndex}`}
                                              src={afterPreviewUrl || currentPreviewUrl}
                                              className="h-44 w-full bg-white"
                                            />
                                          </div>
                                        </div>
                                      </div>
                                    </details>
                                  ) : null}
                                </details>
                              );
                            })}
                          </div>
                        </details>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              </div>
            );
          })}
          {loading ? (
            <div className="flex justify-start">
              <article className="max-w-[92%] rounded-2xl border border-slate-200/80 bg-white/92 px-3.5 py-3 text-sm text-slate-700 shadow-[0_16px_40px_rgba(2,6,23,0.18)] dark:border-slate-700/70 dark:bg-slate-900/70 dark:text-slate-200 dark:shadow-[0_16px_40px_rgba(2,6,23,0.34)]">
                <div className="inline-flex items-center gap-2 text-[12px] font-medium">
                  <span className="relative inline-flex overflow-hidden rounded-md px-1.5 py-0.5">
                    <span className="pointer-events-none absolute inset-0 -translate-x-full animate-[forge-think-sweep_1.4s_linear_infinite] bg-gradient-to-r from-transparent via-slate-300/70 to-transparent dark:via-cyan-200/30" />
                    <span className="relative bg-gradient-to-r from-slate-700 via-slate-500 to-slate-700 bg-[length:180%_100%] bg-clip-text text-transparent dark:from-slate-100 dark:via-cyan-200 dark:to-slate-100">
                      Thinking
                    </span>
                  </span>
                  <span className="text-[11px] text-slate-500 transition-opacity duration-300 dark:text-slate-400">
                    {loadingPhaseLabel}
                  </span>
                </div>
              </article>
            </div>
          ) : null}
          <div ref={scrollAnchorRef} className="h-0" />
        </div>
      )}
    </div>
  );
}

interface ForgeComposerProps {
  composerRef: React.RefObject<HTMLDivElement | null>;
  hasConversation: boolean;
  leftDockOffset: string;
  rightDockOffset: string;
  controlsVisible: boolean;
  provider: string;
  switchProvider: (nextProvider: string) => void;
  model: string;
  setModel: React.Dispatch<React.SetStateAction<string>>;
  modelOptions: Array<{ value: string; label: string }>;
  skillId: string;
  setSkillId: React.Dispatch<React.SetStateAction<string>>;
  skillOptions: Array<{ value: string; label: string }>;
  chatMode: 'auto' | 'plan' | 'agent';
  setChatMode: React.Dispatch<React.SetStateAction<'auto' | 'plan' | 'agent'>>;
  sandboxMode: boolean;
  setSandboxMode: React.Dispatch<React.SetStateAction<boolean>>;
  runActions: (options?: { dryRun?: boolean; invokedByApproval?: boolean }) => Promise<void>;
  lastActions: AssistantAction[];
  selectedActionCount: number;
  executing: boolean;
  promptUsage: string;
  loadingProviderModels: boolean;
  providerModelsError: string;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFilesSelected: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  attachments: UploadedAttachment[];
  removeAttachment: (indexToRemove: number) => void;
  openFilePicker: () => void;
  uploadingAttachments: boolean;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  prompt: string;
  setPrompt: React.Dispatch<React.SetStateAction<string>>;
  onComposerKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  sendPrompt: (forcedPrompt?: string) => Promise<void>;
  loading: boolean;
  checkingIntegration: boolean;
  integrationConfigured: boolean;
  quickPrompts: string[];
  toolsMenuRef: React.RefObject<HTMLDivElement | null>;
  toolsButtonRef: React.RefObject<HTMLButtonElement | null>;
  showTools: boolean;
  setShowTools: React.Dispatch<React.SetStateAction<boolean>>;
  activeTools: number;
  totalTools: number;
}

export function ForgeComposer({
  composerRef,
  hasConversation,
  leftDockOffset,
  rightDockOffset,
  controlsVisible,
  provider,
  switchProvider,
  model,
  setModel,
  modelOptions,
  skillId,
  setSkillId,
  skillOptions,
  chatMode,
  setChatMode,
  sandboxMode,
  setSandboxMode,
  runActions,
  lastActions,
  selectedActionCount,
  executing,
  promptUsage,
  loadingProviderModels,
  providerModelsError,
  fileInputRef,
  onFilesSelected,
  attachments,
  removeAttachment,
  openFilePicker,
  uploadingAttachments,
  textareaRef,
  prompt,
  setPrompt,
  onComposerKeyDown,
  sendPrompt,
  loading,
  checkingIntegration,
  integrationConfigured,
  quickPrompts,
  toolsMenuRef,
  toolsButtonRef,
  showTools,
  setShowTools,
  activeTools,
  totalTools,
}: ForgeComposerProps) {
  const compactComposer = hasConversation;
  const chatModeOptions = ['auto', 'plan', 'agent'] as const;
  const chatModeIndex = Math.max(chatModeOptions.indexOf(chatMode), 0);
  const sandboxModeIndex = sandboxMode ? 0 : 1;
  const compactSelectClass =
    '[&_button]:!h-8 [&_button]:!rounded-xl [&_button]:!border-slate-200 [&_button]:!bg-slate-50 [&_button]:!px-2.5 [&_button]:!text-[11px] [&_button]:!text-slate-700 [&_button]:hover:!border-slate-300 [&_button]:hover:!text-slate-900 dark:[&_button]:!border-slate-700 dark:[&_button]:!bg-slate-900/70 dark:[&_button]:!text-slate-300 dark:[&_button]:hover:!border-slate-600 dark:[&_button]:hover:!text-white';

  return (
    <div
      ref={composerRef}
      className={`fixed z-20 px-4 sm:px-6 ${
        hasConversation ? 'bottom-0 pb-4 sm:pb-6' : 'bottom-[10vh] pb-0 sm:bottom-[12vh]'
      }`}
      style={{ left: leftDockOffset, right: rightDockOffset }}
    >
      <div
        className={`mx-auto w-full max-w-[760px] rounded-[24px] border p-2.5 backdrop-blur-xl transition-colors ${
          chatMode === 'plan'
            ? 'border-sky-300/58 bg-[linear-gradient(160deg,rgba(252,255,255,0.97),rgba(234,245,255,0.9),rgba(238,242,255,0.9))] shadow-[0_26px_62px_rgba(56,139,253,0.22)] dark:border-sky-300/26 dark:bg-[linear-gradient(160deg,rgba(8,17,30,0.95),rgba(12,28,44,0.9),rgba(18,31,53,0.84))] dark:shadow-[0_28px_76px_rgba(8,21,43,0.82)]'
            : chatMode === 'agent'
              ? 'border-indigo-300/40 bg-[linear-gradient(160deg,rgba(255,255,255,0.96),rgba(243,244,255,0.9),rgba(240,249,255,0.9))] shadow-[0_25px_62px_rgba(79,70,229,0.2)] dark:border-indigo-300/22 dark:bg-[linear-gradient(160deg,rgba(8,14,28,0.95),rgba(16,22,40,0.9),rgba(15,28,46,0.84))] dark:shadow-[0_28px_76px_rgba(23,20,62,0.8)]'
              : 'border-slate-200/80 bg-white/96 shadow-[0_25px_60px_rgba(15,23,42,0.2)] dark:border-slate-700/75 dark:bg-[#0b1220]/90 dark:shadow-[0_25px_70px_rgba(2,6,23,0.7)]'
        }`}
      >
        <div className="mb-2 flex flex-wrap items-center gap-2 pb-1">
          <div className={`${controlsVisible ? '' : 'hidden '} ${compactComposer ? 'w-[6.8rem] min-w-[6.8rem] shrink-0' : 'w-[8rem] min-w-[7rem] shrink-0'}`}>
            <Select
              value={provider}
              onChange={switchProvider}
              options={PROVIDER_OPTIONS}
              searchable={false}
              placeholder="Provider"
              menuPosition="top"
              className={compactSelectClass}
            />
          </div>
          <div className={`${controlsVisible ? '' : 'hidden '} ${compactComposer ? 'w-[8.8rem] min-w-[8.8rem] shrink-0' : 'w-[11rem] min-w-[8rem] shrink-0'}`}>
            <Select
              value={model}
              onChange={setModel}
              options={modelOptions}
              placeholder="Model"
              menuPosition="top"
              className={compactSelectClass}
            />
          </div>
          <div className={`${controlsVisible ? '' : 'hidden '} ${compactComposer ? 'w-[7.5rem] min-w-[7.5rem] shrink-0' : 'w-[9rem] min-w-[8rem] shrink-0'}`}>
            <Select
              value={skillId}
              onChange={(next) => setSkillId(String(next || 'general').trim().toLowerCase())}
              options={skillOptions}
              searchable={false}
              placeholder="Skill"
              menuPosition="top"
              className={compactSelectClass}
            />
          </div>
          <div
            className={`relative ${controlsVisible ? 'inline-grid' : 'hidden'} shrink-0 grid-cols-3 items-center rounded-xl border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-700 dark:bg-slate-900/70 ${
              compactComposer ? 'w-[138px]' : 'w-[156px]'
            }`}
            role="radiogroup"
            aria-label="Response mode"
          >
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute top-0.5 h-7 rounded-lg transition-[left,background-color,box-shadow] duration-300 ease-out motion-reduce:transition-none ${
                chatMode === 'plan'
                  ? 'bg-sky-100 shadow-[0_1px_4px_rgba(56,189,248,0.25)] dark:bg-sky-300/24'
                  : chatMode === 'agent'
                    ? 'bg-indigo-200 shadow-[0_1px_4px_rgba(99,102,241,0.28)] dark:bg-indigo-300/28'
                    : 'bg-slate-900 shadow-[0_1px_4px_rgba(15,23,42,0.28)] dark:bg-white/18'
              }`}
              style={{
                width: 'calc((100% - 4px) / 3)',
                left: `calc(2px + ${chatModeIndex} * ((100% - 4px) / 3))`,
              }}
            />
            {chatModeOptions.map((mode) => {
              const active = chatMode === mode;
              const label = mode === 'auto' ? 'auto' : mode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setChatMode(mode)}
                  role="radio"
                  aria-checked={active}
                  className={`relative z-10 h-7 rounded-lg px-2 ${compactComposer ? 'text-[10px]' : 'text-[11px]'} font-semibold capitalize transition-colors duration-200 ${
                    active
                      ? mode === 'plan'
                        ? 'text-sky-900 dark:text-sky-100'
                        : mode === 'agent'
                          ? 'text-indigo-900 dark:text-indigo-100'
                          : 'text-white dark:text-slate-100'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <div
            className={`relative ${controlsVisible ? 'inline-grid' : 'hidden'} h-8 shrink-0 grid-cols-2 items-center rounded-xl border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-700 dark:bg-slate-900/70`}
            role="radiogroup"
            aria-label="Execution mode"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-0.5 h-7 rounded-lg bg-slate-900 shadow-[0_1px_4px_rgba(15,23,42,0.28)] transition-[left] duration-300 ease-out motion-reduce:transition-none dark:bg-white/18"
              style={{
                width: 'calc((100% - 4px) / 2)',
                left: `calc(2px + ${sandboxModeIndex} * ((100% - 4px) / 2))`,
              }}
            />
            <button
              type="button"
              onClick={() => setSandboxMode(true)}
              role="radio"
              aria-checked={sandboxMode}
              className={`relative z-10 inline-flex h-7 items-center gap-1 rounded-lg px-2.5 text-[11px] font-semibold transition-colors duration-200 ${
                sandboxMode ? 'text-white dark:text-slate-100' : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
              }`}
              title="Preview mode (safe dry-run)"
            >
              <FrameworkIcons.Shield size={11} />
              <span>Preview</span>
            </button>
            <button
              type="button"
              onClick={() => setSandboxMode(false)}
              role="radio"
              aria-checked={!sandboxMode}
              className={`relative z-10 inline-flex h-7 items-center gap-1 rounded-lg px-2.5 text-[11px] font-semibold transition-colors duration-200 ${
                !sandboxMode ? 'text-white dark:text-slate-100' : 'text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white'
              }`}
              title="Live mode (writes changes)"
            >
              <FrameworkIcons.Zap size={11} />
              <span>Live</span>
            </button>
          </div>
          <button
            type="button"
            onClick={() => {
              void runActions();
            }}
            disabled={!lastActions.length || selectedActionCount === 0 || executing}
            className="h-8 shrink-0 rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-[11px] font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-45 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:bg-slate-800 dark:hover:text-white"
            title={sandboxMode ? 'Preview selected changes without writing data' : 'Apply selected changes to your data'}
          >
            {executing
              ? 'Running...'
              : selectedActionCount > 0
                ? sandboxMode
                  ? `Preview Changes (${selectedActionCount})`
                  : `Apply Changes (${selectedActionCount})`
                : sandboxMode
                  ? 'Preview Changes'
                  : 'Apply Changes'}
          </button>
          {!controlsVisible ? (
            <span className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300">
              {provider} • {model || 'model'} • {chatMode}
            </span>
          ) : null}
          <span className={`ml-auto shrink-0 ${compactComposer ? 'text-[10px]' : 'text-[11px]'} text-slate-500 dark:text-slate-400`}>
            {lastActions.length > 0 ? `Changes ready ${selectedActionCount}/${lastActions.length} • ` : ''}
            {sandboxMode ? 'Preview mode (safe, no writes)' : 'Live mode (writes enabled)'}
            {!compactComposer ? ` • ${promptUsage}` : ''}
          </span>
        </div>
        {loadingProviderModels ? <p className="mb-1.5 text-[11px] text-slate-400">Loading models...</p> : null}
        {providerModelsError ? <p className="mb-1.5 text-[11px] text-amber-200">{providerModelsError}</p> : null}

        <div
          className={`rounded-xl border p-1.5 ${
            chatMode === 'plan'
              ? 'border-sky-300/58 bg-[linear-gradient(150deg,rgba(255,255,255,0.88),rgba(241,249,255,0.84),rgba(238,242,255,0.78))] shadow-[inset_0_1px_0_rgba(255,255,255,0.78)] dark:border-sky-300/28 dark:bg-[linear-gradient(150deg,rgba(13,24,40,0.65),rgba(14,31,47,0.55),rgba(25,31,52,0.5))]'
              : chatMode === 'agent'
                ? 'border-indigo-300/40 bg-[linear-gradient(150deg,rgba(255,255,255,0.9),rgba(246,247,255,0.8),rgba(240,249,255,0.78))] shadow-[inset_0_1px_0_rgba(255,255,255,0.76)] dark:border-indigo-300/24 dark:bg-[linear-gradient(150deg,rgba(14,20,36,0.65),rgba(19,24,42,0.55),rgba(13,30,46,0.52))]'
                : 'border-slate-200/80 bg-white dark:border-slate-700 dark:bg-slate-950/65'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={onFilesSelected}
          />
          {attachments.length > 0 ? (
            <div className="mb-1.5 flex flex-wrap gap-1.5 px-0.5">
              {attachments.map((item, attachmentIndex) => {
                const size = formatFileSize(item.size);
                const detail = [item.mimeType || '', size].filter(Boolean).join(' • ');
                return (
                  <div
                    key={`${item.url || item.path || item.name}-${attachmentIndex}`}
                    className="inline-flex max-w-full items-center gap-1 rounded-full border border-slate-300 bg-slate-50 px-2 py-1 text-[10px] text-slate-700 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200"
                  >
                    <FrameworkIcons.Upload size={10} />
                    <span className="truncate max-w-[200px]">{item.name}</span>
                    {detail ? <span className="opacity-70">{detail}</span> : null}
                    <button
                      type="button"
                      onClick={() => removeAttachment(attachmentIndex)}
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-200 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                      aria-label={`Remove ${item.name}`}
                    >
                      <FrameworkIcons.X size={10} />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : null}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={openFilePicker}
              disabled={uploadingAttachments}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-45 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              title="Upload asset"
              aria-label="Upload asset"
            >
              <FrameworkIcons.Plus size={13} />
            </button>
            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value.slice(0, MAX_PROMPT_LENGTH))}
              onKeyDown={onComposerKeyDown}
              placeholder={
                chatMode === 'plan'
                  ? 'Describe what should change. I will stage actions for approval.'
                  : chatMode === 'agent'
                    ? 'Describe the goal. Agent mode can iterate through multiple steps.'
                    : 'Ask anything... Auto mode decides whether to plan or run agent loops.'
              }
              className="min-h-[50px] max-h-[140px] w-full resize-none overflow-y-auto rounded-lg border-0 bg-transparent px-2 py-2 text-sm leading-relaxed text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500"
            />
            <button
              type="button"
              onClick={() => void sendPrompt()}
              disabled={!prompt.trim() || loading || checkingIntegration || !integrationConfigured || uploadingAttachments}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-45 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-200 dark:hover:bg-slate-800"
              title={chatMode === 'plan' ? 'Generate plan' : 'Send'}
            >
              <FrameworkIcons.Send size={14} />
            </button>
          </div>
          {uploadingAttachments ? (
            <div className="mt-1 px-1 text-[11px] text-slate-500 dark:text-slate-400">Uploading assets...</div>
          ) : null}
        </div>

        {!hasConversation ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {quickPrompts.map((item) => (
              <button
                key={`chip-${item}`}
                type="button"
                onClick={() => setPrompt(item)}
                className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-white"
              >
                {item}
              </button>
            ))}
          </div>
        ) : null}
        <div className="mt-1.5 flex items-center justify-between gap-2 px-1">
          <div className="min-w-0 text-[11px] text-slate-500 dark:text-slate-400">
            {hasConversation
              ? 'Enter to send, Shift+Enter for newline. Reply "yes" to approve selected staged actions.'
              : 'Enter to send, Shift+Enter for newline.'}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <div className="relative" ref={toolsMenuRef}>
              <button
                ref={toolsButtonRef}
                type="button"
                onClick={() => setShowTools((prev) => !prev)}
                className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border transition ${
                  showTools
                    ? 'border-cyan-400/70 bg-cyan-100 text-cyan-900 dark:border-cyan-300/60 dark:bg-cyan-300/20 dark:text-cyan-100'
                    : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-white'
                }`}
                title={`Tools (${activeTools}/${totalTools})`}
                aria-label={`Tools (${activeTools}/${totalTools})`}
              >
                <FrameworkIcons.Wrench size={11} />
              </button>
            </div>
            <button
              type="button"
              onClick={() => setSandboxMode((prev) => !prev)}
              className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border transition ${
                sandboxMode
                  ? 'border-emerald-300/70 bg-emerald-100 text-emerald-900 dark:border-emerald-300/45 dark:bg-emerald-300/14 dark:text-emerald-100'
                  : 'border-rose-300/70 bg-rose-100 text-rose-900 dark:border-rose-300/45 dark:bg-rose-300/14 dark:text-rose-100'
              }`}
              title={sandboxMode ? 'Preview mode (no writes)' : 'Live mode (writes enabled)'}
              aria-label={sandboxMode ? 'Preview mode (no writes)' : 'Live mode (writes enabled)'}
            >
              {sandboxMode ? <FrameworkIcons.Shield size={11} /> : <FrameworkIcons.Zap size={11} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
