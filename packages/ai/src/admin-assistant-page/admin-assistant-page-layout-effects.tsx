'use client';

import React from 'react';
import type { AdminAssistantPageLayoutEffectsProps } from './admin-assistant-page-layout-effects.interfaces';

export function AdminAssistantPageLayoutEffects(props: AdminAssistantPageLayoutEffectsProps) {
  React.useEffect(() => {
    props.autoResizeTextArea();
  }, [props.prompt, props.autoResizeTextArea]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const syncViewport = () => {
      const nextViewport = window.innerWidth <= 900 ? 'mobile' : 'desktop';
      props.setLayoutState((prev) => (
        prev.viewport === nextViewport ? prev : { ...prev, viewport: nextViewport, overlay: 'none' }
      ));
    };
    syncViewport();
    window.addEventListener('resize', syncViewport);
    return () => window.removeEventListener('resize', syncViewport);
  }, [props.setLayoutState]);

  React.useEffect(() => {
    if (props.chatMode !== 'auto' && props.loading) props.setLoadingPhaseIndex(0);
  }, [props.chatMode, props.loading, props.setLoadingPhaseIndex]);

  React.useEffect(() => {
    if (props.loading) {
      props.followLatestRef.current = true;
      props.setLoadingPhaseIndex(0);
      return;
    }
    props.setLoadingPhaseIndex(0);
  }, [props.loading, props.setLoadingPhaseIndex, props.followLatestRef]);

  React.useEffect(() => {
    if (props.messagesLength <= 0) return;
    const cleanup = props.pinToBottom(props.messagesLength > 1 ? 'smooth' : 'auto');
    return cleanup;
  }, [props.messagesLength, props.loading, props.pinToBottom]);

  React.useEffect(() => {
    const viewport = props.viewportRef.current;
    if (!viewport) return;
    const onScroll = () => {
      const distanceToBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
      props.followLatestRef.current = distanceToBottom <= props.followDistanceThreshold;
    };
    onScroll();
    viewport.addEventListener('scroll', onScroll, { passive: true });
    return () => viewport.removeEventListener('scroll', onScroll);
  }, [props.messagesLength, props.followDistanceThreshold, props.viewportRef, props.followLatestRef]);

  React.useEffect(() => {
    if (props.activeBatchId) {
      props.setSelectedActionIndexes(props.lastActions.map((_, index) => index));
      return;
    }
    props.setSelectedActionIndexes([]);
  }, [props.activeBatchId, props.lastActions, props.setSelectedActionIndexes]);

  React.useEffect(() => {
    if (!props.showTools) {
      props.setToolsMenuStyle(null);
      return;
    }
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node;
      const insideTrigger = !!(props.toolsMenuRef.current && props.toolsMenuRef.current.contains(target));
      const insideMenu = !!(props.toolsDropdownRef.current && props.toolsDropdownRef.current.contains(target));
      if (!insideTrigger && !insideMenu) props.setShowTools(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') props.setShowTools(false);
    };
    props.updateToolsMenuPosition();
    const rafId = window.requestAnimationFrame(props.updateToolsMenuPosition);
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', props.updateToolsMenuPosition);
    window.addEventListener('scroll', props.updateToolsMenuPosition, true);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', props.updateToolsMenuPosition);
      window.removeEventListener('scroll', props.updateToolsMenuPosition, true);
    };
  }, [props.showTools, props.updateToolsMenuPosition, props.toolsDropdownRef, props.toolsMenuRef, props.setShowTools, props.setToolsMenuStyle]);

  React.useEffect(() => {
    if (!props.showTechnicalDetails && props.showTools) props.setShowTools(false);
  }, [props.showTechnicalDetails, props.showTools, props.setShowTools]);

  React.useEffect(() => {
    if (props.layoutState.viewport !== 'mobile') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') props.setLayoutState((prev) => ({ ...prev, overlay: 'none' }));
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [props.layoutState.viewport, props.setLayoutState]);

  React.useLayoutEffect(() => {
    if (!props.hasConversation) return;
    return props.pinToBottom('auto');
  }, [props.hasConversation, props.pinToBottom, props.loading, props.showHistory, props.showGateway, props.viewportBottomPadding, props.messages]);

  React.useEffect(() => {
    if (!props.historyHydrated || !props.hasConversation) return;
    return props.pinToBottom('auto');
  }, [props.historyHydrated, props.activeSessionId, props.hasConversation, props.pinToBottom]);

  return null;
}
