import type { Dispatch, SetStateAction } from 'react';

export interface AssistantTopBarProps {
  provider: string;
  model: string;
  chatMode: 'auto' | 'plan' | 'agent';
  sandboxMode: boolean;
  showComposerControls: boolean;
  setShowComposerControls: Dispatch<SetStateAction<boolean>>;
  openAdvancedWorkspace: () => void;
  toggleThemeMode: () => void;
  themeMode: 'light' | 'dark';
  showGateway: boolean;
  setShowGateway: Dispatch<SetStateAction<boolean>>;
  showHistory: boolean;
  setShowHistory: Dispatch<SetStateAction<boolean>>;
}
