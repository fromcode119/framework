"use client";

import React from 'react';
import { FrameworkIcons } from '@fromcode119/react';
import { AdminConstants } from '@/lib/constants';
import SecondarySidebarPanelBody from './secondary-sidebar-panel-body';
import type { SecondarySidebarDesktopProps } from './secondary-sidebar.types';

const {
  Left = () => null,
  Right = () => null,
} = (FrameworkIcons || {}) as any;

export default function SecondarySidebarDesktop(props: SecondarySidebarDesktopProps) {
  // A hover-preview pops the panel out as a floating overlay even when the user
  // hasn't docked it. Docked-open keeps reserving layout width and pushes content.
  const isOverlay = !props.isOpen && Boolean(props.hoverOpen);
  const expanded = props.isOpen || Boolean(props.hoverOpen);

  if (!expanded) {
    // Collapsed: reserve ZERO layout width (w-0) so content fills the space; a clearly visible
    // expand handle floats over the content's left edge instead of cutting a gap. (The previous
    // 4px sliver was effectively invisible, so users couldn't find any way to re-open the panel.)
    const collapsedLabel = (props.sourceLabel || 'Menu').trim();
    return (
      <div className="sticky top-16 z-50 h-[calc(100vh-4rem)] w-0 shrink-0 self-start overflow-visible">
        <button
          ref={props.triggerRef}
          type="button"
          title={`Open ${collapsedLabel} navigation`}
          aria-label={`Open ${collapsedLabel} navigation`}
          aria-expanded="false"
          aria-controls={AdminConstants.SECONDARY_SIDEBAR.PANEL_ID}
          onClick={props.onOpen}
          className="group absolute left-0 top-20 z-50 inline-flex flex-col items-center gap-2 rounded-r-xl border border-l-0 border-indigo-200 bg-white py-3 pl-1 pr-1.5 text-indigo-600 shadow-[6px_0_20px_-10px_rgba(79,70,229,0.45)] transition-all hover:bg-indigo-50 hover:pr-2.5 dark:border-indigo-500/40 dark:bg-[#020617] dark:text-indigo-300 dark:hover:bg-indigo-500/10"
        >
          <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 transition-colors group-hover:bg-indigo-600 group-hover:text-white dark:bg-indigo-500/15 dark:text-indigo-300">
            <Right size={14} />
          </span>
          <span className="text-[10px] font-bold uppercase tracking-wider [writing-mode:vertical-rl]">{collapsedLabel}</span>
        </button>
      </div>
    );
  }

  return (
    <aside
      id={AdminConstants.SECONDARY_SIDEBAR.PANEL_ID}
      className={`${isOverlay
        ? `fixed top-16 ${props.overlayLeftClass || 'left-64'} z-40 h-[calc(100vh-4rem)] rounded-r-xl`
        : 'sticky top-0 z-30 ml-[-1px] h-screen shrink-0'} flex w-[var(--secondary-sidebar-width)] overflow-hidden border-r shadow-[-18px_0_36px_-28px_rgba(79,70,229,0.26),-10px_0_24px_-24px_rgba(15,23,42,0.22)] dark:shadow-[-18px_0_36px_-28px_rgba(99,102,241,0.18),-10px_0_24px_-24px_rgba(2,6,23,0.88)] ${props.hasActiveItem ? 'border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(244,246,255,0.60)_100%)] ring-1 ring-inset ring-indigo-100/20 dark:border-slate-800 dark:bg-[linear-gradient(180deg,rgba(30,41,59,0.96)_0%,rgba(37,99,235,0.05)_100%)] dark:ring-indigo-500/5' : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-[#020617]'}`}
      aria-label="Secondary navigation"
      onMouseEnter={props.onPanelMouseEnter}
      onMouseLeave={props.onPanelMouseLeave}
    >
      <button
        type="button"
        onClick={props.onClose}
        className="absolute right-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        aria-label="Minimize secondary navigation"
      >
        <Left size={14} />
      </button>
      <SecondarySidebarPanelBody
        context={props.context}
        items={props.items}
        sourceLabel={props.sourceLabel}
        pathname={props.pathname}
        onListKeyDown={props.onListKeyDown}
        onItemActivate={(item) => props.onItemActivate?.(item)}
        onMouseEnter={props.onPanelMouseEnter}
        onMouseLeave={props.onPanelMouseLeave}
      />
    </aside>
  );
}
