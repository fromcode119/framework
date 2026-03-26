'use client';

import React from 'react';
import { AssistantConstants } from '../admin-assistant-core';
import type { ConversationMode } from '../admin-assistant-core';
import { GlassMorphism } from '../ui/glass-morphism';
import type { AssistantComposerProps } from './assistant-composer/assistant-composer.interfaces';
import { AssistantComposerAttachments } from './assistant-composer/assistant-composer-attachments';
import { AssistantComposerToolbar } from './assistant-composer/assistant-composer-toolbar';

const MAX_PROMPT_LENGTH = AssistantConstants.MAX_PROMPT_LENGTH;

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
}: AssistantComposerProps) {
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
          <AssistantComposerAttachments attachments={attachments} removeAttachment={removeAttachment} />
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
          <AssistantComposerToolbar
            mode={mode}
            onModeChange={handleModeChange}
            openFilePicker={openFilePicker}
            uploadingAttachments={uploadingAttachments}
            developerMode={developerMode}
            toolsButtonRef={toolsButtonRef}
            showTools={showTools}
            setShowTools={setShowTools}
            activeTools={activeTools}
            totalTools={totalTools}
            sendPrompt={() => void sendPrompt()}
            sendDisabled={!prompt.trim() || loading || checkingIntegration || !integrationConfigured || uploadingAttachments}
          />
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
