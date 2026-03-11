'use client';

import React from 'react';
import { FrameworkIcons } from '@fromcode119/react';

export function AssistantConversationEmptyState() {
  return (
    <div className="mx-auto flex h-full max-w-3xl -translate-y-12 flex-col items-center justify-center text-center sm:-translate-y-16">
      <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[0_16px_40px_rgba(0,0,0,0.18)] backdrop-blur-xl">
        <FrameworkIcons.Zap size={22} />
      </div>
      <p className="text-[var(--text-sub)]">Welcome back.</p>
      <h2 className="mt-1 text-4xl font-semibold tracking-tight text-[var(--text-main)] sm:text-5xl">How can I help?</h2>
      <p className="mt-3 max-w-lg text-sm text-[var(--text-sub)]">
        Ask anything. I can chat, answer questions, and prepare safe changes when you request edits.
      </p>
    </div>
  );
}
