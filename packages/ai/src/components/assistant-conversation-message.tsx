'use client';

import React from 'react';
import { FrameworkIcons } from '@fromcode119/react';
import { GlassMorphism } from '../ui/glass-morphism';
import { AssistantActionSummary } from './assistant-action-summary';
import { AssistantAttachments } from './assistant-attachments';
import { AssistantExecutionCard } from './assistant-execution-card';
import { AssistantMessageContent } from './assistant-message-content';
import { AssistantTechnicalDetails } from './assistant-technical-details';
import type { AssistantConversationMessageProps } from './assistant-conversation.interfaces';

export function AssistantConversationMessage({ entry, index, forkFromVisibleMessage, setChatMode, showTechnicalDetails }: AssistantConversationMessageProps) {
  const isUser = entry.role === 'user';
  const isAssistant = entry.role === 'assistant';
  const isSystem = entry.role === 'system';
  const showMetaRow = isSystem || !!(entry.provider || entry.model);

  return (
    <div className={`group flex transition-all duration-300 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <article className={`relative max-w-[92%] rounded-2xl border px-3.5 py-3 text-sm shadow-[0_16px_40px_rgba(2,6,23,0.2)] dark:shadow-[0_16px_40px_rgba(2,6,23,0.34)] ${isUser ? GlassMorphism.GLASS_MESSAGE_USER : isAssistant ? GlassMorphism.GLASS_MESSAGE_ASSISTANT : GlassMorphism.GLASS_MESSAGE_SYSTEM}`}>
        {isAssistant ? (
          <button
            type="button"
            onClick={() => forkFromVisibleMessage(index)}
            className="absolute -right-8 top-1/2 -translate-y-1/2 inline-flex h-6 w-6 items-center justify-center rounded-lg border border-slate-300 bg-white text-slate-500 shadow-sm opacity-0 transition-all group-hover:opacity-100 hover:border-slate-400 hover:bg-white hover:text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            title="Fork from this message"
            aria-label="Fork from this message"
          >
            <FrameworkIcons.ArrowLeftRight size={12} />
          </button>
        ) : null}
        {showMetaRow ? (
          <div className="mb-1 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">{isSystem ? <p className="text-[10px] font-bold uppercase tracking-wider opacity-85">System</p> : null}</div>
            {entry.provider || entry.model ? <span className="text-[10px] opacity-70">{[entry.provider, entry.model].filter(Boolean).join(' • ')}</span> : null}
          </div>
        ) : null}
        <AssistantMessageContent entry={entry} messageIndex={index} />
        <AssistantActionSummary entry={entry} setChatMode={setChatMode} />
        <AssistantAttachments entry={entry} />
        <AssistantTechnicalDetails entry={entry} showTechnicalDetails={showTechnicalDetails} />
        <AssistantExecutionCard entry={entry} />
      </article>
    </div>
  );
}
