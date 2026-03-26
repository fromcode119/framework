'use client';

import React from 'react';
import { FrameworkIcons } from '@fromcode119/react';
import type { ConversationMode } from '../../admin-assistant-core';
import { Select } from '../../ui/select';

interface AssistantComposerToolbarProps {
  mode: ConversationMode;
  onModeChange: (value: string) => void;
  openFilePicker: () => void;
  uploadingAttachments: boolean;
  developerMode: boolean;
  toolsButtonRef: React.RefObject<HTMLButtonElement | null>;
  showTools: boolean;
  setShowTools: (val: boolean | ((prev: boolean) => boolean)) => void;
  activeTools: number;
  totalTools: number;
  sendPrompt: () => void;
  sendDisabled: boolean;
}

export function AssistantComposerToolbar({
  mode,
  onModeChange,
  openFilePicker,
  uploadingAttachments,
  developerMode,
  toolsButtonRef,
  showTools,
  setShowTools,
  activeTools,
  totalTools,
  sendPrompt,
  sendDisabled,
}: AssistantComposerToolbarProps) {
  const modeOptions = React.useMemo(
    () => [
      { value: 'chat', label: 'Chat' },
      { value: 'build', label: 'Build' },
      { value: 'quickfix', label: 'Quick Fix' },
    ],
    [],
  );

  return (
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
            onChange={onModeChange}
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
          onClick={sendPrompt}
          disabled={sendDisabled}
          className="inline-flex h-7 w-7 items-center justify-center rounded border border-[var(--border)] bg-[var(--text-main)] text-[var(--bg)] transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
          title="Send"
        >
          <FrameworkIcons.Send size={12} />
        </button>
      </div>
    </div>
  );
}
