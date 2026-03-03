'use client';

import React from 'react';
import { FrameworkIcons } from '@fromcode119/react';
import { GLASS_BUTTON } from '../ui/glass-morphism';
import { AssistantMessage, AssistantAction } from '../assistant-utils';
import { AssistantMessage as AssistantMessageComponent } from './assistant-message';

interface AssistantMessagesProps {
  messages: AssistantMessage[];
  lastActions: AssistantAction[];
  setChatMode: (mode: 'auto' | 'plan' | 'agent') => void;
  sendPrompt: (forced?: string) => Promise<void>;
  setSelectedActionIndexes: (idxs: number[]) => void;
  selectedActionIndexes: number[];
  toggleActionIndex: (idx: number) => void;
  executing: boolean;
  runActions: (options?: { dryRun?: boolean; invokedByApproval?: boolean }) => Promise<void>;
  sandboxMode: boolean;
  chatMode: 'auto' | 'plan' | 'agent';
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

export function AssistantMessages({
  messages,
  lastActions,
  setChatMode,
  sendPrompt,
  setSelectedActionIndexes,
  selectedActionIndexes,
  toggleActionIndex,
  executing,
  runActions,
  sandboxMode,
  chatMode,
  messagesEndRef,
}: AssistantMessagesProps) {
  if (messages.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-200 bg-white/50 text-slate-400 shadow-sm dark:border-white/10 dark:bg-white/5 dark:text-slate-500">
          <FrameworkIcons.Activity size={32} strokeWidth={1.5} />
        </div>
        <h2 className="mb-2 text-xl font-bold tracking-tight text-slate-900 dark:text-white">
          Forge AI Assistant
        </h2>
        <p className="max-w-sm text-sm leading-relaxed text-slate-500 dark:text-slate-400">
          Welcome to your professional workspace assistant. Select a provider and model above to start
          building, planning, or exploring.
        </p>
        <div className="mt-8 grid w-full max-w-lg gap-3 sm:grid-cols-2">
          <button
            onClick={() => void sendPrompt('Show me available tools')}
            className="flex flex-col items-start rounded-xl border border-slate-200 bg-white/80 p-3.5 text-left transition hover:border-sky-400/50 hover:bg-sky-50/50 dark:border-white/10 dark:bg-white/5 dark:hover:border-sky-400/30 dark:hover:bg-sky-900/10"
          >
            <FrameworkIcons.Settings size={18} className="mb-2 text-sky-500" />
            <span className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">
              Tool capabilities
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              List available automation tools
            </span>
          </button>
          <button
            onClick={() => void sendPrompt('How can you help me build this site?')}
            className="flex flex-col items-start rounded-xl border border-slate-200 bg-white/80 p-3.5 text-left transition hover:border-indigo-400/50 hover:bg-indigo-50/50 dark:border-white/10 dark:bg-white/5 dark:hover:border-indigo-400/30 dark:hover:bg-indigo-900/10"
          >
            <FrameworkIcons.Database size={18} className="mb-2 text-indigo-500" />
            <span className="text-[13px] font-semibold text-slate-900 dark:text-slate-100">
              Build support
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Guidance for your next feature
            </span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24 pt-4">
      {messages.map((entry, index) => (
        <AssistantMessageComponent
          key={`${entry.role}-${index}`}
          message={entry}
          isLast={index === messages.length - 1}
          executing={executing}
          runActions={runActions}
          selectedActionIndexes={selectedActionIndexes}
          setSelectedActionIndexes={setSelectedActionIndexes}
        />
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}
