'use client';

import React from 'react';
import { FrameworkIcons } from '@fromcode119/react';
import { AssistantFormatUtils } from '../assistant-format-utils';
import type { AssistantAttachmentsProps } from './assistant-conversation.interfaces';

export function AssistantAttachments({ entry }: AssistantAttachmentsProps) {
  if (!entry.attachments || entry.attachments.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {entry.attachments.map((item, attachmentIndex) => {
        const size = AssistantFormatUtils.formatFileSize(item.size);
        const detail = [item.mimeType || '', size].filter(Boolean).join(' • ');
        const href = item.url || item.path;
        const className = 'inline-flex max-w-full items-center gap-1.5 rounded-full border border-slate-400/40 bg-slate-800/55 px-2 py-1 text-[10px] text-slate-100 dark:border-slate-600/60 dark:bg-slate-800/65';

        if (!href) {
          return (
            <span key={`${item.name}-${attachmentIndex}`} className={className}>
              <FrameworkIcons.Upload size={10} />
              <span className="truncate max-w-[220px]">{item.name}</span>
              {detail ? <span className="opacity-75">{detail}</span> : null}
            </span>
          );
        }

        return (
          <a key={`${href}-${attachmentIndex}`} href={href} target="_blank" rel="noreferrer" className={`${className} transition hover:bg-slate-700/65`}>
            <FrameworkIcons.Upload size={10} />
            <span className="truncate max-w-[220px]">{item.name}</span>
            {detail ? <span className="opacity-75">{detail}</span> : null}
          </a>
        );
      })}
    </div>
  );
}
