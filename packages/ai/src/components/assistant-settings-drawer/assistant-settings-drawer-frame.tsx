'use client';

import React from 'react';

interface AssistantSettingsDrawerFrameProps {
  isOpen: boolean;
  presentation: 'docked' | 'overlay';
  onRequestClose: () => void;
  children: React.ReactNode;
}

export function AssistantSettingsDrawerFrame({
  isOpen,
  presentation,
  onRequestClose,
  children,
}: AssistantSettingsDrawerFrameProps) {
  return (
    <>
      {presentation === 'overlay' ? (
        <div
          className={`fixed inset-0 z-40 bg-black/30 backdrop-blur-sm transition-opacity duration-300 ${
            isOpen ? 'animate-[fade-in_0.3s_ease-out]' : 'opacity-0 pointer-events-none'
          }`}
          onClick={onRequestClose}
          aria-hidden="true"
        />
      ) : null}
      <aside
        className={`flex h-full flex-col overflow-hidden bg-[var(--sidebar-bg)] ${
          presentation === 'overlay'
            ? `fixed right-0 top-0 z-50 w-full max-w-md border-l border-[var(--border)] transition-transform duration-300 ease-out ${
                isOpen ? 'animate-[slide-in-right_0.3s_ease-out]' : 'pointer-events-none translate-x-full'
              } shadow-[0_18px_56px_rgba(0,0,0,0.3)]`
            : `relative z-[60] order-last max-w-[92vw] transition-[width,opacity] duration-200 ${
                isOpen
                  ? 'w-[300px] border-l border-[var(--border)] opacity-100'
                  : 'pointer-events-none w-0 border-transparent opacity-0'
              }`
        }`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        {children}
      </aside>
    </>
  );
}
