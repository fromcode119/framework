"use client";

import React from 'react';
import { usePathname } from 'next/navigation';
import { NavUtils } from '@/lib/nav-utils';
import SecondarySidebarDesktop from './secondary-sidebar-desktop';
import SecondarySidebarMobile from './secondary-sidebar-mobile';
import { SecondarySidebarAccessibilityService } from './services/secondary-sidebar-accessibility-service';
import type { SecondaryPanelItem } from '@fromcode119/react';
import type { SecondarySidebarProps } from './secondary-sidebar.types';

const accessibilityService = new SecondarySidebarAccessibilityService();

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
    return (
      <SecondarySidebarDesktop
        context={props.context}
        items={props.items}
        sourceLabel={props.sourceLabel}
        pathname={pathname}
        isOpen={props.isOpen}
        hoverOpen={props.hoverOpen}
        overlayLeftClass={props.overlayLeftClass}
        hasActiveItem={hasActiveItem}
        triggerRef={triggerRef}
        onOpen={props.onOpen}
        onClose={props.onClose}
        onPanelMouseEnter={props.onPanelMouseEnter}
        onPanelMouseLeave={props.onPanelMouseLeave}
        onItemActivate={(item?: SecondaryPanelItem) => props.onItemActivate?.(item)}
        onListKeyDown={handleListKeyDown}
      />
    );
  }

  return (
    <SecondarySidebarMobile
      context={props.context}
      items={props.items}
      sourceLabel={props.sourceLabel}
      pathname={pathname}
      mode={props.mode}
      isOpen={props.isOpen}
      liveMessage={liveMessage}
      dialogRef={dialogRef}
      triggerRef={triggerRef}
      onOpen={props.onOpen}
      onClose={props.onClose}
      onItemActivate={(item?: SecondaryPanelItem) => props.onItemActivate?.(item)}
      onOverlayKeyDown={handleOverlayKeyDown}
      onListKeyDown={handleListKeyDown}
    />
  );
}
