'use client';

import React from 'react';
import { FrameworkIcons } from '@fromcode119/react';
import type { ForgeHistorySession } from '../admin-assistant-core';
import { GlassMorphism } from '../ui/glass-morphism';

type HistoryPanelProps = {
  showHistory: boolean;
  presentation?: 'docked' | 'overlay';
  historySource: 'server' | 'local';
  historyLoading: boolean;
  historySessions: ForgeHistorySession[];
  activeSessionId: string;
  onRequestClose: () => void;
  startNewSession: () => void;
  openHistorySession: (sessionId: string) => Promise<void>;
  removeHistorySession: (sessionId: string) => void;
};

export function HistoryPanel({
  showHistory,
  presentation = 'docked',
  historySource,
  historyLoading,
  historySessions,
  activeSessionId,
  onRequestClose,
  startNewSession,
  openHistorySession,
  removeHistorySession,
}: HistoryPanelProps) {
  const sidebarContent = (
    <div className="flex h-full w-full flex-col p-4">
      <div className="mb-4 flex h-12 items-center justify-between">
        <span className="text-base font-bold tracking-tight text-[var(--text-main)]">Atlantis Intelligence</span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={startNewSession}
            className={`${GlassMorphism.GLASS_BUTTON} h-9 gap-1 px-2 text-[11px] font-semibold`}
          >
            <FrameworkIcons.Plus size={12} />
            New
          </button>
          <button
            type="button"
            onClick={onRequestClose}
            className={GlassMorphism.GLASS_ICON_BUTTON}
            aria-label="Close history"
          >
            <FrameworkIcons.X size={14} />
          </button>
        </div>
      </div>
      <p className="mb-2 px-1 text-[11px] text-[var(--text-sub)]">History</p>
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
        {historyLoading ? (
          <div className={`${GlassMorphism.GLASS_SUB_PANEL} group px-3 py-3 shadow-sm`}>
            <div className="flex items-center gap-2.5">
              <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--text-main)]" />
              <span className="text-xs font-medium text-[var(--text-sub)]">Loading history</span>
            </div>
          </div>
        ) : historySessions.length === 0 ? (
          <div className={`${GlassMorphism.GLASS_SUB_PANEL} px-3 py-3`}>
            <p className="text-xs text-[var(--text-sub)]">No saved chats yet.</p>
          </div>
        ) : (
          historySessions.map((session) => {
            const active = session.id === activeSessionId;
            const time = new Date(session.updatedAt || Date.now()).toLocaleString();
            return (
              <div
                key={session.id}
                className={`w-full rounded-xl border px-2.5 py-2 transition ${
                  active
                    ? 'border-[var(--text-main)] bg-[var(--surface-strong)] text-[var(--text-main)]'
                    : 'border-[var(--border)] bg-[var(--surface)] text-[var(--text-main)] hover:bg-[var(--surface-strong)]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => void openHistorySession(session.id)}
                  className="w-full text-left"
                >
                  <p className="line-clamp-2 text-xs font-semibold">{session.title}</p>
                  <p className="mt-1 text-[10px] opacity-75">
                    {session.messageCount || session.messages.length || 0} messages {'\u2022'} {time}
                  </p>
                </button>
                <div className="mt-1.5 flex justify-end">
                  <button
                    type="button"
                    onClick={() => removeHistorySession(session.id)}
                    className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-[var(--border)] text-[var(--text-sub)] transition hover:bg-[var(--surface-strong)] hover:text-[var(--text-main)]"
                    title="Delete session"
                    aria-label="Delete session"
                  >
                    <FrameworkIcons.Trash size={11} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  if (presentation === 'overlay') {
    return (
      <>
        <button
          type="button"
          aria-label="Close history panel"
          onClick={onRequestClose}
          className={`fixed inset-0 z-[68] bg-black/30 backdrop-blur-[1px] transition-opacity duration-200 ${
            showHistory ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
        />
        <aside
          className={`fixed left-0 top-0 z-[69] h-full w-[min(92vw,320px)] overflow-hidden border-r border-[var(--border)] bg-[var(--sidebar-bg)] shadow-[0_16px_48px_rgba(0,0,0,0.35)] transition-transform duration-200 ${
            showHistory ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          {sidebarContent}
        </aside>
      </>
    );
  }

  return (
    <aside
      className={`relative z-[60] order-first flex h-full min-h-0 shrink-0 flex-col overflow-hidden border-r border-[var(--border)] bg-[var(--sidebar-bg)] ${
        showHistory ? 'w-[260px]' : 'pointer-events-none w-0 border-transparent'
      }`}
    >
      <div className={`flex h-full w-[260px] flex-col transition-opacity duration-200 ${showHistory ? 'opacity-100' : 'opacity-0'}`}>
        {sidebarContent}
      </div>
    </aside>
  );
}
