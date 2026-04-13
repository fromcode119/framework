'use client';

import React from 'react';
import { FrameworkIcons } from '@fromcode119/react';
import { GlassMorphism } from '../ui/glass-morphism';

interface AssistantSimpleTopBarProps {
  sessionTitle?: string;
  historyCount?: number;
  onBackToAdmin: () => void;
  onHistoryToggle: () => void;
  onSettingsOpen: () => void;
  onThemeToggle: () => void;
  themeMode: 'light' | 'dark';
}

export function AssistantSimpleTopBar({
  sessionTitle = 'Atlantis Intelligence',
  historyCount = 0,
  onBackToAdmin,
  onHistoryToggle,
  onSettingsOpen,
  onThemeToggle,
  themeMode,
}: AssistantSimpleTopBarProps) {
  return (
    <header className="relative z-20 flex h-16 items-center justify-between px-5">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBackToAdmin}
          className={GlassMorphism.GLASS_ICON_BUTTON}
          title="Back to admin"
          aria-label="Back to admin"
        >
          <FrameworkIcons.Home size={14} />
        </button>
        <button
          type="button"
          onClick={onHistoryToggle}
          className={GlassMorphism.GLASS_ICON_BUTTON}
          title="Toggle history"
          aria-label="Toggle history"
        >
          <FrameworkIcons.Menu size={14} />
        </button>
        <div className="hidden rounded-full border border-white/40 bg-white/40 px-3 py-1 text-xs font-semibold text-[var(--text-main)] shadow-sm backdrop-blur dark:border-white/10 dark:bg-slate-950/40 sm:inline-flex">
          {sessionTitle}
          {historyCount > 0 ? ` • ${historyCount}` : ''}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onSettingsOpen}
          className={GlassMorphism.GLASS_ICON_BUTTON}
          title="Toggle settings"
          aria-label="Toggle settings"
        >
          <FrameworkIcons.More size={14} />
        </button>
        <button
          type="button"
          onClick={onThemeToggle}
          className={GlassMorphism.GLASS_ICON_BUTTON}
          title={`Switch to ${themeMode === 'dark' ? 'light' : 'dark'} mode`}
          aria-label="Toggle theme"
        >
          {themeMode === 'dark' ? <FrameworkIcons.Sun size={13} /> : <FrameworkIcons.Moon size={13} />}
        </button>
      </div>
    </header>
  );
}
