'use client';

import React from 'react';
import { FrameworkIcons } from '@fromcode119/react';
import { Select } from '../ui/select';
import { GLASS_INPUT, GLASS_BUTTON, GLASS_BUTTON_PRIMARY } from '../ui/glass-morphism';
import {
  MAX_PROMPT_LENGTH,
  PROVIDER_OPTIONS,
  AssistantAction,
  UploadedAttachment,
  formatFileSize,
} from '../assistant-utils';

export function AssistantComposer({
  prompt,
  setPrompt,
  loading,
  checkingIntegration,
  integrationConfigured,
  uploadingAttachments,
  sendPrompt,
  onComposerKeyDown,
  chatMode,
  setChatMode,
  sandboxMode,
  setSandboxMode,
  attachments,
  removeAttachment,
  openFilePicker,
  lastActions,
  selectedActionCount,
  setSelectedActionIndexes,
  executing,
  runActions,
  hasConversation,
  promptUsage,
  showTools,
  setShowTools,
  activeTools,
  totalTools,
  quickPrompts,
  composerRef,
  textareaRef,
  fileInputRef,
  toolsButtonRef,
  onFilesSelected,
}: {
  prompt: string;
  setPrompt: (val: string) => void;
  loading: boolean;
  checkingIntegration: boolean;
  integrationConfigured: boolean;
  uploadingAttachments: boolean;
  sendPrompt: (forced?: string) => Promise<void>;
  onComposerKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  chatMode: 'auto' | 'plan' | 'agent';
  setChatMode: (mode: 'auto' | 'plan' | 'agent') => void;
  sandboxMode: boolean;
  setSandboxMode: (val: boolean | ((prev: boolean) => boolean)) => void;
  attachments: UploadedAttachment[];
  removeAttachment: (idx: number) => void;
  openFilePicker: () => void;
  lastActions: AssistantAction[];
  selectedActionCount: number;
  setSelectedActionIndexes: (idxs: number[]) => void;
  executing: boolean;
  runActions: (options?: { dryRun?: boolean; invokedByApproval?: boolean }) => Promise<void>;
  hasConversation: boolean;
  promptUsage: string;
  showTools: boolean;
  setShowTools: (val: boolean | ((prev: boolean) => boolean)) => void;
  activeTools: number;
  totalTools: number;
  quickPrompts: string[];
  composerRef: React.RefObject<HTMLDivElement | null>;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  toolsButtonRef: React.RefObject<HTMLButtonElement | null>;
  onFilesSelected: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
}) {
  const compactComposer = hasConversation;
  const chatModeOptions = ['auto', 'plan', 'agent'] as const;
  const chatModeIndex = Math.max(chatModeOptions.indexOf(chatMode), 0);

  return (
    <div
      ref={composerRef}
      className={`fixed inset-x-0 z-20 px-2 transition-all duration-500 sm:px-6 ${
        hasConversation
          ? 'bottom-0 pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)] sm:pb-6'
          : 'bottom-[8vh] pb-[calc(env(safe-area-inset-bottom,0px)+0.25rem)] sm:bottom-[12vh] sm:pb-0'
      }`}
    >
      <div
        className={`mx-auto w-full max-w-none rounded-[24px] border p-2.5 backdrop-blur-xl transition-colors sm:max-w-[760px] ${
          chatMode === 'plan'
            ? 'border-sky-300/58 bg-[linear-gradient(160deg,rgba(252,255,255,0.97),rgba(234,245,255,0.9),rgba(238,242,255,0.9))] shadow-[0_26px_62px_rgba(56,139,253,0.22)] dark:border-sky-300/26 dark:bg-[linear-gradient(160deg,rgba(8,17,30,0.95),rgba(12,28,44,0.9),rgba(18,31,53,0.84))] dark:shadow-[0_28px_76px_rgba(8,21,43,0.82)]'
            : chatMode === 'agent'
              ? 'border-indigo-300/40 bg-[linear-gradient(160deg,rgba(255,255,255,0.96),rgba(243,244,255,0.9),rgba(240,249,255,0.9))] shadow-[0_25px_62px_rgba(79,70,229,0.2)] dark:border-indigo-300/22 dark:bg-[linear-gradient(160deg,rgba(8,14,28,0.95),rgba(16,22,40,0.9),rgba(15,28,46,0.84))] dark:shadow-[0_28px_76px_rgba(23,20,62,0.8)]'
              : 'border-slate-200/80 bg-white/96 shadow-[0_25px_60px_rgba(15,23,42,0.2)] dark:border-slate-700/75 dark:bg-[#0b1220]/90 dark:shadow-[0_25px_70px_rgba(2,6,23,0.7)]'
        }`}
      >
        {/* Mode selector - always visible */}
        <div className="mb-2 flex items-center justify-between gap-2">
          <div
            className="relative inline-grid grid-cols-3 items-center rounded-xl border border-slate-200/80 bg-slate-50/70 p-0.5 backdrop-blur-sm dark:border-slate-700/70 dark:bg-slate-900/50"
            role="radiogroup"
            aria-label="Response mode"
          >
            <span
              aria-hidden="true"
              className={`pointer-events-none absolute top-0.5 h-7 rounded-lg backdrop-blur-sm transition-all duration-300 ease-out ${
                chatMode === 'plan'
                  ? 'bg-gradient-to-br from-sky-100 to-blue-50/90 shadow-[0_2px_8px_rgba(56,189,248,0.2)] dark:from-sky-500/30 dark:to-blue-500/20'
                  : chatMode === 'agent'
                    ? 'bg-gradient-to-br from-indigo-100 to-purple-50/90 shadow-[0_2px_8px_rgba(99,102,241,0.2)] dark:from-indigo-500/30 dark:to-purple-500/20'
                    : 'bg-gradient-to-br from-slate-100 to-slate-50/90 shadow-[0_2px_8px_rgba(15,23,42,0.15)] dark:from-slate-700/50 dark:to-slate-600/40'
              }`}
              style={{
                width: 'calc((100% - 4px) / 3)',
                left: `calc(2px + ${chatModeIndex} * ((100% - 4px) / 3))`,
              }}
            />
            {chatModeOptions.map((mode) => {
              const active = chatMode === mode;
              const label = mode === 'auto' ? 'Auto' : mode === 'plan' ? 'Plan' : 'Agent';
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setChatMode(mode)}
                  role="radio"
                  aria-checked={active}
                  className={`relative z-10 h-7 rounded-lg px-3 text-[11px] font-semibold capitalize transition-colors duration-200 ${
                    active
                      ? mode === 'plan'
                        ? 'text-sky-900 dark:text-sky-100'
                        : mode === 'agent'
                          ? 'text-indigo-900 dark:text-indigo-100'
                          : 'text-slate-900 dark:text-slate-100'
                      : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400">
            {chatMode === 'plan' ? 'Planning mode' : chatMode === 'agent' ? 'Agent mode' : 'Auto mode'}
          </span>
        </div>

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
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200/80 bg-gradient-to-br from-white/95 to-slate-50/90 text-slate-500 shadow-sm backdrop-blur-sm transition hover:border-cyan-300 hover:bg-gradient-to-br hover:from-cyan-50 hover:to-sky-50 hover:text-cyan-600 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-45 dark:border-slate-700/70 dark:from-slate-900/80 dark:to-slate-800/70 dark:text-slate-300 dark:hover:border-cyan-600/50 dark:hover:from-cyan-950/40 dark:hover:to-sky-950/30 dark:hover:text-cyan-400"
              title="Attach file"
              aria-label="Attach file"
            >
              <FrameworkIcons.File size={14} />
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
            <div className="mt-2 flex items-center gap-2 rounded-lg bg-cyan-50/50 px-3 py-1.5 dark:bg-cyan-900/20">
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-cyan-200 border-t-cyan-600 dark:border-cyan-800 dark:border-t-cyan-400" />
              <span className="text-xs font-medium text-cyan-700 dark:text-cyan-300">Uploading assets</span>
            </div>
          ) : null}
        </div>

        {!hasConversation ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {quickPrompts.map((item) => (
              <button
                key={`chip-${item}`}
                type="button"
                onClick={() => setPrompt(item)}
                className="rounded-full border border-slate-200/70 bg-slate-50/80 px-2.5 py-1 text-[11px] text-slate-600 transition hover:border-cyan-300/60 hover:bg-cyan-50/60 hover:text-cyan-900 dark:border-slate-700/60 dark:bg-slate-900/50 dark:text-slate-300 dark:hover:border-cyan-400/50 dark:hover:bg-cyan-500/10 dark:hover:text-cyan-100"
              >
                {item}
              </button>
            ))}
          </div>
        ) : null}
        {hasConversation && lastActions.length > 0 ? (
          <div className="mt-2.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedActionIndexes(lastActions.map((_, index) => index))}
                className="rounded-lg border border-slate-200/70 bg-slate-50/80 px-2 py-1 text-[10px] font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700/60 dark:bg-slate-900/50 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                Select All
              </button>
              <button
                type="button"
                onClick={() => setSelectedActionIndexes([])}
                className="rounded-lg border border-slate-200/70 bg-slate-50/80 px-2 py-1 text-[10px] font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700/60 dark:bg-slate-900/50 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                Clear
              </button>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                {selectedActionCount}/{lastActions.length} selected
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                void runActions();
              }}
              disabled={selectedActionCount === 0 || executing}
              className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-[11px] font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-45 ${
                sandboxMode
                  ? 'border-emerald-300/60 bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-[0_2px_8px_rgba(16,185,129,0.2)] hover:shadow-[0_4px_14px_rgba(16,185,129,0.3)] dark:border-emerald-400/40'
                  : 'border-cyan-300/60 bg-gradient-to-r from-cyan-500 to-sky-600 text-white shadow-[0_2px_8px_rgba(6,182,212,0.2)] hover:shadow-[0_4px_14px_rgba(6,182,212,0.3)] dark:border-cyan-400/40'
              }`}
            >
              {sandboxMode ? <FrameworkIcons.Shield size={12} /> : <FrameworkIcons.Zap size={12} />}
              <span>
                {executing
                  ? 'Running...'
                  : selectedActionCount > 0
                    ? sandboxMode
                      ? `Preview ${selectedActionCount}`
                      : `Apply ${selectedActionCount}`
                    : sandboxMode
                      ? 'Preview'
                      : 'Apply'}
              </span>
            </button>
          </div>
        ) : null}
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <div className="relative">
              <button
                ref={toolsButtonRef}
                type="button"
                onClick={() => setShowTools((prev) => !prev)}
                className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border backdrop-blur-sm transition ${
                  showTools
                    ? 'border-cyan-300/60 bg-gradient-to-br from-cyan-50 to-sky-50/80 text-cyan-700 shadow-[0_2px_8px_rgba(6,182,212,0.15)] dark:border-cyan-400/50 dark:from-cyan-500/20 dark:to-sky-500/10 dark:text-cyan-100'
                    : 'border-slate-200/70 bg-slate-50/70 text-slate-600 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700/60 dark:bg-slate-900/40 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:bg-slate-800/60 dark:hover:text-white'
                }`}
                title={`Tools (${activeTools}/${totalTools})`}
                aria-label={`Tools (${activeTools}/${totalTools})`}
              >
                <FrameworkIcons.Wrench size={11} />
              </button>
              {showTools && activeTools > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border border-cyan-300/60 bg-cyan-500 text-[9px] font-bold text-white dark:border-cyan-400/50">
                  {activeTools}
                </span>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => setSandboxMode((prev) => !prev)}
              className={`inline-flex h-7 w-7 items-center justify-center rounded-lg border backdrop-blur-sm transition ${
                sandboxMode
                  ? 'border-emerald-300/60 bg-gradient-to-br from-emerald-50 to-teal-50/80 text-emerald-700 shadow-[0_2px_8px_rgba(16,185,129,0.15)] dark:border-emerald-400/50 dark:from-emerald-500/20 dark:to-teal-500/10 dark:text-emerald-100'
                  : 'border-amber-300/60 bg-gradient-to-br from-amber-50 to-orange-50/80 text-amber-700 shadow-[0_2px_8px_rgba(245,158,11,0.15)] dark:border-amber-400/50 dark:from-amber-500/20 dark:to-orange-500/10 dark:text-amber-100'
              }`}
              title={sandboxMode ? 'Preview mode (no writes)' : 'Live mode (writes enabled)'}
              aria-label={sandboxMode ? 'Preview mode (no writes)' : 'Live mode (writes enabled)'}
            >
              {sandboxMode ? <FrameworkIcons.Shield size={11} /> : <FrameworkIcons.Zap size={11} />}
            </button>
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400">
            {sandboxMode ? 'Preview mode' : 'Live mode'} • {promptUsage}
          </div>
        </div>
      </div>
    </div>
  );
}
