import type React from 'react';
import type { AssistantLayoutState, AssistantMessage, ForgeHistorySession } from '../admin-assistant-core';

export interface AdminAssistantPageHistoryEffectsProps {
  api: any;
  provider: string;
  model: string;
  skillId: string;
  chatMode: 'auto' | 'plan' | 'agent';
  sandboxMode: boolean;
  baseUrl: string;
  checkingIntegration: boolean;
  integrationConfigured: boolean;
  historyHydrated: boolean;
  historySource: 'server' | 'local';
  activeSessionId: string;
  messages: AssistantMessage[];
  themeMode: 'light' | 'dark';
  layoutState: AssistantLayoutState;
  browserState: {
    readHistoryEntries<T>(): T[];
    readActiveSessionId(): string;
    writeActiveSessionId(sessionId: string): void;
    readUiPreferences(): any;
    writeUiPreferences(value: any): void;
    readProviderBaseUrl(providerKey: string): string;
    writeHistoryEntries(entries: ForgeHistorySession[]): void;
    writeThemePreference(mode: 'light' | 'dark'): void;
  };
  setHistorySessions: React.Dispatch<React.SetStateAction<ForgeHistorySession[]>>;
  historySessions: ForgeHistorySession[];
  setHistorySource: React.Dispatch<React.SetStateAction<'server' | 'local'>>;
  setHistoryHydrated: React.Dispatch<React.SetStateAction<boolean>>;
  setHistoryLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setActiveSessionId: React.Dispatch<React.SetStateAction<string>>;
  setMessages: React.Dispatch<React.SetStateAction<AssistantMessage[]>>;
  setProvider: React.Dispatch<React.SetStateAction<string>>;
  setModel: React.Dispatch<React.SetStateAction<string>>;
  setSkillId: React.Dispatch<React.SetStateAction<string>>;
  setChatMode: React.Dispatch<React.SetStateAction<'auto' | 'plan' | 'agent'>>;
  setSandboxMode: React.Dispatch<React.SetStateAction<boolean>>;
  setLayoutState: React.Dispatch<React.SetStateAction<AssistantLayoutState>>;
  setUiPrefsHydrated: React.Dispatch<React.SetStateAction<boolean>>;
  setBaseUrl: React.Dispatch<React.SetStateAction<string>>;
}
