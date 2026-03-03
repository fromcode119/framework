'use client';

import React from 'react';
import { FrameworkIcons } from '@fromcode119/react';
import { GLASS_BUTTON } from '../ui/glass-morphism';

interface AssistantSimpleTopBarProps {
  sessionTitle?: string;
  historyCount?: number;
  onHistoryToggle: () => void;
  onSettingsOpen: () => void;
  onThemeToggle: () => void;
  themeMode: 'light' | 'dark';
}

export function AssistantSimpleTopBar({
  sessionTitle = 'Forge AI',
  historyCount = 0,
  onHistoryToggle,
  onSettingsOpen,
  onThemeToggle,
  themeMode,
}: AssistantSimpleTopBarProps) {
  return (
    <div className="fixed right-4 top-4 z-40 flex justify-end gap-1.5 sm:right-6 sm:top-6">
      {/* History Button with Count Badge */}
      <button
        type="button"
        onClick={onHistoryToggle}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-slate-900/10 px-2.5 text-[10px] font-semibold text-slate-700 backdrop-blur-md transition hover:bg-slate-900/15 dark:bg-white/12 dark:text-slate-200 dark:hover:bg-white/18"
        title="View conversation history"
      >
        <FrameworkIcons.Clock size={11} />
        {historyCount > 0 && (
          <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-cyan-400/30 px-1 text-[9px] font-bold text-cyan-700 dark:bg-cyan-400/25 dark:text-cyan-100">
            {historyCount > 99 ? '99+' : historyCount}
          </span>
        )}
      </button>

      {/* Theme Toggle */}
      <button
        type="button"
        onClick={onThemeToggle}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900/10 text-slate-700 backdrop-blur-md transition hover:bg-slate-900/15 dark:bg-white/12 dark:text-slate-200 dark:hover:bg-white/18"
        title={`Switch to ${themeMode === 'dark' ? 'light' : 'dark'} mode`}
      >
        {themeMode === 'dark' ? <FrameworkIcons.Sun size={12} /> : <FrameworkIcons.Moon size={12} />}
      </button>

      {/* Settings Toggle */}
      <button
        type="button"
        onClick={onSettingsOpen}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900/10 text-slate-700 backdrop-blur-md transition hover:bg-slate-900/15 dark:bg-white/12 dark:text-slate-200 dark:hover:bg-white/18"
        title="Open settings"
      >
        <FrameworkIcons.Settings size={13} />
      </button>
    </div>
  );
}
