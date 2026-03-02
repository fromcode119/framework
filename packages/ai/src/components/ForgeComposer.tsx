'use client';

import React from 'react';
import { FrameworkIcons } from '@fromcode119/react';
import { Select } from '../ui/select';
import {
  MAX_PROMPT_LENGTH,
  PROVIDER_OPTIONS,
  AssistantAction,
  UploadedAttachment,
  formatFileSize,
} from '../assistant-utils';

export function ForgeComposer({
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
  provider,
  switchProvider,
  model,
  setModel,
  modelOptions,
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
  provider: string;
  switchProvider: (p: string) => void;
  model: string;
  setModel: (m: string) => void;
  modelOptions: { value: string; label: string }[];
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
  composerRef: React.RefObject<HTMLDivElement>;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  fileInputRef: React.RefObject<HTMLInputElement>;
  toolsButtonRef: React.RefObject<HTMLButtonElement>;
  onFilesSelected: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
}) {
  const compactComposer = hasConversation;
  const chatModeOptions = ['auto', 'plan', 'agent'] as const;
  const chatModeIndex = Math.max(chatModeOptions.indexOf(chatMode), 0);
  const sandboxModeIndex = sandboxMode ? 0 : 1;
  const compactSelectClass =
    '[&_button]:h-8 [&_button]:rounded-xl [&_button]:border-slate-200 [&_button]:bg-slate-50 [&_button]:px-2.5 [&_button]:text-[11px] [&_button]:text-slate-700 [&_button]:hover:border-slate-300 [&_button]:hover:text-slate-900 dark:[&_button]:border-slate-700 dark:[&_button]:bg-slate-900/70 dark:[&_button]:text-slate-300 dark:[&_button]:hover:border-slate-600 dark:[&_button]:hover:text-white';

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
        <div className="mb-2 flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className={compactComposer ? 'w-[6.8rem] min-w-[6.8rem] shrink-0' : 'w-[8rem] min-w-[7rem] shrink-0'}>
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
          <div className={compactComposer ? 'w-[8.8rem] min-w-[8.8rem] shrink-0' : 'w-[11rem] min-w-[8rem] shrink-0'}>
            <Select
              value={model}
              onChange={setModel}
              options={modelOptions}
              placeholder="Model"
              menuPosition="top"
              className={compactSelectClass}
            />
          </div>
          <div
            className={`relative inline-grid shrink-0 grid-cols-3 items-center rounded-xl border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-700 dark:bg-slate-900/70 ${
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
            className="relative inline-grid h-8 shrink-0 grid-cols-2 items-center rounded-xl border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-700 dark:bg-slate-900/70"
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
                  ? `Run Preview (${selectedActionCount})`
                  : `Apply Changes (${selectedActionCount})`
                : sandboxMode
                  ? 'Run Preview'
                  : 'Apply Changes'}
          </button>
          {lastActions.length > 0 ? (
            <div className={`inline-flex shrink-0 items-center gap-1 ${compactComposer ? 'hidden sm:inline-flex' : ''}`}>
              <button
                type="button"
                onClick={() => setSelectedActionIndexes(lastActions.map((_, index) => index))}
                className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-white"
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setSelectedActionIndexes([])}
                className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-white"
              >
                None
              </button>
            </div>
          ) : null}
          <span className={`ml-auto shrink-0 ${compactComposer ? 'text-[10px]' : 'text-[11px]'} text-slate-500 dark:text-slate-400`}>
            {lastActions.length > 0 ? `Staged ${selectedActionCount}/${lastActions.length} • ` : ''}
            {sandboxMode ? 'Preview mode' : 'Live mode'}
            {!compactComposer ? ` • ${promptUsage}` : ''}
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
        ) : (
          <div className="mt-1.5 px-1 text-[11px] text-slate-500 dark:text-slate-400">
            Enter to send, Shift+Enter for newline. Reply with "yes" to approve selected staged actions.
          </div>
        )}
        <div className="mt-1.5 flex items-center justify-end gap-1.5">
          <div className="relative">
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
  );
}
