export interface AdminAssistantUiPreferences {
  baseUrl: string;
  baseUrls: Record<string, string>;
  chatMode: '' | 'auto' | 'plan' | 'agent';
  leftSidebarOpen: boolean | null;
  model: string;
  provider: string;
  rightSidebarOpen: boolean | null;
  sandboxMode: boolean | null;
  skillId: string;
}
