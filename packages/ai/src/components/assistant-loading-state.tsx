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
          <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-cyan-400/30 to-cyan-400/10 animate-pulse dark:from-cyan-400/25 dark:to-cyan-400/5 shadow-[0_0_16px_rgba(6,182,212,0.3)]" style={{ animationDuration: '2s' }} />
          <div className="relative flex items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500/30 to-cyan-600/20 dark:from-cyan-500/25 dark:to-cyan-600/15 shadow-[0_0_12px_rgba(6,182,212,0.4)]">
            <Icon size={14} className="text-cyan-600 dark:text-cyan-300" />
          </div>
        </div>
        
        <div className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-950">
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
                        ? 'bg-gradient-to-r from-cyan-500 to-cyan-400 dark:from-cyan-400 dark:to-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.6)]'
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
