'use client';

import React from 'react';
import { FrameworkIcons } from '@fromcode119/react';
import {
  AssistantConstants,
} from '../admin-assistant-core';
const MAX_PROMPT_LENGTH = AssistantConstants.MAX_PROMPT_LENGTH;
import type { ConversationMode, UploadedAttachment } from '../admin-assistant-core';
import { GlassMorphism } from '../ui/glass-morphism';
import { Select } from '../ui/select';
import { AssistantFormatUtils } from '../assistant-format-utils';

export function AssistantComposer({
  prompt,
  setPrompt,
  loading,
  checkingIntegration,
  integrationConfigured,
  uploadingAttachments,
  sendPrompt,
  onComposerKeyDown,
  onQuickFix,
  mode,
  setMode,
  attachments,
  removeAttachment,
  openFilePicker,
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
  developerMode,
}: {
  prompt: string;
  setPrompt: (val: string) => void;
  loading: boolean;
  checkingIntegration: boolean;
  integrationConfigured: boolean;
  uploadingAttachments: boolean;
  sendPrompt: (forced?: string) => Promise<void>;
  onComposerKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onQuickFix: () => void;
  mode: ConversationMode;
  setMode: (mode: ConversationMode) => void;
  attachments: UploadedAttachment[];
  removeAttachment: (idx: number) => void;
  openFilePicker: () => void;
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
  developerMode: boolean;
}) {
  const modeOptions = React.useMemo(
    () => [
      { value: 'chat', label: 'Chat' },
      { value: 'build', label: 'Build' },
      { value: 'quickfix', label: 'Quick Fix' },
    ],
    []
  );

  const handleModeChange = React.useCallback(
    (value: string) => {
      const nextMode = String(value || '') as ConversationMode;
      if (nextMode === 'quickfix') {
        onQuickFix();
        return;
      }
      setMode(nextMode);
    },
    [onQuickFix, setMode]
  );

  return (
    <div ref={composerRef} className="w-full px-5 pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)] sm:pb-8">
      <div className="mx-auto w-full max-w-[840px]">
        {!hasConversation ? (
          <div className="mb-2 flex flex-wrap gap-2">
            {quickPrompts.map((item) => (
              <button
                key={`chip-${item}`}
                type="button"
                onClick={() => setPrompt(item)}
                className={`${GlassMorphism.GLASS_BUTTON} rounded-full px-2.5 py-1 text-[11px] text-[var(--text-sub)]`}
              >
                {item}
              </button>
            ))}
          </div>
        ) : null}
        <div className="overflow-hidden rounded-md border border-[var(--border)] bg-[var(--input-bg)] shadow-[0_1px_2px_rgba(0,0,0,0.4)]">
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
                const size = AssistantFormatUtils.formatFileSize(item.size);
                const detail = [item.mimeType || '', size].filter(Boolean).join(' • ');
                return (
                  <div
                    key={`${item.url || item.path || item.name}-${attachmentIndex}`}
                    className="inline-flex max-w-full items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[10px] text-[var(--text-main)]"
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
          <textarea
            ref={textareaRef}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value.slice(0, MAX_PROMPT_LENGTH))}
            onKeyDown={onComposerKeyDown}
            placeholder={
              mode === 'build'
                ? 'Describe what should change. I will prepare changes for review.'
                : mode === 'quickfix'
                  ? 'Describe the fix. I will move fast and keep changes safe.'
                  : 'Ask a question or enter a command...'
            }
            className="min-h-12 max-h-[300px] w-full resize-none overflow-y-auto border-0 bg-transparent px-4 py-3 text-sm leading-relaxed text-[var(--text-main)] outline-none placeholder:text-[var(--text-sub)]"
          />
          <div className="flex items-center justify-between border-t border-[var(--border)] bg-[var(--surface)] px-3 py-1.5">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={openFilePicker}
                disabled={uploadingAttachments}
                className="inline-flex h-7 w-7 items-center justify-center rounded border border-[var(--border)] bg-[var(--text-main)] text-[var(--bg)] transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
                title="Attach file"
                aria-label="Attach file"
              >
                <FrameworkIcons.Plus size={12} />
              </button>
            </div>
            <div className="flex items-center gap-3">
              {developerMode ? (
                <button
                  ref={toolsButtonRef}
                  type="button"
                  onClick={() => setShowTools((prev) => !prev)}
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-md border transition ${
                    showTools
                      ? 'border-[var(--accent)] bg-[color-mix(in_oklab,var(--accent)_22%,transparent)] text-[var(--text-main)]'
                      : 'border-transparent bg-transparent text-[var(--text-sub)] hover:border-[var(--border)] hover:bg-[var(--surface)] hover:text-[var(--text-main)]'
                  }`}
                  title={`Tools (${activeTools}/${totalTools})`}
                  aria-label={`Tools (${activeTools}/${totalTools})`}
                >
                  <FrameworkIcons.Wrench size={11} />
                </button>
              ) : null}
              <div className="w-[120px] shrink-0">
                <Select
                  value={mode}
                  onChange={handleModeChange}
                  options={modeOptions}
                  compact
                  searchable={false}
                  className="w-full"
                />
              </div>
              <span className="hidden text-[10px] font-mono text-[var(--text-sub)] opacity-60 sm:inline">
                Enter to send • Shift+Enter new line
              </span>
              <button
                type="button"
                onClick={() => void sendPrompt()}
                disabled={!prompt.trim() || loading || checkingIntegration || !integrationConfigured || uploadingAttachments}
                className="inline-flex h-7 w-7 items-center justify-center rounded border border-[var(--border)] bg-[var(--text-main)] text-[var(--bg)] transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
                title="Send"
              >
                <FrameworkIcons.Send size={12} />
              </button>
            </div>
          </div>
          {uploadingAttachments ? (
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5">
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--text-main)]" />
              <span className="text-xs font-medium text-[var(--text-sub)]">Uploading assets</span>
            </div>
          ) : null}
        </div>
        <div className="mt-1.5 flex items-center justify-end gap-2 px-1 text-[10px] text-[var(--text-sub)]">
          <div>{promptUsage}</div>
        </div>
      </div>
    </div>
  );
}
