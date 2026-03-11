'use client';

import React from 'react';
import { FrameworkIcons } from '@fromcode119/react';

interface AssistantLoadingStateProps {
  mode: 'chat' | 'build' | 'quickfix';
  phase: number;
  totalPhases?: number;
}

const loadingPhases = {
  chat: [
    { label: 'Processing your request...', icon: FrameworkIcons.Activity },
    { label: 'Analyzing context...', icon: FrameworkIcons.Search },
    { label: 'Preparing response...', icon: FrameworkIcons.File },
  ],
  build: [
    { label: 'Analyzing your request...', icon: FrameworkIcons.Search },
    { label: 'Scanning workspace...', icon: FrameworkIcons.Database },
    { label: 'Planning safe changes...', icon: FrameworkIcons.Shield },
    { label: 'Preparing action plan...', icon: FrameworkIcons.File },
  ],
  quickfix: [
    { label: 'Analyzing your request...', icon: FrameworkIcons.Zap },
    { label: 'Selecting tools...', icon: FrameworkIcons.Wrench },
    { label: 'Running diagnostic checks...', icon: FrameworkIcons.Settings },
    { label: 'Preparing response...', icon: FrameworkIcons.Check },
  ],
};

export function AssistantLoadingState({ mode, phase, totalPhases }: AssistantLoadingStateProps) {
  const phases = loadingPhases[mode] || loadingPhases.chat;
  const currentPhase = phases[phase % phases.length];
  const Icon = currentPhase.icon;

  const currentStepIndex = phase % phases.length;

  return (
    <div className="flex w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex max-w-[92%] gap-3 items-start">
        {/* Simple Avatar */}
        <div className="relative flex h-8 w-8 shrink-0 items-center justify-center mt-1">
          <div className="absolute inset-0 rounded-lg bg-[var(--surface-strong)] animate-pulse shadow-[0_0_14px_rgba(15,23,42,0.24)]" style={{ animationDuration: '2s' }} />
          <div className="relative flex items-center justify-center rounded-lg bg-[var(--surface)] shadow-[0_0_10px_rgba(15,23,42,0.2)]">
            <Icon size={14} className="text-[var(--text-sub)]" />
          </div>
        </div>
        
        <div className="flex-1 rounded-xl border border-white/62 bg-white/72 px-4 py-3 shadow-[0_12px_28px_rgba(15,23,42,0.16)] backdrop-blur-xl dark:border-white/12 dark:bg-slate-900/52 dark:shadow-[0_12px_28px_rgba(2,6,23,0.48)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                {currentPhase.label}
              </p>
              {/* Simple Step Bar */}
              <div className="mt-2 flex gap-1">
                {phases.map((_, idx) => (
                  <div
                    key={idx}
                    className={`h-0.5 w-1.5 rounded-full transition-all duration-300 ${
                      idx <= currentStepIndex
                        ? 'bg-[var(--text-main)] shadow-[0_0_8px_rgba(15,23,42,0.32)]'
                        : 'bg-slate-300/30 dark:bg-slate-700/40'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
