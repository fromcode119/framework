'use client';

import React from 'react';
import { FrameworkIcons } from '@fromcode119/react';
import { GLASS_BUTTON } from '../ui/glass-morphism';

export type ConversationMode = 'chat' | 'build' | 'quickfix';

interface AssistantModeSelectorProps {
  mode: ConversationMode;
  onChange: (mode: ConversationMode) => void;
  disabled?: boolean;
}

const modes: Array<{
  value: ConversationMode;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  description: string;
}> = [
  {
    value: 'chat',
    icon: FrameworkIcons.MessageSquare,
    label: 'Chat',
    description: 'Answer questions and give advice',
  },
  {
    value: 'build',
    icon: FrameworkIcons.Wrench,
    label: 'Build',
    description: 'Make changes to my site',
  },
  {
    value: 'quickfix',
    icon: FrameworkIcons.Zap,
    label: 'Quick Fix',
    description: 'Apply simple updates immediately',
  },
];

export function AssistantModeSelector({ mode, onChange, disabled = false }: AssistantModeSelectorProps) {
  return (
    <div className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-700 dark:bg-slate-900">
      {modes.map((modeOption) => {
        const Icon = modeOption.icon;
        const isActive = mode === modeOption.value;
        
        return (
          <button
            key={modeOption.value}
            type="button"
            onClick={() => !disabled && onChange(modeOption.value)}
            disabled={disabled}
            className={`group relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              isActive
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
            title={modeOption.description}
          >
            <Icon size={14} />
            <span>{modeOption.label}</span>
            
            {/* Tooltip on hover */}
            <div className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-xs text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 dark:bg-white dark:text-slate-900">
              {modeOption.description}
              <div className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-4 border-transparent border-t-slate-900 dark:border-t-white" />
            </div>
          </button>
        );
      })}
    </div>
  );
}
