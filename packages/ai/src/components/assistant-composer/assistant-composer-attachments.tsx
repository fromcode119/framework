'use client';

import React from 'react';
import { FrameworkIcons } from '@fromcode119/react';
import { AssistantFormatUtils } from '../../assistant-format-utils';
import type { UploadedAttachment } from '../../admin-assistant-core';

interface AssistantComposerAttachmentsProps {
  attachments: UploadedAttachment[];
  removeAttachment: (idx: number) => void;
}

export function AssistantComposerAttachments({
  attachments,
  removeAttachment,
}: AssistantComposerAttachmentsProps) {
  if (attachments.length === 0) {
    return null;
  }

  return (
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
  );
}
