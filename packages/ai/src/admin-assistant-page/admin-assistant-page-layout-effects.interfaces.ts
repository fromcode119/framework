import type React from 'react';
import type { AssistantAction, AssistantLayoutState, AssistantMessage } from '../admin-assistant-core';

export interface AdminAssistantPageLayoutEffectsProps {
  prompt: string;
  autoResizeTextArea: () => void;
  setLayoutState: React.Dispatch<React.SetStateAction<AssistantLayoutState>>;
  pinToBottom: (preferredBehavior?: ScrollBehavior) => () => void;
  messagesLength: number;
  loading: boolean;
  viewportRef: React.RefObject<HTMLDivElement | null>;
  followLatestRef: React.MutableRefObject<boolean>;
  followDistanceThreshold: number;
  showTools: boolean;
  toolsButtonRef: React.RefObject<HTMLButtonElement | null>;
  toolsMenuRef: React.RefObject<HTMLDivElement | null>;
  toolsDropdownRef: React.RefObject<HTMLDivElement | null>;
  setShowTools: React.Dispatch<React.SetStateAction<boolean>>;
  setToolsMenuStyle: React.Dispatch<React.SetStateAction<{ left: number; top: number; width: number } | null>>;
  updateToolsMenuPosition: () => void;
  showTechnicalDetails: boolean;
  activeBatchId: string;
  lastActions: AssistantAction[];
  setSelectedActionIndexes: React.Dispatch<React.SetStateAction<number[]>>;
  historyHydrated: boolean;
  hasConversation: boolean;
  activeSessionId: string;
  showHistory: boolean;
  showGateway: boolean;
  viewportBottomPadding: number;
  messages: AssistantMessage[];
  chatMode: 'auto' | 'plan' | 'agent';
  setLoadingPhaseIndex: React.Dispatch<React.SetStateAction<number>>;
  layoutState: AssistantLayoutState;
}
