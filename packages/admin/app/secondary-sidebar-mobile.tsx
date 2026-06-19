"use client";

import React from 'react';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminConstants } from '@/lib/constants';
import SecondarySidebarPanelBody from './secondary-sidebar-panel-body';
import type { SecondarySidebarMobileProps } from './secondary-sidebar.types';

const {
  Close = () => null,
  Right = () => null,
} = (FrameworkIcons || {}) as any;

export default function SecondarySidebarMobile(props: SecondarySidebarMobileProps) {
  return (
    <>
      <button
        ref={props.triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={props.isOpen}
        aria-controls={AdminConstants.SECONDARY_SIDEBAR.PANEL_ID}
        onClick={props.onOpen}
        className={`fixed z-[170] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 shadow-lg hover:border-indigo-400/70 transition-colors ${props.mode === 'mobile' ? 'bottom-6 right-6 h-12 w-12' : 'bottom-6 left-[84px] h-10 w-10'}`}
      >
        <Right size={18} />
      </button>

      {props.isOpen && (
        <div className="fixed inset-0 z-[180]">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={props.onClose} />
          <div
            ref={props.dialogRef}
            id={AdminConstants.SECONDARY_SIDEBAR.PANEL_ID}
            role="dialog"
            aria-modal="true"
            aria-label="Secondary navigation"
            className={`absolute top-0 bottom-0 w-[var(--secondary-sidebar-width)] overflow-hidden bg-white shadow-2xl dark:bg-[#020617] flex ${props.mode === 'mobile' ? 'right-0' : 'left-[72px] shadow-[-18px_0_36px_-28px_rgba(79,70,229,0.26),-10px_0_24px_-24px_rgba(15,23,42,0.22)] dark:shadow-[-18px_0_36px_-28px_rgba(99,102,241,0.18),-10px_0_24px_-24px_rgba(2,6,23,0.88)]'}`}
            onKeyDown={props.onOverlayKeyDown}
          >
            <div className="flex min-w-0 flex-1 flex-col">
            <div className="h-16 px-4 flex items-center justify-between border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-[#020617]">
              <h2 className="text-[13px] font-bold text-slate-900 dark:text-white">Secondary Navigation</h2>
              <button
                type="button"
                onClick={props.onClose}
                className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Close secondary navigation"
              >
                <Close size={16} />
              </button>
            </div>

            <SecondarySidebarPanelBody
              context={props.context}
              items={props.items}
              sourceLabel={props.sourceLabel}
              pathname={props.pathname}
              onListKeyDown={props.onListKeyDown}
              onItemActivate={(item) => {
                props.onItemActivate?.(item);
                props.onClose();
              }}
            />
            </div>
          </div>
        </div>
      )}

      <span className="sr-only" aria-live="polite">{props.liveMessage}</span>
    </>
  );
}
