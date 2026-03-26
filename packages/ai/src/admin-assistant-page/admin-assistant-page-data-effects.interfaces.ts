import type React from 'react';
import type { AssistantSkill, AssistantToolOption } from '../admin-assistant-core';

export interface AdminAssistantPageDataEffectsProps {
  api: any;
  checkingIntegration: boolean;
  uiPrefsHydrated: boolean;
  provider: string;
  apiKey: string;
  baseUrl: string;
  hasSavedSecret: boolean;
  model: string;
  setProvider: React.Dispatch<React.SetStateAction<string>>;
  setModel: React.Dispatch<React.SetStateAction<string>>;
  setBaseUrl: React.Dispatch<React.SetStateAction<string>>;
  setCheckingIntegration: React.Dispatch<React.SetStateAction<boolean>>;
  setIntegrationConfigured: React.Dispatch<React.SetStateAction<boolean>>;
  setHasSavedSecret: React.Dispatch<React.SetStateAction<boolean>>;
  setProviderModels: React.Dispatch<React.SetStateAction<Array<{ value: string; label: string }>>>;
  setLoadingProviderModels: React.Dispatch<React.SetStateAction<boolean>>;
  setProviderModelsError: React.Dispatch<React.SetStateAction<string>>;
  setAvailableTools: React.Dispatch<React.SetStateAction<AssistantToolOption[]>>;
  setSelectedTools: React.Dispatch<React.SetStateAction<string[]>>;
  setSkills: React.Dispatch<React.SetStateAction<AssistantSkill[]>>;
  setSkillId: React.Dispatch<React.SetStateAction<string>>;
  browserState: {
    hasProviderOrModelPreference(): boolean;
  };
}
