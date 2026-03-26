import type { ConversationMode, UploadedAttachment } from '../../admin-assistant-core';

export interface AssistantComposerProps {
  prompt: string;
  setPrompt: (val: string) => void;
  loading: boolean;
  checkingIntegration: boolean;
  integrationConfigured: boolean;
  uploadingAttachments: boolean;
  sendPrompt: (forced?: string) => Promise<void>;
  onComposerKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onQuickFix: () => void;
  mode: ConversationMode;
  setMode: (mode: ConversationMode) => void;
  attachments: UploadedAttachment[];
  removeAttachment: (idx: number) => void;
  openFilePicker: () => void;
  hasConversation: boolean;
  promptUsage: string;
  showTools: boolean;
  setShowTools: (val: boolean | ((prev: boolean) => boolean)) => void;
  activeTools: number;
  totalTools: number;
  quickPrompts: string[];
  composerRef: React.RefObject<HTMLDivElement | null>;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  toolsButtonRef: React.RefObject<HTMLButtonElement | null>;
  onFilesSelected: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  developerMode: boolean;
}
