'use client';

import React, { useState } from 'react';
import { FrameworkIcons } from '@fromcode119/react';
import { GlassMorphism } from '../ui/glass-morphism';

import type { AssistantMessageBubbleProps } from './assistant-message-bubble.interfaces';

export function AssistantMessageBubble({
  role,
  content,
  timestamp,
  status = 'sent',
  onCopy,
  onRegenerate,
  onEdit,
}: AssistantMessageBubbleProps) {
  const [showActions, setShowActions] = useState(false);
  const [copied, setCopied] = useState(false);

  const isUser = role === 'user';
  const isAssistant = role === 'assistant';

  const handleCopy = () => {
    if (onCopy) {
      onCopy();
    } else {
      navigator.clipboard.writeText(content);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  return (
    <div
      className={`flex w-full animate-in fade-in slide-in-from-bottom-2 duration-300 ${
        isUser ? 'justify-end' : 'justify-start'
      }`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className={`flex max-w-[92%] gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* Avatar */}
        {isAssistant && (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--text-sub)] shadow-[0_4px_14px_rgba(15,23,42,0.14)]">
            <FrameworkIcons.Activity size={16} />
          </div>
        )}

        {/* Message Content */}
        <div className="flex-1 space-y-1.5">
          {/* Bubble */}
          <div
            className={`group relative overflow-hidden rounded-2xl px-4 py-3 shadow-[0_16px_40px_rgba(2,6,23,0.18)] backdrop-blur-xl transition-all dark:shadow-[0_16px_40px_rgba(2,6,23,0.34)] ${
              isUser
                ? 'border border-slate-300/85 bg-slate-900 text-white dark:border-slate-600/70 dark:bg-slate-800/90'
                : 'border border-slate-200/80 bg-white/92 text-slate-900 dark:border-slate-700/70 dark:bg-slate-900/70 dark:text-white'
            } ${status === 'sending' ? 'opacity-60' : ''} ${status === 'error' ? 'border-red-300 bg-red-50/95 dark:border-red-700 dark:bg-red-900/30' : ''}`}
          >
            {/* Status Indicator */}
            {status === 'sending' && (
              <div className="absolute right-2 top-2">
                <div className="h-2 w-2 animate-pulse rounded-full bg-white/50" />
              </div>
            )}
            {status === 'error' && (
              <div className="absolute right-2 top-2">
                <FrameworkIcons.Alert size={16} className="text-red-600 dark:text-red-400" />
              </div>
            )}

            {/* Text Content */}
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <p className="m-0 whitespace-pre-wrap break-words leading-relaxed">{content}</p>
            </div>
          </div>

          {/* Metadata Row */}
          <div
            className={`flex items-center gap-2 px-1 text-xs text-slate-500 dark:text-slate-400 ${
              isUser ? 'justify-end' : 'justify-start'
            }`}
          >
            {/* Timestamp */}
            {timestamp && <span>{formatTime(timestamp)}</span>}

            {/* Actions - only show on hover */}
            {showActions && status === 'sent' && (
              <div className="flex items-center gap-1.5 animate-in fade-in duration-200">
                {/* Copy */}
                {onCopy !== undefined && (
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 rounded-md px-1.5 py-0.5 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                    title="Copy message"
                  >
                    {copied ? (
                      <>
                        <FrameworkIcons.Check size={12} className="text-emerald-600 dark:text-emerald-500" />
                        <span className="text-emerald-600 dark:text-emerald-500">Copied</span>
                      </>
                    ) : (
                      <>
                        <FrameworkIcons.Code size={12} />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                )}

                {/* Regenerate (assistant only) */}
                {isAssistant && onRegenerate && (
                  <button
                    onClick={onRegenerate}
                    className="flex items-center gap-1 rounded-md px-1.5 py-0.5 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                    title="Regenerate response"
                  >
                    <FrameworkIcons.Refresh size={12} />
                    <span>Retry</span>
                  </button>
                )}

                {/* Edit (user only) */}
                {isUser && onEdit && (
                  <button
                    onClick={onEdit}
                    className="flex items-center gap-1 rounded-md px-1.5 py-0.5 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
                    title="Edit message"
                  >
                    <FrameworkIcons.Edit size={12} />
                    <span>Edit</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* User Avatar (optional) */}
        {isUser && (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
            <FrameworkIcons.User size={16} />
          </div>
        )}
      </div>
    </div>
  );
}
