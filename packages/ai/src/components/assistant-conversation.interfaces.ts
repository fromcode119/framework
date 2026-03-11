import type { Dispatch, RefObject, SetStateAction } from 'react';
import type { AssistantMessage } from '../admin-assistant-core';

export interface AssistantConversationProps {
  viewportRef: RefObject<HTMLDivElement | null>;
  viewportBottomPadding: number;
  hasConversation: boolean;
  visibleMessages: AssistantMessage[];
  forkFromVisibleMessage: (index: number) => void;
  setChatMode: Dispatch<SetStateAction<'auto' | 'plan' | 'agent'>>;
  loading: boolean;
  scrollAnchorRef: RefObject<HTMLDivElement | null>;
  chatMode: 'auto' | 'plan' | 'agent';
  loadingPhaseIndex: number;
  showTechnicalDetails: boolean;
}

export interface AssistantConversationMessageProps {
  entry: AssistantMessage;
  index: number;
  forkFromVisibleMessage: (index: number) => void;
  setChatMode: Dispatch<SetStateAction<'auto' | 'plan' | 'agent'>>;
  showTechnicalDetails: boolean;
}

export interface AssistantMessageContentProps {
  entry: AssistantMessage;
  messageIndex: number;
}

export interface AssistantAttachmentsProps {
  entry: AssistantMessage;
}

export interface AssistantTechnicalDetailsProps {
  entry: AssistantMessage;
  showTechnicalDetails: boolean;
}

export interface AssistantActionSummaryProps {
  entry: AssistantMessage;
  setChatMode: Dispatch<SetStateAction<'auto' | 'plan' | 'agent'>>;
}

export interface AssistantExecutionCardProps {
  entry: AssistantMessage;
}

export interface AssistantExecutionResultProps {
  item: unknown;
  resultIndex: number;
}
