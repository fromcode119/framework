"use client";

import React from 'react';
import { usePathname } from 'next/navigation';
import { FrameworkIcons } from '@/lib/icons';
import { AdminConstants } from '@/lib/constants';
import { NavUtils } from '@/lib/nav-utils';
import SecondarySidebarPanelBody from './secondary-sidebar-panel-body';
import { SecondarySidebarAccessibilityService } from './services/secondary-sidebar-accessibility-service';
import type { SecondaryPanelContext, SecondaryPanelItem } from '@fromcode119/react';
import type { SecondarySidebarMode } from './services/secondary-sidebar-state-service.interfaces';

const {
  Close = () => null,
  Left = () => null,
  Right = () => null,
} = (FrameworkIcons || {}) as any;

const accessibilityService = new SecondarySidebarAccessibilityService();

type SecondarySidebarProps = {
  mode: SecondarySidebarMode;
  context: SecondaryPanelContext | null;
  items: SecondaryPanelItem[];
  sourceLabel: string;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onPanelMouseEnter?: () => void;
  onPanelMouseLeave?: () => void;
  onItemActivate?: (item?: SecondaryPanelItem) => void;
  parentPrimaryPath?: string;
};

export default function SecondarySidebar(props: SecondarySidebarProps) {
  const pathname = usePathname() || '';
  const dialogRef = React.useRef<HTMLDivElement | null>(null);
  const triggerRef = React.useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = React.useRef<HTMLElement | null>(null);
  const liveMessage = props.context ? `Secondary navigation: ${props.context.label}` : 'Secondary navigation updated';
  const hasItems = props.items.length > 0;
  const isDesktop = props.mode === 'desktop';
  const hasActiveItem = React.useMemo(() => props.items.some((item) => NavUtils.isPathMatch(pathname, item?.path || '')), [pathname, props.items]);

  React.useEffect(() => {
    if (!props.isOpen || isDesktop) {
      return;
    }

    previousFocusRef.current = document.activeElement as HTMLElement;
    const focusable = accessibilityService.getFocusableElements(dialogRef.current);
    focusable[0]?.focus();

    return () => {
      previousFocusRef.current?.focus();
    };
  }, [props.isOpen, isDesktop]);

  const handleOverlayKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      props.onClose();
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const elements = accessibilityService.getFocusableElements(dialogRef.current);
    if (!elements.length) {
      return;
    }

    const first = elements[0];
    const last = elements[elements.length - 1];
    const activeElement = document.activeElement as HTMLElement | null;

    if (event.shiftKey && activeElement === first) {
      event.preventDefault();
      last.focus();
      return;
    }

    if (!event.shiftKey && activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }, [props]);

  const handleListKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLElement>) => {
    const links = accessibilityService.getLinkElements(event.currentTarget as HTMLElement);
    if (!links.length) {
      return;
    }

    const activeIndex = links.findIndex((entry) => entry === document.activeElement);

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      links[(activeIndex + 1 + links.length) % links.length]?.focus();
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      links[(activeIndex - 1 + links.length) % links.length]?.focus();
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      links[0]?.focus();
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      links[links.length - 1]?.focus();
      return;
    }

    if (event.key === ' ' || event.key === 'Enter') {
      const current = document.activeElement as HTMLAnchorElement | null;
      if (current?.dataset.secondaryLink === 'true') {
        event.preventDefault();
        current.click();
      }
    }
  }, []);

  if (!hasItems) {
    return null;
  }

  if (isDesktop) {
    if (!props.isOpen) {
      return (
        <div className="sticky top-16 z-40 h-[calc(100vh-4rem)] w-5 shrink-0 self-start overflow-visible">
          <button
            ref={triggerRef}
            type="button"
            aria-label="Open secondary navigation"
            aria-expanded="false"
            aria-controls={AdminConstants.SECONDARY_SIDEBAR.PANEL_ID}
            onClick={props.onOpen}
            className="absolute left-0 top-8 z-40 inline-flex h-20 w-5 items-center justify-center rounded-r-xl border border-l-0 border-slate-200 bg-white text-slate-500 shadow-[12px_0_28px_-24px_rgba(15,23,42,0.28)] transition-colors hover:text-indigo-600 dark:border-slate-800 dark:bg-[#020617] dark:text-slate-300"
          >
            <Right size={14} />
          </button>
        </div>
      );
    }

    return (
      <aside
        id={AdminConstants.SECONDARY_SIDEBAR.PANEL_ID}
        className={`sticky top-0 z-30 ml-[-1px] flex h-screen w-[var(--secondary-sidebar-width)] shrink-0 overflow-hidden border-r shadow-[-18px_0_36px_-28px_rgba(79,70,229,0.26),-10px_0_24px_-24px_rgba(15,23,42,0.22)] dark:shadow-[-18px_0_36px_-28px_rgba(99,102,241,0.18),-10px_0_24px_-24px_rgba(2,6,23,0.88)] ${hasActiveItem ? 'border-slate-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98)_0%,rgba(244,246,255,0.60)_100%)] ring-1 ring-inset ring-indigo-100/20 dark:border-slate-800 dark:bg-[linear-gradient(180deg,rgba(30,41,59,0.96)_0%,rgba(37,99,235,0.05)_100%)] dark:ring-indigo-500/5' : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-[#020617]'}`}
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
          pathname={pathname}
          onListKeyDown={handleListKeyDown}
          onItemActivate={(item) => props.onItemActivate?.(item)}
          onMouseEnter={props.onPanelMouseEnter}
          onMouseLeave={props.onPanelMouseLeave}
        />
      </aside>
    );
  }

  return (
    <>
      <button
        ref={triggerRef}
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
            ref={dialogRef}
            id={AdminConstants.SECONDARY_SIDEBAR.PANEL_ID}
            role="dialog"
            aria-modal="true"
            aria-label="Secondary navigation"
            className={`absolute top-0 bottom-0 w-[var(--secondary-sidebar-width)] overflow-hidden bg-white shadow-2xl dark:bg-[#020617] flex ${props.mode === 'mobile' ? 'right-0' : 'left-[72px] shadow-[-18px_0_36px_-28px_rgba(79,70,229,0.26),-10px_0_24px_-24px_rgba(15,23,42,0.22)] dark:shadow-[-18px_0_36px_-28px_rgba(99,102,241,0.18),-10px_0_24px_-24px_rgba(2,6,23,0.88)]'}`}
            onKeyDown={handleOverlayKeyDown}
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
              pathname={pathname}
              onListKeyDown={handleListKeyDown}
              onItemActivate={(item) => {
                props.onItemActivate?.(item);
                props.onClose();
              }}
            />
            </div>
          </div>
        </div>
      )}

      <span className="sr-only" aria-live="polite">{liveMessage}</span>
    </>
  );
}
