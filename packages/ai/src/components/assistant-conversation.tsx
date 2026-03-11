'use client';

import React from 'react';
import { AssistantLoadingState } from './assistant-loading-state';
import { AssistantConversationEmptyState } from './assistant-conversation-empty-state';
import { AssistantConversationMessage } from './assistant-conversation-message';
import type { AssistantConversationProps } from './assistant-conversation.interfaces';

export function AssistantConversation({
  viewportRef,
  viewportBottomPadding,
  hasConversation,
  visibleMessages,
  forkFromVisibleMessage,
  setChatMode,
  loading,
  scrollAnchorRef,
  chatMode,
  loadingPhaseIndex,
  showTechnicalDetails,
}: AssistantConversationProps) {
  const conversationMode = chatMode === 'plan' ? 'build' : chatMode === 'agent' ? 'quickfix' : 'chat';

  return (
    <div ref={viewportRef} className="h-full scroll-smooth overflow-y-auto px-4 pt-5 sm:px-8" style={{ paddingBottom: `${viewportBottomPadding}px` }}>
      {!hasConversation ? (
        <AssistantConversationEmptyState />
      ) : (
        <div className="mx-auto max-w-3xl space-y-4 pb-8">
          {visibleMessages.map((entry, index) => (
            <AssistantConversationMessage
              key={`${entry.role}-${index}`}
              entry={entry}
              index={index}
              forkFromVisibleMessage={forkFromVisibleMessage}
              setChatMode={setChatMode}
              showTechnicalDetails={showTechnicalDetails}
            />
          ))}
          {loading ? <AssistantLoadingState mode={conversationMode} phase={loadingPhaseIndex} /> : null}
          <div ref={scrollAnchorRef} className="h-0" />
        </div>
      )}
    </div>
  );
}
