'use client';

import React from 'react';
import { FrameworkIcons } from '@fromcode119/react';
import { ForgeHistorySession } from '../assistant-utils';

export function ForgeHistory({
  showHistory,
  setShowHistory,
  historySessions,
  activeSessionId,
  startNewSession,
  openHistorySession,
}: {
  showHistory: boolean;
  setShowHistory: (val: boolean) => void;
  historySessions: ForgeHistorySession[];
  activeSessionId: string;
  startNewSession: () => void;
  openHistorySession: (id: string) => void;
}) {
  return (
    <aside
      className={`fixed inset-y-0 left-0 z-30 flex w-full flex-col border-r border-slate-200 bg-white/98 backdrop-blur-md transition-all duration-300 dark:border-slate-800 dark:bg-slate-950/98 sm:w-96 ${
        showHistory ? 'translate-x-0 opacity-100' : 'pointer-events-none -translate-x-[110%] opacity-0'
      }`}
    >
      <div className="border-b border-slate-200 p-5 dark:border-slate-800">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">History</h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Recent chats and reusable runs.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={startNewSession}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-xs font-medium text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
            >
              <FrameworkIcons.Plus size={14} />
              New
            </button>
            <button
              type="button"
              onClick={() => setShowHistory(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-900 dark:hover:text-slate-300"
              aria-label="Close history"
            >
              <FrameworkIcons.X size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto p-3">
        {historySessions.length === 0 ? (
          <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
            No saved chats yet.
          </p>
        ) : (
          historySessions.map((session) => {
            const active = session.id === activeSessionId;
            const time = new Date(session.updatedAt || Date.now()).toLocaleString();
            return (
              <button
                key={session.id}
                type="button"
                onClick={() => openHistorySession(session.id)}
                className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                  active
                    ? 'border-cyan-300 bg-cyan-50 text-cyan-900 dark:border-cyan-300/60 dark:bg-cyan-300/12 dark:text-cyan-100'
                    : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200 dark:hover:border-slate-600'
                }`}
              >
                <p className="line-clamp-2 text-xs font-semibold">{session.title}</p>
                <p className="mt-1 text-[10px] opacity-75">
                  {session.provider} • {session.model || 'default'} • {time}
                </p>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
}
