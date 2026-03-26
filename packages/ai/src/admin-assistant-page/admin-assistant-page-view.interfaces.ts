import type React from 'react';
import type {
  AssistantAction,
  AssistantLayoutState,
  AssistantMessage,
  AssistantSkill,
  AssistantToolOption,
  ForgeHistorySession,
  UploadedAttachment,
} from '../admin-assistant-core';

export interface AdminAssistantPageViewProps {
  layoutState: AssistantLayoutState;
  themeMode: 'light' | 'dark';
  historySource: 'server' | 'local';
  historyLoading: boolean;
  historySessions: ForgeHistorySession[];
  activeSessionId: string;
  showHistory: boolean;
  showGateway: boolean;
  visibleMessages: AssistantMessage[];
  loading: boolean;
  loadingPhaseIndex: number;
  chatMode: 'auto' | 'plan' | 'agent';
  showTechnicalDetails: boolean;
  activeBatchEntry: {
    actions: AssistantAction[];
    actionBatch: NonNullable<AssistantMessage['actionBatch']>;
  } | null;
  selectedActionIndexes: number[];
  executing: boolean;
  activeBatchSummary?: { ok: number; unchanged: number; failed: number };
  promptUsage: string;
  hasConversation: boolean;
  conversationMode: 'chat' | 'build' | 'quickfix';
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  composerRef: React.RefObject<HTMLDivElement | null>;
  viewportRef: React.RefObject<HTMLDivElement | null>;
  scrollAnchorRef: React.RefObject<HTMLDivElement | null>;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  toolsButtonRef: React.RefObject<HTMLButtonElement | null>;
  toolsDropdownRef: React.RefObject<HTMLDivElement | null>;
  prompt: string;
  setPrompt: React.Dispatch<React.SetStateAction<string>>;
  onComposerKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onQuickFix: () => void;
  sendPrompt: (forced?: string) => Promise<void>;
  checkingIntegration: boolean;
  integrationConfigured: boolean;
  quickPrompts: string[];
  showTools: boolean;
  setShowTools: React.Dispatch<React.SetStateAction<boolean>>;
  activeTools: number;
  totalTools: number;
  attachments: UploadedAttachment[];
  removeAttachment: (indexToRemove: number) => void;
  openFilePicker: () => void;
  onFilesSelected: (event: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  uploadingAttachments: boolean;
  closeHistoryPanel: () => void;
  startNewSession: () => void;
  openHistorySession: (sessionId: string) => Promise<void>;
  removeHistorySession: (sessionId: string) => void;
  openAdvancedWorkspace: () => void;
  toggleHistoryPanel: () => void;
  toggleSettingsPanel: () => void;
  toggleThemeMode: () => void;
  closeSettingsPanel: () => void;
  forkFromVisibleMessage: (visibleIndex: number) => void;
  setChatMode: React.Dispatch<React.SetStateAction<'auto' | 'plan' | 'agent'>>;
  toggleActionIndex: (actionIndex: number) => void;
  selectAllActions: () => void;
  clearSelectedActions: () => void;
  runPreview: () => Promise<void>;
  runApply: () => Promise<void>;
  provider: string;
  switchProvider: (provider: string) => void;
  providerOptions: Array<{ value: string; label: string }>;
  model: string;
  setModel: React.Dispatch<React.SetStateAction<string>>;
  modelOptions: Array<{ value: string; label: string }>;
  loadingProviderModels: boolean;
  providerModelsError: string;
  skillId: string;
  setSkillId: React.Dispatch<React.SetStateAction<string>>;
  skillOptions: Array<{ value: string; label: string }>;
  apiKey: string;
  setApiKey: React.Dispatch<React.SetStateAction<string>>;
  hasSavedSecret: boolean;
  baseUrl: string;
  setBaseUrl: React.Dispatch<React.SetStateAction<string>>;
  saveIntegration: () => Promise<void>;
  integrationSaving: boolean;
  autoApprove: boolean;
  setAutoApprove: React.Dispatch<React.SetStateAction<boolean>>;
  setShowTechnicalDetails: React.Dispatch<React.SetStateAction<boolean>>;
  verboseLogging: boolean;
  setVerboseLogging: React.Dispatch<React.SetStateAction<boolean>>;
  toolsMenuStyle: { left: number; top: number; width: number } | null;
  availableTools: AssistantToolOption[];
  selectedTools: string[];
  setSelectedTools: React.Dispatch<React.SetStateAction<string[]>>;
  toggleTool: (toolName: string) => void;
  notice: string;
  clearNotice: () => void;
  error: string;
  clearError: () => void;
}
